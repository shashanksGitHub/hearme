import { Inject, Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import type { ServerEnv } from '@hearme/config';
import { ENV } from '../../common/config/config.module';

/**
 * OpenAI wrapper for chat (LLM) and speech-to-text. Also exposes cost helpers so
 * the voice orchestrator can meter llmCost/sttCost from token + duration usage.
 */
@Injectable()
export class OpenAIService {
  readonly client: OpenAI;

  constructor(@Inject(ENV) private readonly env: ServerEnv) {
    this.client = new OpenAI({ apiKey: this.env.OPENAI_API_KEY || 'sk-noop' });
  }

  get chatModel(): string {
    return this.env.OPENAI_CHAT_MODEL;
  }

  get sttModel(): string {
    return this.env.OPENAI_STT_MODEL;
  }

  /** Synthesize `text` and return the full MP3 audio buffer (cheap default voice). */
  async tts(text: string): Promise<Buffer> {
    const res = await this.client.audio.speech.create({
      model: this.env.OPENAI_TTS_MODEL,
      voice: this.env.OPENAI_TTS_VOICE as OpenAI.Audio.SpeechCreateParams['voice'],
      input: text,
      response_format: 'mp3',
    });
    return Buffer.from(await res.arrayBuffer());
  }

  /** USD cost for synthesizing `text`. */
  ttsCost(text: string): number {
    return (text.length / 1000) * this.env.OPENAI_TTS_COST_PER_1K_CHARS;
  }

  /** USD cost for an LLM turn given input/output token counts. */
  llmCost(inputTokens: number, outputTokens: number): number {
    const inCost = (inputTokens / 1_000_000) * this.env.OPENAI_LLM_INPUT_COST_PER_1M;
    const outCost = (outputTokens / 1_000_000) * this.env.OPENAI_LLM_OUTPUT_COST_PER_1M;
    return inCost + outCost;
  }

  /** USD cost for transcribing `seconds` of audio. */
  sttCost(seconds: number): number {
    return (seconds / 60) * this.env.OPENAI_STT_COST_PER_MINUTE;
  }
}
