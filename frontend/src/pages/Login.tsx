import { useState, type FormEvent } from "react";
import { useAuth } from "../context/AuthContext";
import type { ApiError } from "../api/client";

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [subdomain, setSubdomain] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login({ username, password, subdomain });
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.status === 429) {
        setError("Too many attempts. Please wait a minute and try again.");
      } else {
        setError(apiErr.detail ?? "Login failed. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-white">AstroPage</h1>
          <p className="mt-2 text-sm text-slate-400">
            Sign in with your EduPage account
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-5 rounded-2xl border border-slate-800 bg-slate-900/60 p-8 shadow-xl backdrop-blur"
        >
          <Field
            label="School domain"
            hint="Just the subdomain, e.g. spsezochova"
            value={subdomain}
            onChange={setSubdomain}
            autoComplete="organization"
            placeholder="spsezochova"
          />
          <Field
            label="Username"
            value={username}
            onChange={setUsername}
            autoComplete="username"
            placeholder="your.name"
          />
          <Field
            label="Password"
            type="password"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
            placeholder="••••••••"
          />

          {error && (
            <p
              role="alert"
              className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-violet-600 px-4 py-2.5 font-medium text-white transition hover:bg-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>

          <p className="text-center text-xs text-slate-500">
            We never store your EduPage password.
          </p>
        </form>
      </div>
    </div>
  );
}

interface FieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  hint?: string;
  placeholder?: string;
  autoComplete?: string;
}

function Field({ label, value, onChange, type = "text", hint, placeholder, autoComplete }: FieldProps) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-300">{label}</span>
      <input
        type={type}
        required
        value={value}
        autoComplete={autoComplete}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-white placeholder-slate-600 transition focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
      />
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}
