'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Brain, Loader2, Trash2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { friendlyApiError } from '@/lib/errors';
import { useAuth } from '@/lib/auth';
import { AppHeader } from '@/components/AppHeader';
import { MarketingFooter } from '@/components/MarketingFooter';

interface Memory {
  goals: string[];
  interests: string[];
  recurringConcerns: string[];
  importantEvents: string[];
  updatedAt: string | null;
}

const CATEGORIES: { key: keyof Memory; label: string }[] = [
  { key: 'goals', label: 'Goals' },
  { key: 'interests', label: 'Interests' },
  { key: 'recurringConcerns', label: 'Recurring themes' },
  { key: 'importantEvents', label: 'Important events' },
];

export default function SettingsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery<Memory>({
    queryKey: ['memory', user?.uid],
    queryFn: () => apiFetch<Memory>('/memory'),
    enabled: !!user,
  });

  const clear = useMutation({
    mutationFn: () => apiFetch('/memory', { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['memory'] }),
  });

  const isEmpty =
    data &&
    CATEGORIES.every((c) => !(data[c.key] as string[])?.length);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppHeader />

      <main className="container max-w-2xl flex-1 py-10">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-accent/15 text-primary">
            <Brain className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-2xl font-bold">What HearMe remembers</h1>
            <p className="text-sm text-muted-foreground">
              HearMe keeps a little context so conversations feel continuous. You’re always in control.
            </p>
          </div>
        </div>

        {isLoading ? (
          <Loader2 className="mt-10 h-6 w-6 animate-spin text-primary" />
        ) : isEmpty ? (
          <div className="mt-8 rounded-2xl border bg-card p-8 text-center text-muted-foreground shadow-card">
            HearMe hasn’t saved anything yet. After a few conversations, the things that matter to you
            will show up here.
          </div>
        ) : (
          <div className="mt-8 space-y-5">
            {CATEGORIES.map(({ key, label }) => {
              const items = (data?.[key] as string[]) ?? [];
              if (!items.length) return null;
              return (
                <div key={key} className="rounded-2xl border bg-card p-6 shadow-card">
                  <h2 className="mb-3 text-sm font-semibold text-muted-foreground">{label}</h2>
                  <div className="flex flex-wrap gap-2">
                    {items.map((it, i) => (
                      <span key={i} className="rounded-lg bg-muted/60 px-3 py-1.5 text-sm">
                        {it}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!isEmpty && !isLoading && (
          <div className="mt-8 flex items-center justify-between rounded-2xl border border-warning/30 bg-warning/5 p-5">
            <div>
              <div className="font-medium">Forget everything</div>
              <div className="text-sm text-muted-foreground">
                Permanently clear everything HearMe remembers about you.
              </div>
            </div>
            <button
              onClick={() => clear.mutate()}
              disabled={clear.isPending}
              className="inline-flex items-center gap-2 rounded-xl border border-warning/40 px-4 py-2 text-sm font-medium text-warning transition hover:bg-warning/10 disabled:opacity-60"
            >
              {clear.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Clear
            </button>
          </div>
        )}
        {clear.isError && (
          <p className="mt-3 text-sm text-warning">{friendlyApiError(clear.error)}</p>
        )}
      </main>
      <MarketingFooter />
    </div>
  );
}
