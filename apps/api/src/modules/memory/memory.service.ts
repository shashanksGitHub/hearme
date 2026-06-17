import { Inject, Injectable, Logger } from '@nestjs/common';
import { FieldValue } from 'firebase-admin/firestore';
import type { ServerEnv } from '@hearme/config';
import { ENV } from '../../common/config/config.module';
import { AnthropicService } from '../../infrastructure/anthropic/anthropic.service';
import { FirebaseService } from '../../infrastructure/firebase/firebase.service';

interface MemoryItems {
  goals: string[];
  interests: string[];
  recurringConcerns: string[];
  importantEvents: string[];
}

const EMPTY: MemoryItems = { goals: [], interests: [], recurringConcerns: [], importantEvents: [] };

const MEMORY_SYSTEM = `You maintain a long-term memory profile of a user for a supportive voice companion (not a therapist).
You are given the user's EXISTING memory (JSON) and a NEW conversation transcript.
Return an UPDATED memory JSON with exactly these array fields: "goals", "interests", "recurringConcerns", "importantEvents".
Rules:
- Only include durable, meaningful facts worth remembering across conversations — not small talk.
- Merge new information with existing; remove duplicates and anything outdated or contradicted.
- Keep each list concise: at most 8 short phrases per category.
- If the transcript adds nothing meaningful, return the existing memory unchanged.`;

/** Long-term memory: extract durable facts from a conversation and merge into the user's profile. */
@Injectable()
export class MemoryService {
  private readonly logger = new Logger(MemoryService.name);

  constructor(
    @Inject(ENV) private readonly env: ServerEnv,
    private readonly anthropic: AnthropicService,
    private readonly firebase: FirebaseService,
  ) {}

  async get(uid: string): Promise<MemoryItems & { updatedAt: string | null }> {
    const snap = await this.firebase.db.collection('memories').doc(uid).get();
    const d = snap.data();
    return {
      goals: d?.goals ?? [],
      interests: d?.interests ?? [],
      recurringConcerns: d?.recurringConcerns ?? [],
      importantEvents: d?.importantEvents ?? [],
      updatedAt:
        d?.updatedAt && typeof d.updatedAt.toDate === 'function'
          ? d.updatedAt.toDate().toISOString()
          : null,
    };
  }

  async clear(uid: string): Promise<void> {
    await this.firebase.db.collection('memories').doc(uid).set(
      { userId: uid, ...EMPTY, updatedAt: FieldValue.serverTimestamp() },
      { merge: false },
    );
  }

  /** Best-effort: extract + merge memory from a conversation transcript. */
  async update(uid: string, conversationId: string): Promise<void> {
    if (!this.env.ENABLE_MEMORY) return;
    const convRef = this.firebase.db.collection('conversations').doc(conversationId);
    const conv = (await convRef.get()).data();
    if (!conv || conv.userId !== uid) return;

    const msgs = await convRef.collection('messages').orderBy('timestamp', 'asc').get();
    const transcript = msgs.docs
      .map((d) => `${d.data().role === 'assistant' ? 'HearMe' : 'User'}: ${d.data().content}`)
      .join('\n');
    if (!transcript.trim()) return;

    try {
      const existing = await this.get(uid);
      const input = `EXISTING MEMORY:\n${JSON.stringify({
        goals: existing.goals,
        interests: existing.interests,
        recurringConcerns: existing.recurringConcerns,
        importantEvents: existing.importantEvents,
      })}\n\nNEW TRANSCRIPT:\n${transcript}`;

      const { data } = await this.anthropic.json<MemoryItems>(MEMORY_SYSTEM, input, 600);
      const cap = (arr: unknown): string[] =>
        Array.isArray(arr)
          ? arr.filter((x) => typeof x === 'string' && x.trim()).slice(0, 8)
          : [];

      await this.firebase.db.collection('memories').doc(uid).set({
        userId: uid,
        goals: cap(data.goals),
        interests: cap(data.interests),
        recurringConcerns: cap(data.recurringConcerns),
        importantEvents: cap(data.importantEvents),
        updatedAt: FieldValue.serverTimestamp(),
      });
    } catch (err) {
      this.logger.warn(`Memory update failed for ${uid}: ${(err as Error).message}`);
    }
  }
}
