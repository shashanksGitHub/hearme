import Link from 'next/link';
import { Logo } from './Logo';

/** Shared marketing footer with site links (good for crawl depth + UX). */
export function MarketingFooter() {
  return (
    <footer className="border-t">
      <div className="container grid gap-8 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2">
          <Logo />
          <p className="mt-3 max-w-xs text-sm text-muted-foreground">
            A safe space to talk, reflect, and feel heard. HearMe is a reflection and emotional-support
            companion — not a therapist or medical service.
          </p>
        </div>
        <div>
          <h3 className="mb-3 text-sm font-semibold">Product</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link href="/" className="hover:text-foreground">Home</Link></li>
            <li><Link href="/pricing" className="hover:text-foreground">Pricing</Link></li>
            <li><Link href="/about" className="hover:text-foreground">About</Link></li>
            <li><Link href="/signup" className="hover:text-foreground">Get started</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="mb-3 text-sm font-semibold">Legal</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link href="/legal/privacy" className="hover:text-foreground">Privacy</Link></li>
            <li><Link href="/legal/terms" className="hover:text-foreground">Terms</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t py-6 text-center text-sm text-muted-foreground">
        © {2026} HearMe. All rights reserved.
      </div>
    </footer>
  );
}
