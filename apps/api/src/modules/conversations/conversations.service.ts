import { Injectable, NotFoundException } from '@nestjs/common';
import { FirebaseService } from '../../infrastructure/firebase/firebase.service';

/** Read APIs for conversation history + their reports. */
@Injectable()
export class ConversationsService {
  constructor(private readonly firebase: FirebaseService) {}

  async list(uid: string) {
    const snap = await this.firebase.db
      .collection('conversations')
      .where('userId', '==', uid)
      .orderBy('startedAt', 'desc')
      .limit(50)
      .get();
    return snap.docs.map((d) => {
      const c = d.data();
      return {
        id: d.id,
        startedAt: this.toIso(c.startedAt),
        durationSeconds: Number(c.durationSeconds) || 0,
        language: c.language ?? null,
        mood: c.mood ?? null,
        moodScore: typeof c.moodScore === 'number' ? c.moodScore : null,
        summary: c.summary ?? null,
      };
    });
  }

  async get(uid: string, id: string) {
    const convRef = this.firebase.db.collection('conversations').doc(id);
    const snap = await convRef.get();
    const conv = snap.data();
    if (!snap.exists || conv?.userId !== uid) throw new NotFoundException('conversation');

    const [msgsSnap, reportSnap] = await Promise.all([
      convRef.collection('messages').orderBy('timestamp', 'asc').get(),
      this.firebase.db.collection('reports').doc(id).get(),
    ]);

    return {
      id,
      startedAt: this.toIso(conv.startedAt),
      endedAt: this.toIso(conv.endedAt),
      durationSeconds: Number(conv.durationSeconds) || 0,
      language: conv.language ?? null,
      costs: conv.costs ?? null,
      messages: msgsSnap.docs.map((d) => {
        const m = d.data();
        return { role: m.role, content: m.content, timestamp: this.toIso(m.timestamp) };
      }),
      report: reportSnap.exists ? this.serializeReport(reportSnap.data()!) : null,
    };
  }

  private serializeReport(r: Record<string, unknown>) {
    return { ...r, createdAt: this.toIso(r.createdAt) };
  }

  private toIso(value: unknown): string | null {
    if (value && typeof (value as { toDate?: () => Date }).toDate === 'function') {
      return (value as { toDate: () => Date }).toDate().toISOString();
    }
    return null;
  }
}
