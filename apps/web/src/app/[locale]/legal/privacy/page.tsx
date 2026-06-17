import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { MarketingHeader } from '@/components/MarketingHeader';
import { MarketingFooter } from '@/components/MarketingFooter';
import { pageMetadata } from '@/lib/seo';
import type { Locale } from '@/i18n/routing';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata({
    title: 'Privacy Policy — HearMe',
    description: 'How HearMe collects, uses, processes, and protects your data.',
    path: '/legal/privacy',
    locale,
  });
}

export default async function PrivacyPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <MarketingHeader />
      <main className="container max-w-3xl py-16">
        <h1 className="text-4xl font-bold">Privacy Policy</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: 17 June 2026</p>

        <div className="prose-hearme mt-8 space-y-6 text-muted-foreground">
          <p>
            This Privacy Policy explains how HearMe (“we”, “us”) collects, uses, and protects your
            information when you use our voice-first AI companion. By using HearMe you agree to this
            policy. This document is a general template and not legal advice.
          </p>

          <Section title="Information we collect">
            <ul className="list-disc space-y-1 pl-5">
              <li><strong>Account data</strong> — your email, name, and authentication identifiers from your sign-in provider.</li>
              <li><strong>Conversation data</strong> — transcripts of your conversations, and (if enabled) audio recordings, along with generated reports, mood insights, and long-term memory.</li>
              <li><strong>Usage data</strong> — minutes used, plan, and aggregate cost metrics.</li>
              <li><strong>Payment data</strong> — handled by our payment processor; we do not store full card details.</li>
            </ul>
          </Section>

          <Section title="How we use your information">
            <p>
              To provide the service: transcribe your speech, generate AI responses and reports,
              remember relevant context across conversations, enforce your plan limits, and improve
              reliability. We do not sell your personal data.
            </p>
          </Section>

          <Section title="Third-party processors">
            <p>
              We use trusted providers to operate HearMe, including a cloud database and authentication
              provider, a speech-to-text and text-to-speech provider, and an AI model provider to
              generate responses, reports, and mood analysis. Your conversation content is processed by
              these providers solely to deliver the service.
            </p>
          </Section>

          <Section title="Data retention & control">
            <p>
              You can review and delete your conversations and the memory HearMe keeps about you. Audio
              recordings, where enabled, are retained for a configurable period and then deleted. You may
              request deletion of your account and associated data at any time.
            </p>
          </Section>

          <Section title="Not a medical service">
            <p>
              HearMe is a reflection and emotional-support companion. It is not a therapist, medical
              device, or healthcare provider, and it does not diagnose or treat any condition. If you are
              in crisis, please contact your local emergency number or a crisis helpline.
            </p>
          </Section>

          <Section title="Contact">
            <p>Questions about this policy? Contact us through the app or your account settings.</p>
          </Section>
        </div>
      </main>
      <MarketingFooter />
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-xl font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  );
}
