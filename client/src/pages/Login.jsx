
import { useState } from "react";
import {
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
} from "lucide-react";
import { authAPI, saveSession } from "../services/api";
import Button from "../components/ui/Button";

export default function Login({ onNavigate, onLogin }) {
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleChange(event) {
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await authAPI.login({
        email: form.email.trim(),
        password: form.password,
      });

      saveSession(result);
      onLogin?.(result.user);
      onNavigate?.("dashboard");
    } catch (err) {
      setError(err.message || "Unable to log in. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-5 py-10 text-text">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-center gap-3">
          <img
            src="/devsync-mark-light.svg"
            alt="DevSync"
            className="h-11 w-11 object-contain"
          />
          <span className="text-2xl font-extrabold tracking-tight">DevSync</span>
        </div>

        <section className="rounded-2xl border border-line bg-surface p-7 sm:p-9">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-acc">
            Welcome back
          </p>
          <h1 className="text-2xl font-bold tracking-tight">
            Sign in to DevSync
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted">
            Pick up where your team left off.
          </p>

          {error && (
            <div
              role="alert"
              className="mt-5 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300"
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-7 space-y-5">
            <div>
              <label htmlFor="login-email" className="mb-2 block text-sm font-semibold">
                Email address
              </label>
              <div className="flex items-center gap-3 rounded-lg border border-line bg-bg px-3.5 focus-within:border-acc">
                <Mail size={17} className="shrink-0 text-muted" />
                <input
                  id="login-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={handleChange}
                  required
                  className="min-w-0 flex-1 bg-transparent py-3 text-sm outline-none placeholder:text-muted"
                />
              </div>
            </div>

            <div>
              <label htmlFor="login-password" className="mb-2 block text-sm font-semibold">
                Password
              </label>
              <div className="flex items-center gap-3 rounded-lg border border-line bg-bg px-3.5 focus-within:border-acc">
                <LockKeyhole size={17} className="shrink-0 text-muted" />
                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={form.password}
                  onChange={handleChange}
                  required
                  className="min-w-0 flex-1 bg-transparent py-3 text-sm outline-none placeholder:text-muted"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="text-muted hover:text-text"
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            <Button type="submit" loading={loading} className="w-full py-3">
              {loading ? "Signing in..." : "Sign in"}
              {!loading && <ArrowRight size={16} />}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted">
            Don't have an account?{" "}
            <button
              type="button"
              onClick={() => onNavigate?.("register")}
              className="font-semibold text-acc hover:underline"
            >
              Create an account
            </button>
          </p>
        </section>

        <p className="mt-6 text-center text-xs text-muted">
          Built for teams that turn conversations into progress.
        </p>
      </div>
    </main>
  );
}
