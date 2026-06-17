'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  BarChart3,
  Brain,
  ChevronDown,
  CreditCard,
  Info,
  LayoutDashboard,
  LogOut,
  Mic,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useMe } from '@/lib/use-me';
import { Logo } from './Logo';

interface NavLink {
  href: string;
  label: string;
  Icon: typeof Mic;
  adminOnly?: boolean;
}

const LINKS: NavLink[] = [
  { href: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { href: '/conversation', label: 'Start a conversation', Icon: Mic },
  { href: '/settings', label: 'Memory', Icon: Brain },
  { href: '/admin', label: 'Admin', Icon: BarChart3, adminOnly: true },
  { href: '/pricing', label: 'Pricing', Icon: CreditCard },
  { href: '/about', label: 'About', Icon: Info },
];

/** Shared authenticated-app header: logo + user dropdown with every link. */
export function AppHeader() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { data: me } = useMe();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const links = LINKS.filter((l) => !l.adminOnly || me?.isAdmin);
  const name = me?.displayName || user?.displayName || user?.email || 'Account';

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/dashboard" aria-label="HearMe home" className="flex items-center gap-2">
          <Logo />
          {me?.isAdmin && (
            <span className="rounded-full bg-foreground px-2 py-0.5 text-xs font-semibold text-background">
              Admin
            </span>
          )}
        </Link>

        {/* Inline nav on wider screens */}
        <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground md:flex">
          {links.slice(0, me?.isAdmin ? 4 : 3).map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-foreground">
              {l.label}
            </Link>
          ))}
        </nav>

        {/* User dropdown — contains every link (the only nav on mobile) */}
        <div className="relative" ref={ref}>
          <button
            onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition hover:bg-muted"
          >
            <span className="grid h-6 w-6 place-items-center rounded-full bg-brand-gradient text-xs font-bold text-primary-foreground">
              {(name[0] || 'U').toUpperCase()}
            </span>
            <span className="hidden max-w-[140px] truncate sm:inline">{name}</span>
            <ChevronDown className="h-4 w-4" />
          </button>

          {open && (
            <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-xl border bg-card shadow-soft">
              <div className="border-b px-4 py-3">
                <div className="truncate text-sm font-medium">{name}</div>
                {me?.email && (
                  <div className="truncate text-xs text-muted-foreground">{me.email}</div>
                )}
              </div>
              <nav className="py-1">
                {links.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm transition hover:bg-muted"
                  >
                    <l.Icon className="h-4 w-4 text-muted-foreground" /> {l.label}
                  </Link>
                ))}
              </nav>
              <button
                onClick={() => {
                  setOpen(false);
                  void signOut().then(() => router.replace('/login'));
                }}
                className="flex w-full items-center gap-3 border-t px-4 py-2.5 text-sm text-warning transition hover:bg-warning/10"
              >
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
