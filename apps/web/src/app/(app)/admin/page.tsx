'use client';

import { useQuery } from '@tanstack/react-query';
import { Banknote, Clock, CpuIcon, Loader2, TrendingUp, Users, UserCheck } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { AppHeader } from '@/components/AppHeader';
import { MarketingFooter } from '@/components/MarketingFooter';

interface AdminMetrics {
  totalUsers: number;
  activeUsers: number;
  revenue: number;
  conversationMinutes: number;
  aiCosts: number;
  profit: number;
  subscriptionCount: number;
  trialConversionRate: number;
  providerSpend: {
    anthropic: { configured: boolean; monthToDateUsd: number | null };
    elevenlabs: {
      tier: string;
      charactersUsed: number;
      characterLimit: number;
      resetAt: string | null;
    } | null;
  };
}

const usd = (n: number) => `$${n.toFixed(2)}`;

export default function AdminPage() {
  const { user } = useAuth();
  const { data, isLoading, error } = useQuery<AdminMetrics>({
    queryKey: ['admin-metrics', user?.uid],
    queryFn: () => apiFetch<AdminMetrics>('/admin/metrics'),
    enabled: !!user,
    retry: false,
  });

  const forbidden = error && String((error as Error).message).match(/API 40[13]/);

  const cards = data
    ? [
        { label: 'Total users', value: data.totalUsers, Icon: Users },
        { label: 'Active (7d)', value: data.activeUsers, Icon: UserCheck },
        { label: 'Subscriptions', value: data.subscriptionCount, Icon: Banknote },
        { label: 'Conversation minutes', value: data.conversationMinutes, Icon: Clock },
        { label: 'AI cost', value: usd(data.aiCosts), Icon: CpuIcon },
        { label: 'Revenue', value: usd(data.revenue), Icon: Banknote },
        { label: 'Profit', value: usd(data.profit), Icon: TrendingUp },
        {
          label: 'Trial conversion',
          value: `${Math.round(data.trialConversionRate * 100)}%`,
          Icon: TrendingUp,
        },
      ]
    : [];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppHeader />

      <main className="container flex-1 py-10">
        <h1 className="text-3xl font-bold">Platform metrics</h1>
        <p className="mt-1 text-muted-foreground">Live overview across all users.</p>

        {isLoading ? (
          <Loader2 className="mt-10 h-6 w-6 animate-spin text-primary" />
        ) : forbidden ? (
          <div className="mt-8 rounded-2xl border bg-card p-8 text-center shadow-card">
            <h2 className="text-lg font-semibold">You don’t have access</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              This area is for HearMe admins. If that’s you, ask to be added to the admin list.
            </p>
          </div>
        ) : (
          <>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {cards.map(({ label, value, Icon }) => (
                <div key={label} className="rounded-2xl border bg-card p-5 shadow-card">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{label}</span>
                    <span className="grid h-9 w-9 place-items-center rounded-lg bg-accent/15 text-primary">
                      <Icon className="h-5 w-5" />
                    </span>
                  </div>
                  <div className="mt-3 text-2xl font-bold">{value}</div>
                </div>
              ))}
            </div>
            <p className="mt-6 text-sm text-muted-foreground">
              The cards above are <strong>estimated</strong> from metered usage × configured rates.
              Below is <strong>actual</strong> spend pulled live from each provider.
            </p>

            {/* Actual provider spend (reconciled from provider APIs) */}
            <h2 className="mt-10 text-xl font-bold">Actual provider spend</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {/* Anthropic */}
              <div className="rounded-2xl border bg-card p-6 shadow-card">
                <div className="text-sm text-muted-foreground">Anthropic (Claude) — month to date</div>
                {data?.providerSpend.anthropic.configured ? (
                  <div className="mt-2 text-2xl font-bold">
                    {usd(data.providerSpend.anthropic.monthToDateUsd ?? 0)}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">
                    Add <code className="rounded bg-muted px-1">ANTHROPIC_ADMIN_KEY</code> (an
                    <code className="rounded bg-muted px-1">sk-ant-admin…</code> key) to show real
                    billed cost.
                  </p>
                )}
              </div>

              {/* ElevenLabs */}
              <div className="rounded-2xl border bg-card p-6 shadow-card">
                <div className="text-sm text-muted-foreground">
                  ElevenLabs — characters used this period
                </div>
                {data?.providerSpend.elevenlabs ? (
                  <>
                    <div className="mt-2 text-2xl font-bold">
                      {data.providerSpend.elevenlabs.charactersUsed.toLocaleString()} /{' '}
                      {data.providerSpend.elevenlabs.characterLimit.toLocaleString()}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {data.providerSpend.elevenlabs.tier} plan
                      {data.providerSpend.elevenlabs.resetAt &&
                        ` · resets ${new Date(data.providerSpend.elevenlabs.resetAt).toLocaleDateString()}`}
                    </div>
                  </>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">Unavailable.</p>
                )}
              </div>
            </div>
          </>
        )}
      </main>
      <MarketingFooter />
    </div>
  );
}
