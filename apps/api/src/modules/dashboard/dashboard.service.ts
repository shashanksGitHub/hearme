import { Inject, Injectable } from '@nestjs/common';
import type { ServerEnv } from '@hearme/config';
import { ENV } from '../../common/config/config.module';
import { FirebaseService } from '../../infrastructure/firebase/firebase.service';

export interface RecentConversation {
  id: string;
  startedAt: string | null;
  durationSeconds: number;
  mood: string | null;
  moodScore: number | null;
  summary: string | null;
}

export interface DashboardResponse {
  totalConversations: number;
  totalTalkTimeSeconds: number;
  remainingMinutes: number;
  planId: string;
  moodScore: number;
  weeklySummary: string;
  recent: RecentConversation[];
}

/** Aggregates a user's conversation data for the dashboard. */
@Injectable()
export class DashboardService {
  constructor(
    @Inject(ENV) private readonly env: ServerEnv,
    private readonly firebase: FirebaseService,
  ) {}

  async stats(uid: string): Promise<DashboardResponse> {
    const db = this.firebase.db;
    const [convSnap, userSnap, usageSnap] = await Promise.all([
      db.collection('conversations').where('userId', '==', uid).orderBy('startedAt', 'desc').get(),
      db.collection('users').doc(uid).get(),
      db
        .collection('usage')
        .doc(uid)
        .collection('daily')
        .doc(new Date().toISOString().slice(0, 10))
        .get(),
    ]);

    // Only count real conversations (an exchange happened → duration > 0).
    const convs = convSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }) as Record<string, unknown>)
      .filter((c) => (Number(c.durationSeconds) || 0) > 0);
    const totalTalkTimeSeconds = convs.reduce((s, c) => s + (Number(c.durationSeconds) || 0), 0);

    const moodScores = convs
      .map((c) => c.moodScore)
      .filter((n): n is number => typeof n === 'number');
    const moodScore = moodScores.length
      ? Math.round(moodScores.reduce((a, b) => a + b, 0) / moodScores.length)
      : 0;

    const usedSeconds = (usageSnap.data()?.secondsUsed as number) ?? 0;
    // Floor so any usage is visibly reflected (e.g. 9 min left after a short chat).
    const remainingMinutes = Math.max(
      0,
      Math.floor((this.env.FREE_MINUTES_PER_DAY * 60 - usedSeconds) / 60),
    );

    const recent: RecentConversation[] = convs.slice(0, 6).map((c) => ({
      id: c.id as string,
      startedAt: this.toIso(c.startedAt),
      durationSeconds: Number(c.durationSeconds) || 0,
      mood: (c.mood as string) ?? null,
      moodScore: typeof c.moodScore === 'number' ? c.moodScore : null,
      summary: (c.summary as string) ?? null,
    }));

    return {
      totalConversations: convs.length,
      totalTalkTimeSeconds,
      remainingMinutes,
      planId: (userSnap.data()?.planId as string) ?? 'free',
      moodScore,
      weeklySummary: this.weeklySummary(convs.length, moodScore),
      recent,
    };
  }

  private weeklySummary(count: number, mood: number): string {
    if (count === 0) return 'Start your first conversation to see insights here.';
    const tone = mood >= 66 ? 'mostly positive' : mood >= 40 ? 'balanced' : 'a bit heavy';
    return `You've had ${count} conversation${count === 1 ? '' : 's'} so far, and your recent mood looks ${tone}. Keep showing up for yourself.`;
  }

  private toIso(value: unknown): string | null {
    if (value && typeof (value as { toDate?: () => Date }).toDate === 'function') {
      return (value as { toDate: () => Date }).toDate().toISOString();
    }
    return null;
  }
}
