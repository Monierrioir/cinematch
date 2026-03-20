"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type AuthMode = "signin" | "signup";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      setIsLoading(true);
      setError(null);

      if (mode === "signup") {
        const registerResponse = await fetch("/api/auth/register", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ name, email, password })
        });
        if (!registerResponse.ok) {
          const raw = await registerResponse.text();
          throw new Error(raw || "Could not create account.");
        }
      }

      const result = await signIn("credentials", {
        email,
        password,
        redirect: false
      });
      if (!result || result.error) {
        throw new Error("Invalid credentials.");
      }
      router.push("/recommendations");
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Authentication failed.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md space-y-6">
      <header className="space-y-2 text-center">
        <p className="text-xs uppercase tracking-[0.16em] text-brand-500">CineMatch Account</p>
        <h1 className="hero-title !text-5xl">Welcome Back</h1>
        <p className="text-sm text-slate-400">Sign in to save your profile and personalized recommendation history.</p>
      </header>

      <div className="surface-card space-y-5 p-6">
        <div className="inline-flex rounded-full bg-slate-900/65 p-1">
          <button
            type="button"
            onClick={() => setMode("signin")}
            className={`rounded-full px-4 py-2 text-xs uppercase tracking-[0.12em] transition-colors ${
              mode === "signin" ? "bg-brand-500 text-white" : "text-slate-300"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => setMode("signup")}
            className={`rounded-full px-4 py-2 text-xs uppercase tracking-[0.12em] transition-colors ${
              mode === "signup" ? "bg-brand-500 text-white" : "text-slate-300"
            }`}
          >
            Create Account
          </button>
        </div>

        <form className="space-y-3" onSubmit={handleSubmit}>
          {mode === "signup" && (
            <label className="block space-y-1">
              <span className="text-xs uppercase tracking-[0.12em] text-slate-400">Name</span>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 outline-none transition-colors focus:border-brand-500/70"
                placeholder="Your name"
              />
            </label>
          )}

          <label className="block space-y-1">
            <span className="text-xs uppercase tracking-[0.12em] text-slate-400">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 outline-none transition-colors focus:border-brand-500/70"
              placeholder="you@example.com"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs uppercase tracking-[0.12em] text-slate-400">Password</span>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 outline-none transition-colors focus:border-brand-500/70"
              placeholder="At least 8 characters"
            />
          </label>

          {error && <p className="text-sm text-rose-400">{error}</p>}

          <button type="submit" disabled={isLoading} className="btn-primary w-full py-2.5 text-sm disabled:opacity-60">
            {isLoading ? "Please wait..." : mode === "signin" ? "Sign In" : "Create Account"}
          </button>
        </form>
      </div>
    </div>
  );
}
