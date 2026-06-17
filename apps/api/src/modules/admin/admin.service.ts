import { Injectable } from '@nestjs/common';
import type { AdminMetrics } from '@hearme/shared';
import { FirebaseService } from '../../infrastructure/firebase/firebase.service';

/**
 * Aggregates platform-wide metrics for the admin portal. Simple full-collection
 * scans — fine at MVP scale; move to maintained counters as volume grows.
 */
@Injectable()
export class AdminService {
  constructor(private readonly firebase: FirebaseService) {}

  async metrics(): Promise<AdminMetrics> {
    const db = this.firebase.db;
    const [usersSnap, convSnap] = await Promise.all([
      db.collection('users').get(),
      db.collection('conversations').get(),
    ]);

    const totalUsers = usersSnap.size;
    let paidUsers = 0;
    usersSnap.forEach((d) => {
      if (['basic', 'pro'].includes(d.data().planId)) paidUsers++;
    });

    const weekAgoMs = Date.now() - 7 * 86_400_000;
    const activeUserIds = new Set<string>();
    let minutes = 0;
    let aiCosts = 0;
    convSnap.forEach((d) => {
      const c = d.data();
      minutes += (Number(c.durationSeconds) || 0) / 60;
      aiCosts += Number(c.costs?.totalCost) || 0;
      const startedMs =
        c.startedAt && typeof c.startedAt.toDate === 'function'
          ? c.startedAt.toDate().getTime()
          : 0;
      if (startedMs >= weekAgoMs && c.userId) activeUserIds.add(c.userId);
    });

    // Revenue is 0 until billing (Phase 4) is wired; profit = revenue − AI cost.
    const revenue = 0;
    const round = (n: number) => Math.round(n * 100) / 100;

    return {
      totalUsers,
      activeUsers: activeUserIds.size,
      revenue,
      conversationMinutes: Math.round(minutes),
      aiCosts: round(aiCosts),
      profit: round(revenue - aiCosts),
      subscriptionCount: paidUsers,
      trialConversionRate: totalUsers ? round(paidUsers / totalUsers) : 0,
    };
  }
}
