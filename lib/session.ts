"use client";

import { useMemo, useSyncExternalStore } from "react";

export type UserSession = {
  token: string;
  role: string;
  Name?: string;
  email?: string;
  siteId?: string | null;
};

export function dashboardPathForRole(role: string) {
  switch (role) {
    case "admin": return "/admin/dashboard";
    case "factory_manager": return "/dashboard";
    case "manager": return "/manager/dashboard";
    case "site_engineer": return "/site/dashboard";
    default: return "/dashboard";
  }
}

const sessionKey = "vkenterprise.session";
const sessionEvent = "vkenterprise-session-change";

function subscribe(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  window.addEventListener(sessionEvent, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(sessionEvent, callback);
  };
}

function getSnapshot() {
  try {
    return sessionStorage.getItem(sessionKey);
  } catch {
    return null;
  }
}

function getServerSnapshot() {
  return null;
}

export function useStoredSession() {
  const storedValue = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const session = useMemo(() => {
    if (!storedValue) return null;
    try {
      const parsed = JSON.parse(storedValue) as UserSession;
      return typeof parsed.token === "string" && parsed.token ? parsed : null;
    } catch {
      return null;
    }
  }, [storedValue]);

  return { session, ready: storedValue !== null };
}

export function saveStoredSession(session: UserSession) {
  sessionStorage.setItem(sessionKey, JSON.stringify(session));
  window.dispatchEvent(new Event(sessionEvent));
}

export function clearStoredSession() {
  sessionStorage.removeItem(sessionKey);
  window.dispatchEvent(new Event(sessionEvent));
}
