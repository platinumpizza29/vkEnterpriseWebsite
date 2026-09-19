"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { dashboardPathForRole, saveStoredSession } from "@/lib/session";
import { API_BASE_URL } from "@/lib/api";

type LoginResponse = {
  siteId: string | null;
  role: string;
  Name: string;
  email: string;
  token: string;
  error?: string;
};

export default function Home() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch(
        `${API_BASE_URL}/login`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        },
      );
      const result = (await response.json()) as LoginResponse;

      if (!response.ok) {
        throw new Error(result.error || "We couldn’t sign you in. Check your details and try again.");
      }

      if (!result.token) {
        throw new Error("The server response was missing a sign-in token. Please try again.");
      }

      saveStoredSession(result);
      router.replace(dashboardPathForRole(result.role));
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
          <Link className="brand" href="/" aria-label="VK Enterprise home">
            <span className="brand__mark" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            <span className="brand__name">VK<span>ENTERPRISE</span></span>
          </Link>

          <div className="brand-copy">
            <span className="eyebrow"><span className="eyebrow__line" /> BUILT FOR THE FIELD</span>
            <h1>Every site.<br />Every detail.<br /><span>In sync.</span></h1>
            <p>One clear view of the people, materials, and progress moving your projects forward.</p>
          </div>

          <div className="site-card" aria-hidden="true">
            <div className="site-card__top">
              <span className="site-card__label">SITE OVERVIEW</span>
              <span className="live-indicator"><i /> LIVE</span>
            </div>
            <div className="site-card__main">
              <div className="site-card__icon">
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 20V9.5L12 4l8 5.5V20M8 20v-6h8v6M4 10h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /><path d="M10 10h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
              </div>
              <div><strong>Project operations</strong><span>All teams working together</span></div>
              <svg className="site-card__arrow" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
            <div className="site-card__bottom"><span>INVENTORY</span><span>ATTENDANCE</span><span>REPORTS</span></div>
          </div>
        </div>
        <div className="brand-panel__footer"><span>© 2026 VK Enterprise</span><span>Operations, connected.</span></div>
      </section>

      <section className="form-panel">
        <div className="form-panel__top">
          <span className="form-panel__secure"><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><rect x="4.25" y="8.25" width="11.5" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.4" /><path d="M6.75 8V5.75a3.25 3.25 0 0 1 6.5 0V8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg> SECURE WORKSPACE</span>
          <span className="form-panel__help">Need access? <a href="mailto:admin@vkenterprise.com">Contact your admin</a></span>
        </div>

        <div className="login-card">
          <div className="mobile-brand brand" aria-label="VK Enterprise">
            <span className="brand__mark" aria-hidden="true"><span /><span /><span /></span>
            <span className="brand__name">VK<span>ENTERPRISE</span></span>
          </div>
          <div className="login-heading">
            <span className="login-heading__overline">WELCOME BACK</span>
            <h2>Sign in to your<br />workspace</h2>
            <p>Enter your work email and password to continue.</p>
          </div>

          <form className="login-form" onSubmit={handleSubmit}>
            <label className="field-label" htmlFor="email">Work email</label>
            <div className="input-wrap">
              <svg className="input-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true"><rect x="2.75" y="4.25" width="14.5" height="11.5" rx="2" stroke="currentColor" strokeWidth="1.4" /><path d="m3.5 5.5 6.5 5 6.5-5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
              <input id="email" name="email" type="email" autoComplete="username" placeholder="you@company.com" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </div>

            <div className="password-label-row">
              <label className="field-label" htmlFor="password">Password</label>
              <a href="mailto:admin@vkenterprise.com?subject=Password%20help">Forgot password?</a>
            </div>
            <div className="input-wrap">
              <svg className="input-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true"><rect x="3.25" y="8.25" width="13.5" height="9" rx="2" stroke="currentColor" strokeWidth="1.4" /><path d="M6.25 8V5.75a3.75 3.75 0 0 1 7.5 0V8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /><circle cx="10" cy="12.5" r="1" fill="currentColor" /></svg>
              <input id="password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="Enter your password" value={password} onChange={(event) => setPassword(event.target.value)} required />
              <button className="password-toggle" type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Hide password" : "Show password"}>
                {showPassword ? <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M3 3l14 14M8.6 8.6a2 2 0 0 0 2.8 2.8M6.2 5.3A9.7 9.7 0 0 1 10 4.5c4.5 0 7.5 5.5 7.5 5.5a13 13 0 0 1-2.3 2.9M4.2 6.8A13 13 0 0 0 2.5 10s3 5.5 7.5 5.5c.8 0 1.5-.2 2.2-.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg> : <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M2.5 10S5.5 4.5 10 4.5s7.5 5.5 7.5 5.5-3 5.5-7.5 5.5S2.5 10 2.5 10Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /><circle cx="10" cy="10" r="2.25" stroke="currentColor" strokeWidth="1.4" /></svg>}
              </button>
            </div>

            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="submit-button" type="submit" disabled={isLoading}>
              <span>{isLoading ? "Signing in…" : "Sign in"}</span>
              {!isLoading && <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4 10h12m-5-5 5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
              {isLoading && <span className="spinner" aria-hidden="true" />}
            </button>
          </form>

          <div className="login-divider"><span /> <span>AUTHORIZED PERSONNEL ONLY</span> <span /></div>
          <p className="login-note"><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M10 2.5 3.5 5v4.2c0 4 2.7 6.8 6.5 8.3 3.8-1.5 6.5-4.3 6.5-8.3V5L10 2.5Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /><path d="m7.5 10 1.7 1.7 3.5-3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg> Your account is protected by secure authentication.</p>
        </div>

        <div className="form-panel__footer"><span>VK Enterprise Platform</span><span><i /> SYSTEM OPERATIONAL</span></div>
      </section>
    </main>
  );
}
