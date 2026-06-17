'use client';

import { use } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Sparkles } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { friendlyApiError } from '@/lib/errors';
import { useAuth } from '@/lib/auth';
import { AppHeader } from '@/components/AppHeader';
import { MarketingFooter } from '@/components/MarketingFooter';

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
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery<Detail>({
    queryKey: ['conversation', id, user?.uid],
    queryFn: () => apiFetch<Detail>(`/conversations/${id}`),
    enabled: !!user,
  });

  const generate = useMutation({
    mutationFn: () => apiFetch<Detail>(`/conversations/${id}/report`, { method: 'POST' }),
    onSuccess: (fresh) => {
      queryClient.setQueryData(['conversation', id, user?.uid], fresh);
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  const r = data?.report;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppHeader />

      <main className="container max-w-3xl flex-1 py-10">
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
              <div className="mt-6 flex flex-col items-center gap-4 rounded-2xl border bg-card p-8 text-center shadow-card">
                <p className="text-muted-foreground">No report was generated for this conversation yet.</p>
                <button
                  onClick={() => generate.mutate()}
                  disabled={generate.isPending || !data.messages.length}
                  className="inline-flex items-center gap-2 rounded-xl bg-brand-gradient px-6 py-3 font-semibold text-primary-foreground shadow-soft transition hover:opacity-90 disabled:opacity-60"
                >
                  {generate.isPending ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" /> Generating…
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-5 w-5" /> Generate report now
                    </>
                  )}
                </button>
                {!data.messages.length && (
                  <p className="text-xs text-muted-foreground">
                    This conversation has no transcript to analyze.
                  </p>
                )}
                {generate.isError && (
                  <p className="text-sm text-warning">{friendlyApiError(generate.error)}</p>
                )}
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
      <MarketingFooter />
    </div>
  );
}
