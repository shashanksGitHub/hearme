'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Banknote,
  Clock,
  CpuIcon,
  Loader2,
  TrendingUp,
  Users,
  UserCheck,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Logo } from '@/components/Logo';

interface AdminMetrics {
  totalUsers: number;
  activeUsers: number;
  revenue: number;
  conversationMinutes: number;
  aiCosts: number;
  profit: number;
  subscriptionCount: number;
  trialConversionRate: number;
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
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/60 backdrop-blur">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo />
            <span className="rounded-full bg-foreground px-2 py-0.5 text-xs font-semibold text-background">
              Admin
            </span>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </Link>
        </div>
      </header>

      <main className="container py-10">
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
              Revenue is $0 until billing (Stripe) is live; profit = revenue − AI cost.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
