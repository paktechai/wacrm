import type { ReactNode } from "react";
import { Bot, ShieldCheck, Workflow } from "lucide-react";
import { BrandMark } from "@/components/brand/brand-mark";

interface AuthShellProps {
  children: ReactNode;
}

export function AuthShell({ children }: AuthShellProps) {
  return (
    <div className="wova8-auth-screen relative min-h-screen overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -left-44 -top-44 h-[34rem] w-[34rem] rounded-full bg-primary/15 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-52 -right-40 h-[34rem] w-[34rem] rounded-full bg-primary/10 blur-3xl"
      />

      <div className="relative grid min-h-screen lg:grid-cols-[1.08fr_0.92fr]">
        <section className="relative hidden overflow-hidden border-r border-border/70 bg-card/30 p-10 lg:flex lg:flex-col xl:p-14">
          <div
            aria-hidden
            className="absolute inset-0 opacity-25 [background-image:linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] [background-size:42px_42px] [mask-image:linear-gradient(to_bottom,black,transparent_85%)]"
          />

          <div className="relative"><BrandMark /></div>

          <div className="relative my-auto max-w-2xl py-14">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_0_4px_var(--primary-soft)]" />
              AI-powered customer engagement
            </div>
            <h1 className="max-w-xl text-5xl font-semibold leading-[0.98] tracking-[-0.055em] text-foreground xl:text-6xl">
              Conversations become
              <span className="block bg-gradient-to-r from-emerald-300 via-primary to-emerald-600 bg-clip-text text-transparent">
                relationships that grow.
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-muted-foreground">
              Manage WhatsApp conversations, contacts, campaigns, pipelines,
              automation and AI from one modern Wova8 workspace.
            </p>

            <div className="mt-10 grid max-w-xl gap-3 sm:grid-cols-3">
              <Feature
                icon={<Bot className="size-4" />}
                title="AI-first"
                text="Assist, qualify and respond faster"
              />
              <Feature
                icon={<Workflow className="size-4" />}
                title="Automated"
                text="Turn repeat work into smart flows"
              />
              <Feature
                icon={<ShieldCheck className="size-4" />}
                title="Business-ready"
                text="Secure teams and account isolation"
              />
            </div>
          </div>

          <div className="relative flex items-center justify-between text-[10px] font-medium tracking-[0.04em] text-muted-foreground">
            <span>WOVA8 · BUSINESS SOFTWARE</span>
            <span>wova8.com</span>
          </div>
        </section>

        <section className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-8 lg:px-10">
          <div className="w-full max-w-md">
            <div className="mb-7 flex justify-center lg:hidden"><BrandMark compact /></div>
            {children}
          </div>
        </section>
      </div>
    </div>
  );
}

function Feature({
  icon,
  title,
  text,
}: {
  icon: ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background/40 p-4 backdrop-blur-sm">
      <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </div>
      <div className="text-xs font-semibold text-foreground">{title}</div>
      <p className="mt-1.5 text-[11px] leading-4 text-muted-foreground">{text}</p>
    </div>
  );
}
