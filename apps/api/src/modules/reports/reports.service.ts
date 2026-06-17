import { Inject, Injectable, Logger } from '@nestjs/common';
import { FieldValue } from 'firebase-admin/firestore';
import type { ServerEnv } from '@hearme/config';
import { ENV } from '../../common/config/config.module';
import { AnthropicService } from '../../infrastructure/anthropic/anthropic.service';
import { FirebaseService } from '../../infrastructure/firebase/firebase.service';

interface ReportJson {
  summary: string;
  overallMood: string;
  stressScore: number;
  anxietyScore: number;
  positivityScore: number;
  topics: string[];
  positiveMoments: string[];
  challenges: string[];
  reflectionSuggestions: string[];
}

const REPORT_SYSTEM = `You are an empathetic reflection assistant analyzing a transcript of a spoken conversation between a user and the HearMe companion. You are NOT a therapist and must not diagnose.
Produce a concise, supportive reflection report as JSON with exactly these fields:
- "summary": 2-3 warm sentences summarizing what the user talked about.
- "overallMood": one or two words (e.g. "Calm", "Stressed", "Hopeful").
- "stressScore": integer 0-100.
- "anxietyScore": integer 0-100.
- "positivityScore": integer 0-100.
- "topics": array of 2-5 short topic tags.
- "positiveMoments": array of 1-3 short strings.
- "challenges": array of 1-3 short strings.
- "reflectionSuggestions": array of 2-3 short gentle suggestions.`;

/** Generates a post-conversation reflection report + mood scores via Claude. */
@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    @Inject(ENV) private readonly env: ServerEnv,
    private readonly anthropic: AnthropicService,
    private readonly firebase: FirebaseService,
  ) {}

  /** Best-effort: analyze the transcript and persist a report + conversation mood. */
  async generate(uid: string, conversationId: string): Promise<void> {
    if (!this.env.ENABLE_REPORTS) return;
    const convRef = this.firebase.db.collection('conversations').doc(conversationId);
    const conv = (await convRef.get()).data();
    if (!conv || conv.userId !== uid) return;

    const msgs = await convRef.collection('messages').orderBy('timestamp', 'asc').get();
    const transcript = msgs.docs
      .map((d) => `${d.data().role === 'assistant' ? 'HearMe' : 'User'}: ${d.data().content}`)
      .join('\n');
    if (!transcript.trim()) return;

    try {
      const { data } = await this.anthropic.json<ReportJson>(REPORT_SYSTEM, transcript, 700);
      const clamp = (n: unknown) => Math.max(0, Math.min(100, Math.round(Number(n) || 0)));

      await this.firebase.db.collection('reports').doc(conversationId).set({
        id: conversationId,
        conversationId,
        userId: uid,
        summary: data.summary ?? '',
        mood: {
          overallMood: data.overallMood ?? 'Neutral',
          stressScore: clamp(data.stressScore),
          anxietyScore: clamp(data.anxietyScore),
          positivityScore: clamp(data.positivityScore),
          topics: data.topics ?? [],
        },
        keyTopics: data.topics ?? [],
        positiveMoments: data.positiveMoments ?? [],
        challenges: data.challenges ?? [],
        reflectionSuggestions: data.reflectionSuggestions ?? [],
        createdAt: FieldValue.serverTimestamp(),
      });

      // Denormalize onto the conversation for fast dashboard reads.
      await convRef.set(
        {
          mood: data.overallMood ?? 'Neutral',
          moodScore: clamp(data.positivityScore),
          summary: data.summary ?? '',
        },
        { merge: true },
      );
    } catch (err) {
      this.logger.warn(`Report generation failed for ${conversationId}: ${(err as Error).message}`);
    }
  }
}
