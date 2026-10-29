import { useState } from "react";
import { ArrowLeft, ArrowRight, Eye, EyeOff, LoaderCircle, LockKeyhole, Mail, UserRound } from "lucide-react";
import { authAPI, saveSession } from "../services/api";
import ThemeToggle from "../components/ui/ThemeToggle";

export default function Register({ onNavigate, onLogin }) {
  const [form, setForm] = useState({ name: "", email: "", password: "", confirmPassword: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);

  function handleChange(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
    setError("");
    setFieldErrors((current) => ({ ...current, [event.target.name]: "" }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (loading) return;
    setError("");
    const validation = {};
    const name = form.name.trim();
    const email = form.email.trim();
    if (name.length < 2 || name.length > 80) validation.name = "Name must be between 2 and 80 characters.";
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) validation.email = "Enter a valid email address.";
    const passwordBytes = new TextEncoder().encode(form.password).length;
    if (form.password.length < 8 || passwordBytes > 72) validation.password = "Password must be 8 to 72 characters (up to 72 UTF-8 bytes).";
    if (form.password !== form.confirmPassword) validation.confirmPassword = "Passwords do not match.";
    setFieldErrors(validation);
    if (Object.keys(validation).length) return;

    setLoading(true);
    try {
      const result = await authAPI.register({ name, email, password: form.password });
      saveSession(result);
      onLogin?.(result.user);
      onNavigate?.("dashboard");
    } catch (cause) {
      setError(cause?.message || "Something unexpected happened. Please try again.");
      setFieldErrors(cause?.fields || {});
      setForm((current) => ({ ...current, password: "", confirmPassword: "" }));
    } finally { setLoading(false); }
  }

  return <main className="public-page public-auth-page">
    <div className="public-auth-grid" aria-hidden="true"/>
    <div className="public-auth-wrap public-reveal">
      <div className="public-auth-topbar"><a href="/" onClick={(event) => { event.preventDefault(); onNavigate?.("home"); }} className="public-auth-back"><ArrowLeft size={15}/> Back to DevSync</a><ThemeToggle className="public-theme-toggle"/></div>
      <section className="public-auth-card public-register-card">
        <a href="/" onClick={(event) => { event.preventDefault(); onNavigate?.("home"); }} className="public-auth-brand"><img className="public-mark-light" src="/devsync-mark-light.svg" alt=""/><img className="public-mark-dark" src="/devsync-mark-dark.svg" alt=""/><span>DevSync</span></a>
        <p className="public-eyebrow">GET YOUR TEAM ON THE SAME PAGE</p>
        <h1>Create your account.</h1>
        <p className="public-auth-description">Start connecting your project’s conversations to its work.</p>
        {error && <div role="alert" className="public-auth-error">{error}</div>}
        <form onSubmit={handleSubmit} className="public-auth-form">
          <div className="public-field"><label htmlFor="register-name">Full name</label><div className={`public-input-wrap ${fieldErrors.name ? "has-error" : ""}`}><UserRound size={17} aria-hidden="true"/><input id="register-name" name="name" type="text" autoComplete="name" placeholder="Your name" value={form.name} onChange={handleChange} minLength={2} maxLength={100} required aria-invalid={Boolean(fieldErrors.name)} aria-describedby={fieldErrors.name ? "register-name-error" : undefined}/></div>{fieldErrors.name && <p id="register-name-error" role="alert" className="public-field-error">{fieldErrors.name}</p>}</div>
          <div className="public-field"><label htmlFor="register-email">Email address</label><div className={`public-input-wrap ${fieldErrors.email ? "has-error" : ""}`}><Mail size={17} aria-hidden="true"/><input id="register-email" name="email" type="email" autoComplete="email" placeholder="you@example.com" value={form.email} onChange={handleChange} required aria-invalid={Boolean(fieldErrors.email)} aria-describedby={fieldErrors.email ? "register-email-error" : undefined}/></div>{fieldErrors.email && <p id="register-email-error" role="alert" className="public-field-error">{fieldErrors.email}</p>}</div>
          <div className="public-field"><label htmlFor="register-password">Password</label><div className={`public-input-wrap ${fieldErrors.password ? "has-error" : ""}`}><LockKeyhole size={17} aria-hidden="true"/><input id="register-password" name="password" type={showPassword ? "text" : "password"} autoComplete="new-password" placeholder="At least 8 characters" value={form.password} onChange={handleChange} minLength={8} required aria-invalid={Boolean(fieldErrors.password)} aria-describedby={fieldErrors.password ? "register-password-error" : undefined}/><button type="button" className="public-password-toggle" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button></div>{fieldErrors.password && <p id="register-password-error" role="alert" className="public-field-error">{fieldErrors.password}</p>}</div>
          <div className="public-field"><label htmlFor="register-confirm-password">Confirm password</label><div className={`public-input-wrap ${fieldErrors.confirmPassword ? "has-error" : ""}`}><LockKeyhole size={17} aria-hidden="true"/><input id="register-confirm-password" name="confirmPassword" type={showPassword ? "text" : "password"} autoComplete="new-password" placeholder="Re-enter your password" value={form.confirmPassword} onChange={handleChange} required aria-invalid={Boolean(fieldErrors.confirmPassword)} aria-describedby={fieldErrors.confirmPassword ? "register-confirm-password-error" : undefined}/></div>{fieldErrors.confirmPassword && <p id="register-confirm-password-error" role="alert" className="public-field-error">{fieldErrors.confirmPassword}</p>}</div>
          <button className="public-button public-auth-submit" type="submit" disabled={loading}>{loading ? <LoaderCircle size={17} className="public-spinner"/> : null}{loading ? "Creating account…" : "Create account"}{!loading && <ArrowRight size={16}/>}</button>
        </form>
        <p className="public-auth-switch">Already have an account? <button type="button" onClick={() => onNavigate?.("login")}>Sign in</button></p>
      </section>
      <p className="public-auth-footnote">No demos or sample workspaces. Start with your own team.</p>
    </div>
  </main>;
}
