"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
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
import { CheckCircle2, KeyRound } from "lucide-react";

export default function ResetPasswordPage() {
  const supabase = createClient();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [checking, setChecking] = useState(true);
  const [validSession, setValidSession] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      setValidSession(Boolean(data.session) && !error);
      setChecking(false);
    });

    return () => {
      mounted = false;
    };
  }, [supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    await supabase.auth.signOut();
    setSuccess(true);
    setLoading(false);
  };

  if (checking) {
    return (
      <AuthShell>
        <Card className="border-border/70 bg-card/80 shadow-2xl shadow-black/10 backdrop-blur-xl">
          <CardContent className="flex min-h-52 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </CardContent>
        </Card>
      </AuthShell>
    );
  }

  if (!validSession) {
    return (
      <AuthShell>
        <Card className="border-border/70 bg-card/80 shadow-2xl shadow-black/10 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-2xl font-semibold tracking-[-0.035em] text-foreground">
              Reset link expired or invalid
            </CardTitle>
            <CardDescription className="mt-2 leading-6 text-muted-foreground">
              Request a new password reset link to continue.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/forgot-password">
              <Button className="h-11 w-full">Request new reset link</Button>
            </Link>
          </CardContent>
        </Card>
      </AuthShell>
    );
  }

  if (success) {
    return (
      <AuthShell>
        <Card className="border-border/70 bg-card/80 shadow-2xl shadow-black/10 backdrop-blur-xl">
          <CardHeader className="items-center space-y-4 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-teal-400/20 bg-teal-400/10 text-teal-400">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <div>
              <CardTitle className="text-2xl font-semibold tracking-[-0.035em] text-foreground">
                Password updated
              </CardTitle>
              <CardDescription className="mt-2 leading-6 text-muted-foreground">
                Your password has been changed successfully. Sign in with your new password.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <Link href="/login">
              <Button className="h-11 w-full">Back to sign in</Button>
            </Link>
          </CardContent>
        </Card>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <Card className="border-border/70 bg-card/80 shadow-2xl shadow-black/10 backdrop-blur-xl">
        <CardHeader className="space-y-4 pb-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-primary/15 bg-primary/10 text-primary">
            <KeyRound className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-2xl font-semibold tracking-[-0.035em] text-foreground">
              Choose a new password
            </CardTitle>
            <CardDescription className="mt-2 leading-6 text-muted-foreground">
              Enter and confirm your new Wova8 account password.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {error && (
              <div role="alert" className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Label htmlFor="password" className="text-xs font-medium text-muted-foreground">
                New password
              </Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-11 border-border bg-muted/60 text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-primary/20"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="confirmPassword" className="text-xs font-medium text-muted-foreground">
                Confirm new password
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="h-11 border-border bg-muted/60 text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-primary/20"
              />
            </div>

            <Button type="submit" disabled={loading} className="mt-2 h-11 w-full">
              {loading ? "Updating..." : "Update password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </AuthShell>
  );
}
