import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowUpRight, ShieldCheck } from 'lucide-react';
import { BrandMark } from '@/components/brand/brand-mark';
import { WOVA8 } from '@/lib/brand';

const nav = [
  { href: '/', label: 'Company' },
  { href: '/product', label: 'Wova8 CRM' },
  { href: '/contact', label: 'Contact' },
];

export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen overflow-hidden bg-[#080a10] text-slate-100 selection:bg-violet-400/25">
      <div className="pointer-events-none fixed inset-x-0 top-0 h-[36rem] bg-[radial-gradient(circle_at_20%_0%,rgba(124,92,255,0.16),transparent_42%),radial-gradient(circle_at_82%_8%,rgba(34,211,238,0.08),transparent_36%)]" />
      <header className="relative z-20 border-b border-white/8 bg-[#080a10]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-5 sm:px-8">
          <Link href="/" aria-label="Wova8 home">
            <BrandMark inverted />
          </Link>
          <nav
            className="hidden items-center gap-7 text-sm text-slate-300 md:flex"
            aria-label="Main navigation"
          >
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="transition-colors hover:text-white"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <Link
            href={`${WOVA8.crmUrl}/login`}
            className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/6 px-4 py-2 text-sm font-semibold text-white transition hover:border-violet-400/40 hover:bg-white/10"
          >
            CRM sign in <ArrowUpRight className="size-3.5" />
          </Link>
        </div>
      </header>
      <main className="relative">{children}</main>
      <footer className="relative border-t border-white/8 bg-[#07090e]">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-12 sm:px-8 md:grid-cols-[1.3fr_1fr_1fr]">
          <div>
            <BrandMark inverted />
            <p className="mt-4 max-w-sm text-sm leading-6 text-slate-400">
              Practical business software for customer communication,
              relationship management, automation, and AI-assisted operations.
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold tracking-[0.16em] text-slate-500 uppercase">
              Company
            </p>
            <div className="mt-4 grid gap-2.5 text-sm text-slate-300">
              <Link href="/product" className="hover:text-white">
                Wova8 CRM
              </Link>
              <Link href="/contact" className="hover:text-white">
                Contact
              </Link>
              <a
                href={`mailto:${WOVA8.emails.support}`}
                className="hover:text-white"
              >
                Support
              </a>
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold tracking-[0.16em] text-slate-500 uppercase">
              Trust
            </p>
            <div className="mt-4 grid gap-2.5 text-sm text-slate-300">
              <Link href="/privacy" className="hover:text-white">
                Privacy Policy
              </Link>
              <Link href="/terms" className="hover:text-white">
                Terms of Service
              </Link>
              <Link href="/data-deletion" className="hover:text-white">
                Data Deletion
              </Link>
            </div>
          </div>
        </div>
        <div className="border-t border-white/7">
          <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-5 text-xs text-slate-500 sm:px-8 md:flex-row md:items-center md:justify-between">
            <span>
              © {new Date().getUTCFullYear()} Wova8. All rights reserved.
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="size-3.5" /> Tenant-isolated application
              architecture
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export function PageIntro({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="mx-auto max-w-7xl px-5 pt-20 pb-14 sm:px-8 sm:pt-28">
      <p className="text-xs font-semibold tracking-[0.2em] text-violet-300 uppercase">
        {eyebrow}
      </p>
      <h1 className="mt-5 max-w-4xl text-4xl leading-[1.05] font-semibold tracking-[-0.045em] text-white sm:text-6xl">
        {title}
      </h1>
      <div className="mt-6 max-w-3xl text-base leading-7 text-slate-300 sm:text-lg sm:leading-8">
        {children}
      </div>
    </section>
  );
}

export function LegalArticle({ children }: { children: ReactNode }) {
  return (
    <article className="mx-auto max-w-4xl px-5 pb-24 sm:px-8 [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-white [&_li]:pl-1 [&_ol]:mt-4 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-5 [&_p]:mt-4 [&_p]:leading-7 [&_p]:text-slate-300 [&_ul]:mt-4 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
      {children}
    </article>
  );
}
