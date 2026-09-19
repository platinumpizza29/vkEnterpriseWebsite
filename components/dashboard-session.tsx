"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useStoredSession, type UserSession } from "@/lib/session";

export type DashboardSession = UserSession;

const DashboardSessionContext = createContext<DashboardSession | null>(null);
const DashboardSessionReadyContext = createContext(false);

export function DashboardSessionProvider({ children }: { children: ReactNode }) {
  const { session, ready } = useStoredSession();

  return (
    <DashboardSessionReadyContext.Provider value={ready}>
      <DashboardSessionContext.Provider value={session}>
        {children}
      </DashboardSessionContext.Provider>
    </DashboardSessionReadyContext.Provider>
  );
}

export function useDashboardSession() {
  return useContext(DashboardSessionContext);
}

export function useDashboardSessionReady() {
  return useContext(DashboardSessionReadyContext);
}
