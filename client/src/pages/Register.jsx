
import { useState } from "react";
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, UserRound } from "lucide-react";
import { authAPI, saveSession } from "../services/api";
import Button from "../components/ui/Button";

export default function Register({ onNavigate, onLogin }) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
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

    if (form.password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const result = await authAPI.register({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
      });

      saveSession(result);
      onLogin?.(result.user);
      onNavigate?.("dashboard");
    } catch (err) {
      setError(err.message || "Unable to create your account.");
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
            Get started
          </p>
          <h1 className="text-2xl font-bold tracking-tight">
            Create your account
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted">
            Bring your team's conversations, decisions, and tasks together.
          </p>

          {error && (
            <div
              role="alert"
              className="mt-5 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300"
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-7 space-y-4">
            <div>
              <label htmlFor="register-name" className="mb-2 block text-sm font-semibold">
                Full name
              </label>
              <div className="flex items-center gap-3 rounded-lg border border-line bg-bg px-3.5 focus-within:border-acc">
                <UserRound size={17} className="shrink-0 text-muted" />
                <input
                  id="register-name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  placeholder="Your name"
                  value={form.name}
                  onChange={handleChange}
                  minLength={2}
                  maxLength={100}
                  required
                  className="min-w-0 flex-1 bg-transparent py-3 text-sm outline-none placeholder:text-muted"
                />
              </div>
            </div>

            <div>
              <label htmlFor="register-email" className="mb-2 block text-sm font-semibold">
                Email address
              </label>
              <div className="flex items-center gap-3 rounded-lg border border-line bg-bg px-3.5 focus-within:border-acc">
                <Mail size={17} className="shrink-0 text-muted" />
                <input
                  id="register-email"
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
              <label htmlFor="register-password" className="mb-2 block text-sm font-semibold">
                Password
              </label>
              <div className="flex items-center gap-3 rounded-lg border border-line bg-bg px-3.5 focus-within:border-acc">
                <LockKeyhole size={17} className="shrink-0 text-muted" />
                <input
                  id="register-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  value={form.password}
                  onChange={handleChange}
                  minLength={8}
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

            <div>
              <label htmlFor="register-confirm-password" className="mb-2 block text-sm font-semibold">
                Confirm password
              </label>
              <input
                id="register-confirm-password"
                name="confirmPassword"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Re-enter your password"
                value={form.confirmPassword}
                onChange={handleChange}
                required
                className="w-full rounded-lg border border-line bg-bg px-3.5 py-3 text-sm outline-none placeholder:text-muted focus:border-acc"
              />
            </div>

            <Button type="submit" loading={loading} className="w-full py-3">
              {loading ? "Creating account..." : "Create account"}
              {!loading && <ArrowRight size={16} />}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted">
            Already have an account?{" "}
            <button
              type="button"
              onClick={() => onNavigate?.("login")}
              className="font-semibold text-acc hover:underline"
            >
              Sign in
            </button>
          </p>
        </section>
      </div>
    </main>
  );
}
