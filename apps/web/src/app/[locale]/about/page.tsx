import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { JsonLd } from '@/components/JsonLd';
import { MarketingHeader } from '@/components/MarketingHeader';
import { MarketingFooter } from '@/components/MarketingFooter';
import { breadcrumbJsonLd, organizationJsonLd, pageMetadata } from '@/lib/seo';
import type { Locale } from '@/i18n/routing';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata({
    title: 'About HearMe — a safe space to talk',
    description:
      'HearMe is a voice-first AI companion for reflection and emotional support. Learn what we believe and what HearMe is — and is not.',
    path: '/about',
    locale,
  });
}

export default async function AboutPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const values = [
    { title: 'You feel heard', body: 'No judgement, no rushing. Just space to say what’s on your mind, out loud, in your language.' },
    { title: 'Reflection, not advice', body: 'HearMe helps you notice patterns and express yourself — it asks thoughtful questions instead of lecturing.' },
    { title: 'Private by design', body: 'Your conversations are yours. You control your data and retention, and you can delete what HearMe remembers.' },
    { title: 'Honest about limits', body: 'HearMe is not a therapist and never claims to be. If you’re in crisis, it points you to real help.' },
  ];

  return (
    <>
      <JsonLd data={organizationJsonLd()} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'About', path: '/about' },
        ])}
      />
      <MarketingHeader />

      <main>
        <section className="bg-hero">
          <div className="container py-20 text-center">
            <h1 className="text-balance text-5xl font-bold tracking-tight">
              A safe space to talk, reflect, and feel heard
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
              HearMe was built on a simple idea: everyone deserves somewhere to think out loud and be
              understood — anytime, in their own words.
            </p>
          </div>
        </section>

        <section className="container py-16">
          <div className="mx-auto max-w-3xl space-y-6 text-lg leading-relaxed text-muted-foreground">
            <p>
              Talking helps. But the right moment rarely lines up with someone being free to listen.
              HearMe is a voice-first companion you can talk to whenever you need to — about your day,
              your goals, the thing you can’t stop thinking about — and walk away with a little more
              clarity.
            </p>
            <p>
              You speak naturally in your preferred language. HearMe listens, reflects with you, and
              turns each conversation into a gentle summary with mood insights and reflection prompts,
              so the things you talk about don’t just disappear.
            </p>
          </div>

          <div className="mx-auto mt-14 grid max-w-4xl gap-6 sm:grid-cols-2">
            {values.map((v) => (
              <div key={v.title} className="rounded-2xl border bg-card p-6 shadow-card">
                <h2 className="text-lg font-semibold">{v.title}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{v.body}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
      <MarketingFooter />
    </>
  );
}
