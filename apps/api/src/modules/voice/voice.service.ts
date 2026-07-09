import { ForbiddenException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { FieldValue } from 'firebase-admin/firestore';
import { toFile } from 'openai';
import type { ServerEnv } from '@hearme/config';
import type { ConversationCosts, Memory } from '@hearme/shared';
import { ENV } from '../../common/config/config.module';
import { AnthropicService } from '../../infrastructure/anthropic/anthropic.service';
import { ElevenLabsService } from '../../infrastructure/elevenlabs/elevenlabs.service';
import { GoogleTtsService } from '../../infrastructure/google/google-tts.service';
import { FirebaseService } from '../../infrastructure/firebase/firebase.service';
import { OpenAIService } from '../../infrastructure/openai/openai.service';
import { MemoryService } from '../memory/memory.service';
import { ReportsService } from '../reports/reports.service';
import { buildSystemPrompt } from './prompt';

export interface StartResult {
  conversationId: string;
  remainingSeconds: number;
}

export interface TurnResult {
  userText: string;
  assistantText: string;
  audioBase64: string;
  audioMimeType: string;
  remainingSeconds: number;
}

interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Voice orchestration (turn-based). Each turn: STT → prompt(memory+style+lang)
 * → LLM chat → TTS, with per-component cost metering and full persistence to
 * Firestore. STT/LLM/TTS providers are all env-swappable (see *_PROVIDER).
 * Enforces the configurable daily free-minute budget.
 */
@Injectable()
export class VoiceService {
  private readonly logger = new Logger(VoiceService.name);

  constructor(
    @Inject(ENV) private readonly env: ServerEnv,
    private readonly openai: OpenAIService,
    private readonly anthropic: AnthropicService,
    private readonly elevenlabs: ElevenLabsService,
    private readonly google: GoogleTtsService,
    private readonly firebase: FirebaseService,
    private readonly reports: ReportsService,
    private readonly memory: MemoryService,
  ) {}

  /** Start a conversation: pre-flight the budget and snapshot user settings. */
  async startConversation(uid: string): Promise<StartResult> {
    const budget = this.env.FREE_MINUTES_PER_DAY * 60;
    const remainingSeconds = Math.max(0, budget - (await this.usedSecondsToday(uid)));
    if (remainingSeconds <= 0) throw new ForbiddenException('out_of_minutes');

    const settings = await this.getSettings(uid);
    const ref = this.firebase.db.collection('conversations').doc();
    await ref.set({
      userId: uid,
      language: settings.language ?? this.env.DEFAULT_LANGUAGE,
      voiceId: settings.voiceId ?? null,
      conversationStyle: settings.conversationStyle ?? null,
      durationSeconds: 0,
      startedAt: FieldValue.serverTimestamp(),
      endedAt: null,
      costs: { sttCost: 0, llmCost: 0, ttsCost: 0, totalCost: 0 },
      audioPath: null,
    });
    return { conversationId: ref.id, remainingSeconds };
  }

  /** Process one spoken turn end-to-end. Logs per-stage timings for latency RCA. */
  async processTurn(
    uid: string,
    conversationId: string,
    audio: Buffer,
    mimeType: string,
    durationMs: number,
  ): Promise<TurnResult> {
    const t0 = Date.now();
    const convRef = this.firebase.db.collection('conversations').doc(conversationId);
    // Parallelize the conversation read with today's-usage read (independent).
    const [convSnap, usedToday] = await Promise.all([convRef.get(), this.usedSecondsToday(uid)]);
    const conv = convSnap.data();
    if (!convSnap.exists || conv?.userId !== uid) throw new NotFoundException('conversation');
    // ElevenLabs needs a specific voiceId; OpenAI TTS uses a single configured voice.
    if (this.env.TTS_PROVIDER === 'elevenlabs' && !conv?.voiceId)
      throw new ForbiddenException('no_voice_selected');

    // Budget is metered by WALL-CLOCK conversation time, not just user-speech.
    const budget = this.env.FREE_MINUTES_PER_DAY * 60;
    const startedMs = this.tsToMs(conv.startedAt) || t0;
    const sessionElapsed = Math.max(0, Math.round((t0 - startedMs) / 1000));
    const remaining = Math.max(0, budget - usedToday - sessionElapsed);
    if (remaining <= 0) throw new ForbiddenException('out_of_minutes');

    const turnSeconds = Math.max(1, Math.round(durationMs / 1000));

    // 1) Speech-to-text — run in parallel with the history + memory reads
    //    (they don't depend on the new transcript) to overlap their latency.
    const sttStart = Date.now();
    const [stt, history, memory] = await Promise.all([
      this.transcribe(audio, mimeType, turnSeconds),
      this.loadHistory(convRef),
      this.loadMemory(uid),
    ]);
    const sttMs = Date.now() - sttStart;
    const { text: userText, cost: sttCost } = stt;

    if (!userText) {
      this.logger.log(
        `turn ${conversationId} stt=${sttMs}ms (no speech detected) total=${Date.now() - t0}ms`,
      );
      void this.recordTurn(
        uid,
        convRef,
        { sttCost, llmCost: 0, ttsCost: 0, totalCost: sttCost },
        sessionElapsed,
      );
      return {
        userText: '',
        assistantText: '',
        audioBase64: '',
        audioMimeType: 'audio/mpeg',
        remainingSeconds: remaining,
      };
    }

    // 2) Build prompt with history + memory + style + language
    const systemPrompt = buildSystemPrompt({
      languageCode: conv.language,
      styleId: conv.conversationStyle ?? null,
      memory,
    });

    // 3) LLM
    const llmStart = Date.now();
    const { text: assistantText, cost: llmCost } = await this.chat(systemPrompt, history, userText);
    const llmMs = Date.now() - llmStart;

    // 4) TTS
    const ttsStart = Date.now();
    const { audio: audioOut, cost: ttsCost } = await this.synthesize(
      conv.voiceId,
      assistantText,
      conv.language,
    );
    const ttsMs = Date.now() - ttsStart;

    const costs: ConversationCosts = {
      sttCost,
      llmCost,
      ttsCost,
      totalCost: sttCost + llmCost + ttsCost,
    };

    // Persist in the background so the spoken reply returns immediately
    // (the next turn won't read history until after this audio finishes playing).
    const messages = convRef.collection('messages');
    void Promise.all([
      messages.add({ role: 'user', content: userText, timestamp: FieldValue.serverTimestamp() }),
      messages.add({
        role: 'assistant',
        content: assistantText,
        timestamp: FieldValue.serverTimestamp(),
      }),
      this.recordTurn(uid, convRef, costs, sessionElapsed),
    ]).catch((e) => this.logger.warn(`persist turn failed: ${(e as Error).message}`));

    const total = Date.now() - t0;
    this.logger.log(
      `turn ${conversationId} [stt:${this.env.STT_PROVIDER} llm:${this.env.LLM_PROVIDER}/${this.anthropic.model} tts:${this.env.TTS_PROVIDER}] ` +
        `stt=${sttMs}ms llm=${llmMs}ms tts=${ttsMs}ms total=${total}ms (reply ${assistantText.length} chars)`,
    );

    return {
      userText,
      assistantText,
      audioBase64: audioOut.toString('base64'),
      audioMimeType: 'audio/mpeg',
      remainingSeconds: remaining,
    };
  }

  /** Finalize a conversation: commit wall-clock time to usage, run report + memory.
   *  Empty conversations (no exchange) are deleted so they don't pollute stats. */
  async endConversation(uid: string, conversationId: string): Promise<{ conversationId: string }> {
    const convRef = this.firebase.db.collection('conversations').doc(conversationId);
    const snap = await convRef.get();
    const conv = snap.data();
    if (!snap.exists || conv?.userId !== uid) throw new NotFoundException('conversation');

    const firstMsg = await convRef.collection('messages').limit(1).get();
    if (firstMsg.empty) {
      await convRef.delete();
      this.logger.log(`conversation ${conversationId} ended with no exchange — deleted`);
      return { conversationId };
    }

    const startedMs = this.tsToMs(conv.startedAt) || Date.now();
    const finalDuration = Math.max(1, Math.round((Date.now() - startedMs) / 1000));
    await convRef.set(
      { endedAt: FieldValue.serverTimestamp(), durationSeconds: finalDuration },
      { merge: true },
    );
    // Commit the conversation's wall-clock time to today's usage (once).
    await this.firebase.db
      .collection('usage')
      .doc(uid)
      .collection('daily')
      .doc(this.today())
      .set(
        { userId: uid, date: this.today(), secondsUsed: FieldValue.increment(finalDuration) },
        { merge: true },
      );

    await Promise.all([
      this.reports.generate(uid, conversationId),
      this.memory.update(uid, conversationId),
    ]);
    return { conversationId };
  }

  // ── providers ──

  /** Transcribe a turn via the configured STT provider; returns text + USD cost. */
  private async transcribe(
    audio: Buffer,
    mimeType: string,
    seconds: number,
  ): Promise<{ text: string; cost: number }> {
    if (this.env.STT_PROVIDER === 'elevenlabs') {
      const text = await this.elevenlabs.transcribe(audio, mimeType);
      return { text, cost: this.elevenlabs.sttCost(seconds) };
    }
    const file = await toFile(audio, `turn.${this.ext(mimeType)}`, { type: mimeType });
    const transcription = await this.openai.client.audio.transcriptions.create({
      file,
      model: this.openai.sttModel,
    });
    return { text: (transcription.text ?? '').trim(), cost: this.openai.sttCost(seconds) };
  }

  /** Generate the assistant reply via the configured LLM provider; returns text + USD cost. */
  private async chat(
    systemPrompt: string,
    history: ChatMsg[],
    userText: string,
  ): Promise<{ text: string; cost: number }> {
    const maxTokens = 220;
    if (this.env.LLM_PROVIDER === 'anthropic') {
      const r = await this.anthropic.chat(
        systemPrompt,
        [...history, { role: 'user', content: userText }],
        maxTokens,
      );
      return { text: r.text, cost: this.anthropic.llmCost(r.inputTokens, r.outputTokens) };
    }
    const completion = await this.openai.client.chat.completions.create({
      model: this.openai.chatModel,
      temperature: 0.8,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: systemPrompt },
        ...history,
        { role: 'user', content: userText },
      ],
    });
    return {
      text: (completion.choices[0]?.message?.content ?? '').trim(),
      cost: this.openai.llmCost(
        completion.usage?.prompt_tokens ?? 0,
        completion.usage?.completion_tokens ?? 0,
      ),
    };
  }

  /** Synthesize the reply via the configured TTS provider; returns MP3 audio + USD cost. */
  private async synthesize(
    voiceId: string | null,
    text: string,
    language?: string | null,
  ): Promise<{ audio: Buffer; cost: number }> {
    if (this.env.TTS_PROVIDER === 'elevenlabs') {
      const audio = await this.elevenlabs.tts(voiceId as string, text);
      return { audio, cost: this.elevenlabs.ttsCost(text) };
    }
    if (this.env.TTS_PROVIDER === 'google') {
      const audio = await this.google.tts(text, language, voiceId);
      return { audio, cost: this.google.ttsCost(text) };
    }
    const audio = await this.openai.tts(text);
    return { audio, cost: this.openai.ttsCost(text) };
  }

  // ── helpers ──

  private async getSettings(uid: string): Promise<{
    language?: string;
    voiceId?: string;
    conversationStyle?: string;
  }> {
    const snap = await this.firebase.db
      .collection('users')
      .doc(uid)
      .collection('settings')
      .doc('preferences')
      .get();
    return (snap.data() as Record<string, string>) ?? {};
  }

  private async loadHistory(convRef: FirebaseFirestore.DocumentReference): Promise<ChatMsg[]> {
    const snap = await convRef
      .collection('messages')
      .orderBy('timestamp', 'asc')
      .limitToLast(20)
      .get();
    return snap.docs.map((d) => {
      const m = d.data();
      return { role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content as string };
    });
  }

  private async loadMemory(uid: string): Promise<Memory | null> {
    if (!this.env.ENABLE_MEMORY) return null;
    const snap = await this.firebase.db.collection('memories').doc(uid).get();
    return snap.exists ? (snap.data() as Memory) : null;
  }

  private today(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private tsToMs(ts: unknown): number {
    return ts && typeof (ts as { toDate?: () => Date }).toDate === 'function'
      ? (ts as { toDate: () => Date }).toDate().getTime()
      : 0;
  }

  /** Seconds already consumed today (committed wall-clock across ended conversations). */
  private async usedSecondsToday(uid: string): Promise<number> {
    const snap = await this.firebase.db
      .collection('usage')
      .doc(uid)
      .collection('daily')
      .doc(this.today())
      .get();
    return (snap.data()?.secondsUsed as number) ?? 0;
  }

  /** Per-turn: set wall-clock duration so far + accumulate AI costs (time committed on end). */
  private async recordTurn(
    uid: string,
    convRef: FirebaseFirestore.DocumentReference,
    costs: ConversationCosts,
    sessionElapsed: number,
  ): Promise<void> {
    await convRef.set(
      {
        durationSeconds: sessionElapsed,
        costs: {
          sttCost: FieldValue.increment(costs.sttCost),
          llmCost: FieldValue.increment(costs.llmCost),
          ttsCost: FieldValue.increment(costs.ttsCost),
          totalCost: FieldValue.increment(costs.totalCost),
        },
      },
      { merge: true },
    );
    await this.firebase.db
      .collection('usage')
      .doc(uid)
      .collection('daily')
      .doc(this.today())
      .set(
        { userId: uid, date: this.today(), totalCost: FieldValue.increment(costs.totalCost) },
        { merge: true },
      );
  }

  private ext(mimeType: string): string {
    if (mimeType.includes('webm')) return 'webm';
    if (mimeType.includes('ogg')) return 'ogg';
    if (mimeType.includes('mp4') || mimeType.includes('m4a')) return 'mp4';
    if (mimeType.includes('wav')) return 'wav';
    if (mimeType.includes('mpeg') || mimeType.includes('mp3')) return 'mp3';
    return 'webm';
  }
}
