"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useStoredSession } from "@/lib/session";
import { API_BASE_URL } from "@/lib/api";

const roles = [
  { value: "admin", label: "Administrator" },
  { value: "manager", label: "Manager" },
  { value: "factory_manager", label: "Factory manager" },
  { value: "site_engineer", label: "Site engineer" },
];

export default function RegisterPage() {
  const { session: storedSession, ready: checkingSessionDone } = useStoredSession();
  const session = storedSession?.role === "admin" ? storedSession : null;
  const checkingSession = !checkingSessionDone;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("site_engineer");
  const [siteId, setSiteId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) return;
    setError("");
    setSuccess("");
    setIsLoading(true);

    try {
      const response = await fetch(
        `${API_BASE_URL}/register`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.token}`,
          },
          body: JSON.stringify({
            name,
            email,
            password,
            role,
            ...(siteId.trim() ? { site_id: siteId.trim() } : {}),
          }),
        },
      );
      const result = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        throw new Error(result.error || "We couldn’t create this account. Check the details and try again.");
      }

      setSuccess(`Account created for ${name}.`);
      setName("");
      setEmail("");
      setPassword("");
      setSiteId("");
      setRole("site_engineer");
    } catch (submitError) {
      setError(
        submitError instanceof TypeError
          ? "Unable to reach the server. Check your connection and try again."
          : submitError instanceof Error
            ? submitError.message
            : "Something went wrong. Please try again.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="brand-panel" aria-label="VK Enterprise">
        <div className="brand-panel__grid" aria-hidden="true" />
        <div className="brand-panel__content">
          <Link className="brand" href="/" aria-label="VK Enterprise sign in">
            <span className="brand__mark" aria-hidden="true"><span /><span /><span /></span>
            <span className="brand__name">VK<span>ENTERPRISE</span></span>
          </Link>
          <div className="brand-copy">
            <span className="eyebrow"><span className="eyebrow__line" /> WORKSPACE ADMINISTRATION</span>
            <h1>Good teams<br />build great<br /><span>things.</span></h1>
            <p>Give every teammate the right access to keep your projects moving forward.</p>
          </div>
          <div className="site-card" aria-hidden="true">
            <div className="site-card__top"><span className="site-card__label">TEAM ACCESS</span><span className="live-indicator"><i /> ADMIN CONTROL</span></div>
            <div className="site-card__main">
              <div className="site-card__icon"><svg viewBox="0 0 24 24" fill="none"><path d="M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20m6-9a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm8-6.5a3.5 3.5 0 0 1 0 6.8m2 4.2a3.5 3.5 0 0 1 2 3.2V20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg></div>
              <div><strong>People &amp; permissions</strong><span>Set roles for your organization</span></div>
              <svg className="site-card__arrow" viewBox="0 0 24 24" fill="none"><path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
            <div className="site-card__bottom"><span>ADMIN</span><span>MANAGER</span><span>FIELD TEAM</span></div>
          </div>
        </div>
        <div className="brand-panel__footer"><span>© 2026 VK Enterprise</span><span>Operations, connected.</span></div>
      </section>

      <section className="form-panel">
        <div className="form-panel__top">
          <span className="form-panel__secure"><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><rect x="4.25" y="8.25" width="11.5" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.4" /><path d="M6.75 8V5.75a3.25 3.25 0 0 1 6.5 0V8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg> ADMIN ACCESS</span>
          <span className="form-panel__help">Already have an account? <Link href="/">Sign in</Link></span>
        </div>

        <div className="login-card register-card">
          <div className="mobile-brand brand" aria-label="VK Enterprise">
            <span className="brand__mark" aria-hidden="true"><span /><span /><span /></span>
            <span className="brand__name">VK<span>ENTERPRISE</span></span>
          </div>
          <div className="login-heading">
            <span className="login-heading__overline">TEAM MANAGEMENT</span>
            <h2>Create an<br />account</h2>
            <p>Add a teammate to your VK Enterprise workspace.</p>
          </div>

          {checkingSession ? (
            <p className="form-hint" role="status">Checking administrator access…</p>
          ) : !session ? (
            <div className="access-notice" role="status">
              <strong>Administrator sign-in required</strong>
              <p>Sign in with an administrator account to create user accounts.</p>
              <Link href="/">Go to sign in <span aria-hidden="true">→</span></Link>
            </div>
          ) : (
            <form className="login-form register-form" onSubmit={handleSubmit}>
              <label className="field-label" htmlFor="name">Full name</label>
              <div className="input-wrap">
                <svg className="input-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="10" cy="6.25" r="3" stroke="currentColor" strokeWidth="1.4" /><path d="M4.25 17a5.75 5.75 0 0 1 11.5 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
                <input id="name" name="name" type="text" autoComplete="name" placeholder="Teammate’s full name" value={name} onChange={(event) => setName(event.target.value)} required />
              </div>

              <label className="field-label" htmlFor="register-email">Work email</label>
              <div className="input-wrap">
                <svg className="input-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true"><rect x="2.75" y="4.25" width="14.5" height="11.5" rx="2" stroke="currentColor" strokeWidth="1.4" /><path d="m3.5 5.5 6.5 5 6.5-5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                <input id="register-email" name="email" type="email" autoComplete="email" placeholder="teammate@company.com" value={email} onChange={(event) => setEmail(event.target.value)} required />
              </div>

              <label className="field-label" htmlFor="register-password">Temporary password</label>
              <div className="input-wrap">
                <svg className="input-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true"><rect x="3.25" y="8.25" width="13.5" height="9" rx="2" stroke="currentColor" strokeWidth="1.4" /><path d="M6.25 8V5.75a3.75 3.75 0 0 1 7.5 0V8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /><circle cx="10" cy="12.5" r="1" fill="currentColor" /></svg>
                <input id="register-password" name="password" type="password" autoComplete="new-password" placeholder="Create a password" value={password} onChange={(event) => setPassword(event.target.value)} required />
              </div>

              <label className="field-label" htmlFor="role">Workspace role</label>
              <div className="input-wrap select-wrap">
                <svg className="input-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M3 16.5h14M4.5 16.5V7l5.5-3.5L15.5 7v9.5M7 16.5v-5h6v5M4.5 7h11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                <select id="role" name="role" value={role} onChange={(event) => setRole(event.target.value)}>
                  {roles.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
                <svg className="select-chevron" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m6 8 4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </div>

              <label className="field-label" htmlFor="site-id">Site ID <span className="optional-label">OPTIONAL</span></label>
              <div className="input-wrap">
                <svg className="input-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M16.25 8.4c0 4.1-6.25 8.1-6.25 8.1S3.75 12.5 3.75 8.4a6.25 6.25 0 1 1 12.5 0Z" stroke="currentColor" strokeWidth="1.4" /><circle cx="10" cy="8.25" r="2" stroke="currentColor" strokeWidth="1.4" /></svg>
                <input id="site-id" name="site_id" type="text" placeholder="Paste the site UUID" value={siteId} onChange={(event) => setSiteId(event.target.value)} />
              </div>
              <p className="site-id-hint">Assign this user to a site, or leave blank for no site assignment.</p>

              {error && <p className="form-error" role="alert">{error}</p>}
              {success && <p className="form-success" role="status">{success}</p>}

              <button className="submit-button" type="submit" disabled={isLoading}>
                <span>{isLoading ? "Creating account…" : "Create account"}</span>
                {!isLoading && <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4 10h12m-5-5 5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                {isLoading && <span className="spinner" aria-hidden="true" />}
              </button>
            </form>
          )}

          {session && <div className="login-divider"><span /> <span>ADMINISTRATOR ACTION</span> <span /></div>}
          <p className="login-note"><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M10 2.5 3.5 5v4.2c0 4 2.7 6.8 6.5 8.3 3.8-1.5 6.5-4.3 6.5-8.3V5L10 2.5Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /><path d="m7.5 10 1.7 1.7 3.5-3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg> Account access is managed by your administrator.</p>
        </div>
        <div className="form-panel__footer"><span>VK Enterprise Platform</span><span><i /> SYSTEM OPERATIONAL</span></div>
      </section>
    </main>
  );
}
