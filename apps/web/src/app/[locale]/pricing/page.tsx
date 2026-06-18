import type { Metadata } from 'next';
import Link from 'next/link';
import { setRequestLocale } from 'next-intl/server';
import { Check } from 'lucide-react';
import { JsonLd } from '@/components/JsonLd';
import { MarketingHeader } from '@/components/MarketingHeader';
import { MarketingFooter } from '@/components/MarketingFooter';
import { breadcrumbJsonLd, faqJsonLd, pageMetadata, productJsonLd } from '@/lib/seo';
import { currencyForLocale, formatPrice } from '@/lib/pricing';
import type { Locale } from '@/i18n/routing';

interface Plan {
  name: string;
  price: number;
  cadence: string;
  blurb: string;
  features: string[];
  cta: string;
  highlight: boolean;
}

// Plans priced in the locale's currency (see lib/pricing.ts).
function plansFor(locale: Locale): Plan[] {
  const c = currencyForLocale(locale);
  return [
    {
      name: 'Free',
      price: 0,
      cadence: 'forever',
      blurb: 'Try HearMe and build the habit.',
      features: ['10 minutes every day', '6-day full trial', 'Conversation reports', 'Mood insights'],
      cta: 'Start free',
      highlight: false,
    },
    {
      name: 'Basic',
      price: c.basic,
      cadence: '/month',
      blurb: 'For regular reflection.',
      features: ['300 minutes / month', 'Everything in Free', 'Long-term memory', 'Priority voices'],
      cta: 'Choose Basic',
      highlight: true,
    },
    {
      name: 'Pro',
      price: c.pro,
      cadence: '/month',
      blurb: 'Unlimited space to talk.',
      features: ['Unlimited (fair use)', 'Everything in Basic', 'Deeper reports', 'Early features'],
      cta: 'Choose Pro',
      highlight: false,
    },
  ];
}

const FAQS = [
  {
    q: 'Can I cancel anytime?',
    a: 'Yes. Plans are month-to-month and you can cancel or change anytime from your billing settings.',
  },
  {
    q: 'Is there a free option?',
    a: 'Yes — the Free plan gives you 10 minutes every day, plus a 6-day full trial, with no card required.',
  },
  {
    q: 'Is HearMe a replacement for therapy?',
    a: 'No. HearMe is a reflection and emotional-support companion. It does not diagnose or treat any condition.',
  },
];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata({
    title: 'Pricing — HearMe',
    description:
      'Simple, transparent pricing for HearMe. Start free with 10 minutes a day, or go unlimited. Cancel anytime.',
    path: '/pricing',
    locale,
  });
}

export default async function PricingPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const cur = currencyForLocale(locale);
  const PLANS = plansFor(locale);

  return (
    <>
      <JsonLd
        data={productJsonLd(
          PLANS.map((p) => ({ name: p.name, price: p.price })),
          cur.code,
        )}
      />
      <JsonLd data={faqJsonLd(FAQS)} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'Pricing', path: '/pricing' },
        ])}
      />
      <MarketingHeader />

      <main>
        <section className="bg-hero">
          <div className="container py-20 text-center">
            <h1 className="text-balance text-5xl font-bold tracking-tight">
              Simple pricing for showing up for yourself
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
              Start free, no card required. Upgrade when you’re ready for more space to talk.
            </p>
          </div>
        </section>

        <section className="container -mt-10 pb-20">
          <div className="grid gap-6 lg:grid-cols-3">
            {PLANS.map((p) => (
              <div
                key={p.name}
                className={`flex flex-col rounded-3xl border bg-card p-8 shadow-card ${
                  p.highlight ? 'ring-2 ring-primary' : ''
                }`}
              >
                {p.highlight && (
                  <span className="mb-3 w-fit rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold text-primary">
                    Most popular
                  </span>
                )}
                <h2 className="text-xl font-bold">{p.name}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{p.blurb}</p>
                <div className="mt-5 flex items-baseline gap-1">
                  <span className="text-4xl font-bold">{formatPrice(p.price, cur)}</span>
                  <span className="text-muted-foreground">{p.cadence}</span>
                </div>
                <ul className="mt-6 flex-1 space-y-3 text-sm">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-success" /> {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/signup"
                  className={`mt-8 rounded-xl px-6 py-3 text-center font-semibold transition hover:opacity-90 ${
                    p.highlight
                      ? 'bg-brand-gradient text-primary-foreground shadow-soft'
                      : 'border bg-background'
                  }`}
                >
                  {p.cta}
                </Link>
              </div>
            ))}
          </div>
          <p className="mt-8 text-center text-sm text-muted-foreground">
            HearMe is a reflection and emotional-support companion — not a therapist or medical service.
          </p>
        </section>

        <section className="container pb-20">
          <h2 className="mb-8 text-center text-3xl font-bold">Pricing questions</h2>
          <div className="mx-auto max-w-2xl space-y-4">
            {FAQS.map((f) => (
              <div key={f.q} className="rounded-2xl border bg-card p-6 shadow-card">
                <h3 className="font-semibold">{f.q}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.a}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
      <MarketingFooter />
    </>
  );
}
