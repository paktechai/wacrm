"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import {
  getPostLoginDestination,
  navigateAfterLogin,
} from "@/lib/auth/login-navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowRight, UsersRound } from "lucide-react";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite");
  const t = useTranslations("LoginPage");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // A document navigation is deliberate here. Client-side router navigation
    // can race the browser's newly committed Supabase cookies and can request
    // an RSC payload before protected-route middleware sees the new session.
    navigateAfterLogin(getPostLoginDestination(inviteToken));
  };

  return (
    <AuthShell>
      <Card className="border-border/70 bg-card/80 shadow-2xl shadow-black/10 backdrop-blur-xl">
        <CardHeader className="space-y-4 pb-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-primary/15 bg-primary/10 text-primary">
              {inviteToken ? (
                <UsersRound className="h-5 w-5" />
              ) : (
                <span className="text-xs font-black tracking-[-0.08em]">S</span>
              )}
            </div>
            <span className="rounded-full border border-border bg-muted/50 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
              Secure workspace
            </span>
          </div>
          <div>
            <CardTitle className="text-2xl font-semibold tracking-[-0.035em] text-foreground">
              {inviteToken ? t("titleAccept") : "Welcome to Wova8 CRM"}
            </CardTitle>
            <CardDescription className="mt-2 leading-6 text-muted-foreground">
              {inviteToken
                ? t("descAccept")
                : "Sign in to your customer engagement workspace."}
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            {error && (
              <div
                role="alert"
                className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400"
              >
                {error}
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Label htmlFor="email" className="text-xs font-medium text-muted-foreground">
                {t("emailLabel")}
              </Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder={t("emailPlaceholder")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11 border-border bg-muted/60 text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-primary/20"
              />
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs font-medium text-muted-foreground">
                  {t("passwordLabel")}
                </Label>
                <Link
                  href="/forgot-password"
                  className="text-xs font-medium text-primary transition-colors hover:text-primary/80"
                >
                  {t("forgotPassword")}
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder={t("passwordPlaceholder")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-11 border-border bg-muted/60 text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-primary/20"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="mt-2 h-11 w-full gap-2 bg-primary text-primary-foreground shadow-lg shadow-primary/15 hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? t("signingIn") : t("signIn")}
              {!loading && <ArrowRight className="size-4" />}
            </Button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Wova8 account
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <p className="text-center text-sm text-muted-foreground">
            {t("noAccount")}{" "}
            <Link
              href={
                inviteToken
                  ? `/signup?invite=${encodeURIComponent(inviteToken)}`
                  : "/signup"
              }
              className="font-semibold text-primary transition-colors hover:text-primary/80"
            >
              {t("createAccount")}
            </Link>
          </p>
        </CardContent>
      </Card>
    </AuthShell>
  );
}
