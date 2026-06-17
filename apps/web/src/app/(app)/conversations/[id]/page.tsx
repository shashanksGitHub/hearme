'use client';

import { use } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Logo } from '@/components/Logo';

interface Report {
  summary: string;
  mood: { overallMood: string; stressScore: number; anxietyScore: number; positivityScore: number };
  keyTopics: string[];
  positiveMoments: string[];
  challenges: string[];
  reflectionSuggestions: string[];
}
interface Detail {
  id: string;
  startedAt: string | null;
  durationSeconds: number;
  messages: { role: 'user' | 'assistant'; content: string; timestamp: string | null }[];
  report: Report | null;
}

function Gauge({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-card">
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold">{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function Tags({ title, items }: { title: string; items: string[] }) {
  if (!items?.length) return null;
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-muted-foreground">{title}</h3>
      <ul className="space-y-1.5">
        {items.map((t, i) => (
          <li key={i} className="rounded-lg bg-muted/50 px-3 py-2 text-sm">
            {t}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function ConversationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const { data, isLoading } = useQuery<Detail>({
    queryKey: ['conversation', id, user?.uid],
    queryFn: () => apiFetch<Detail>(`/conversations/${id}`),
    enabled: !!user,
  });

  const r = data?.report;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/60 backdrop-blur">
        <div className="container flex h-16 items-center justify-between">
          <Logo />
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </Link>
        </div>
      </header>

      <main className="container max-w-3xl py-10">
        {isLoading ? (
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
        ) : !data ? (
          <p className="text-center text-muted-foreground">Conversation not found.</p>
        ) : (
          <>
            <h1 className="text-2xl font-bold">Conversation report</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {data.startedAt ? new Date(data.startedAt).toLocaleString() : ''} ·{' '}
              {Math.round(data.durationSeconds / 60) || '<1'} min
            </p>

            {r ? (
              <div className="mt-6 space-y-6">
                {/* Mood header card */}
                <div className="rounded-2xl bg-brand-gradient p-1 shadow-soft">
                  <div className="rounded-[1.4rem] bg-card p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm text-muted-foreground">Overall mood</div>
                        <div className="text-2xl font-bold">{r.mood.overallMood}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-muted-foreground">Positivity</div>
                        <div className="text-2xl font-bold text-primary">
                          {r.mood.positivityScore}
                        </div>
                      </div>
                    </div>
                    <p className="mt-4 text-muted-foreground">{r.summary}</p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Gauge label="Stress" value={r.mood.stressScore} tone="bg-warning" />
                  <Gauge label="Anxiety" value={r.mood.anxietyScore} tone="bg-accent" />
                </div>

                {!!r.keyTopics?.length && (
                  <div>
                    <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Topics</h3>
                    <div className="flex flex-wrap gap-2">
                      {r.keyTopics.map((t, i) => (
                        <span
                          key={i}
                          className="rounded-full bg-accent/15 px-3 py-1 text-sm font-medium text-primary"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid gap-6 sm:grid-cols-2">
                  <Tags title="Positive moments" items={r.positiveMoments} />
                  <Tags title="Challenges" items={r.challenges} />
                </div>
                <Tags title="Reflection suggestions" items={r.reflectionSuggestions} />
              </div>
            ) : (
              <div className="mt-6 rounded-2xl border bg-card p-6 text-muted-foreground shadow-card">
                No report was generated for this conversation.
              </div>
            )}

            {/* Transcript */}
            <section className="mt-10">
              <h2 className="mb-4 text-lg font-semibold">Transcript</h2>
              <div className="space-y-3">
                {data.messages.map((m, i) => (
                  <div
                    key={i}
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                      m.role === 'user'
                        ? 'ml-auto bg-primary text-primary-foreground'
                        : 'bg-card shadow-card'
                    }`}
                  >
                    {m.content}
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
