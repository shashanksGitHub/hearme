'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, Brain, Clock, Loader2, LogOut, MessageCircle, Mic, Smile } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Logo } from '@/components/Logo';

interface RecentConversation {
  id: string;
  startedAt: string | null;
  durationSeconds: number;
  mood: string | null;
  moodScore: number | null;
  summary: string | null;
}
interface Dashboard {
  totalConversations: number;
  totalTalkTimeSeconds: number;
  remainingMinutes: number;
  remainingSeconds: number;
  dailyLimitSeconds: number;
  planId: string;
  moodScore: number;
  weeklySummary: string;
  recent: RecentConversation[];
}

/** Format seconds as M:SS (e.g. 579 → "9:39"). */
function fmtClock(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function fmtDuration(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s ? `${m}m ${s}s` : `${m}m`;
}
function fmtDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
function moodEmoji(score: number): string {
  if (score >= 80) return '😄';
  if (score >= 60) return '🙂';
  if (score >= 40) return '😐';
  if (score >= 20) return '😟';
  return '😢';
}

export default function DashboardPage() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const { data, isLoading } = useQuery<Dashboard>({
    queryKey: ['dashboard', user?.uid],
    queryFn: () => apiFetch<Dashboard>('/dashboard'),
    enabled: !!user,
  });

  const stats = [
    {
      label: 'Total talk time',
      value: data ? fmtDuration(data.totalTalkTimeSeconds) : '—',
      Icon: Clock,
    },
    { label: 'Conversations', value: data?.totalConversations ?? '—', Icon: MessageCircle },
    {
      label: 'Avg mood',
      value: data ? `${moodEmoji(data.moodScore)} ${data.moodScore}` : '—',
      Icon: Smile,
    },
    {
      label: 'Time left today',
      value: data ? fmtClock(data.remainingSeconds) : '—',
      Icon: BarChart3,
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/60 backdrop-blur">
        <div className="container flex h-16 items-center justify-between">
          <Logo />
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {user?.displayName || user?.email}
            </span>
            <Link
              href="/settings"
              className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium text-muted-foreground transition hover:bg-muted"
            >
              <Brain className="h-4 w-4" /> Memory
            </Link>
            <button
              onClick={() => signOut().then(() => router.replace('/login'))}
              className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium text-muted-foreground transition hover:bg-muted"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="container py-10">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">
              Welcome back{user?.displayName ? `, ${user.displayName.split(' ')[0]}` : ''} 👋
            </h1>
            <p className="mt-1 text-muted-foreground">
              {isLoading ? 'Loading your insights…' : data?.weeklySummary}
            </p>
          </div>
          <Link
            href="/conversation"
            className="inline-flex items-center gap-2 rounded-xl bg-brand-gradient px-6 py-3 font-semibold text-primary-foreground shadow-soft transition hover:opacity-90"
          >
            <Mic className="h-5 w-5" /> Start a conversation
          </Link>
        </div>

        {/* Stat cards */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map(({ label, value, Icon }) => (
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

        {/* Recent conversations */}
        <section className="mt-10">
          <h2 className="mb-4 text-lg font-semibold">Recent conversations</h2>
          {isLoading ? (
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          ) : !data?.recent.length ? (
            <div className="rounded-2xl border bg-card p-8 text-center text-muted-foreground shadow-card">
              No conversations yet. Tap “Start a conversation” to begin.
            </div>
          ) : (
            <div className="space-y-3">
              {data.recent.map((c) => (
                <Link
                  key={c.id}
                  href={`/conversations/${c.id}`}
                  className="flex items-center justify-between rounded-2xl border bg-card p-4 shadow-card transition hover:bg-muted/40"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">
                        {c.moodScore != null ? moodEmoji(c.moodScore) : '💬'}
                      </span>
                      <span className="truncate font-medium">
                        {c.summary || c.mood || 'Conversation'}
                      </span>
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {fmtDate(c.startedAt)} · {fmtDuration(c.durationSeconds)}
                    </div>
                  </div>
                  <span className="ml-4 shrink-0 text-sm font-medium text-primary">View →</span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
