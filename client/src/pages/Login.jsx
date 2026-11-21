import { useState } from "react";
import { ArrowRight, Eye, EyeOff, LoaderCircle, LockKeyhole, Mail } from "lucide-react";
import { authAPI, saveSession } from "../services/api";
import AuthLayout, { LoginPreviewCards } from "../components/auth/AuthLayout";

export default function Login({ onNavigate, onLogin }) {
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleChange(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
    setError("");
    if (event.target.name === "email") setFieldError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (loading) return;
    setError(""); setFieldError(""); setLoading(true);
    try {
      const result = await authAPI.login({ email: form.email.trim(), password: form.password });
      saveSession(result);
      onLogin?.(result.user);
      onNavigate?.("dashboard");
    } catch (cause) {
      setError(cause?.message || "Something unexpected happened. Please try again.");
      setFieldError(cause?.fields?.email || "");
      setForm((current) => ({ ...current, password: "" }));
    } finally { setLoading(false); }
  }

  return <AuthLayout onNavigate={onNavigate} eyebrow="WELCOME BACK" headline={<>Pick up where your team <em>left off.</em></>} leftCards={<LoginPreviewCards />}>
    <div className="auth-v2-form public-reveal">
      <p className="auth-v2-form-eyebrow">WELCOME BACK</p>
      <h1>Pick up where your team left off</h1>
      <p className="auth-v2-description">Sign in to see your workspace, tasks and decisions.</p>
      {error && <div role="alert" className="public-auth-error">{error}</div>}
      <form onSubmit={handleSubmit} className="public-auth-form auth-v2-form-fields">
        <div className="public-field"><label htmlFor="login-email">Email address</label><div className={`public-input-wrap ${fieldError ? "has-error" : ""}`}><Mail size={17} aria-hidden="true"/><input id="login-email" name="email" type="email" autoComplete="email" placeholder="you@example.com" value={form.email} onChange={handleChange} aria-invalid={Boolean(fieldError)} aria-describedby={fieldError ? "login-email-error" : undefined} required/></div>{fieldError && <p id="login-email-error" role="alert" className="public-field-error">{fieldError}</p>}</div>
        <div className="public-field"><label htmlFor="login-password">Password</label><div className="public-input-wrap"><LockKeyhole size={17} aria-hidden="true"/><input id="login-password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="Enter your password" value={form.password} onChange={handleChange} required/><button type="button" className="public-password-toggle" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button></div></div>
        <button className="public-button public-auth-submit" type="submit" disabled={loading}>{loading ? <LoaderCircle size={17} className="public-spinner"/> : null}{loading ? "Signing in…" : "Sign in"}{!loading && <ArrowRight size={16}/>}</button>
      </form>
      <p className="public-auth-switch">New to DevSync? <button type="button" onClick={() => onNavigate?.("register")}>Create an account</button></p>
    </div>
  </AuthLayout>;
}
