"use client";

import { useState } from "react";
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
import { ArrowLeft, CheckCircle2, Mail } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const supabase = createClient();

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  };

  if (success) {
    return (
      <AuthShell>
        <Card className="border-border/70 bg-card/80 shadow-2xl shadow-black/10 backdrop-blur-xl">
          <CardHeader className="items-center space-y-4 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <div>
              <CardTitle className="text-2xl font-semibold tracking-[-0.035em] text-foreground">
                Check your email
              </CardTitle>
              <CardDescription className="mt-2 leading-6 text-muted-foreground">
                We sent a password reset link to{" "}
                <span className="font-medium text-foreground">{email}</span>.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <Link href="/login">
              <Button
                variant="outline"
                className="h-11 w-full border-border text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                Back to sign in
              </Button>
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
            <Mail className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-2xl font-semibold tracking-[-0.035em] text-foreground">
              Reset your password
            </CardTitle>
            <CardDescription className="mt-2 leading-6 text-muted-foreground">
              Enter your Wova8 account email and we&apos;ll send you a secure reset link.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleReset} className="flex flex-col gap-4">
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
                Email
              </Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11 bg-card text-foreground placeholder:text-muted-foreground"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="mt-2 h-11 w-full bg-primary text-primary-foreground shadow-lg shadow-primary/15 hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? "Sending..." : "Send reset link"}
            </Button>
          </form>

          <Link
            href="/login"
            className="mt-6 flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to sign in
          </Link>
        </CardContent>
      </Card>
    </AuthShell>
  );
}
