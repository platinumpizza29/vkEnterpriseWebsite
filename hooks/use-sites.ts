"use client";

import { useQuery } from "@tanstack/react-query";
import { useDashboardSession } from "@/components/dashboard-session";
import { apiGet } from "@/lib/api";

export type SiteOption = { id: string; name: string; code?: string; is_hub?: boolean; is_active?: boolean; address?: string; latitude?: number | null; longitude?: number | null; created_at?: string; updated_at?: string };

function asArray<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    for (const key of ["sites", "items", "data"]) if (Array.isArray(record[key])) return record[key] as T[];
  }
  return [];
}

export function useSites() {
  const session = useDashboardSession();
  return useQuery({
    queryKey: ["sites"],
    queryFn: async () => asArray<Record<string, unknown>>(await apiGet<unknown>("/sites", session!.token)).map((site) => ({
      id: String(site.id ?? site.ID ?? ""),
      name: String(site.name ?? site.Name ?? "Unknown site"),
      code: String(site.code ?? site.Code ?? ""),
      is_hub: Boolean(site.is_hub ?? site.IsHub),
      is_active: site.is_active === true || site.IsActive === true,
      address: String(site.address ?? site.Address ?? ""),
      latitude: site.latitude == null && site.Latitude == null ? null : Number(site.latitude ?? site.Latitude),
      longitude: site.longitude == null && site.Longitude == null ? null : Number(site.longitude ?? site.Longitude),
      created_at: String(site.created_at ?? site.CreatedAt ?? ""),
      updated_at: String(site.updated_at ?? site.UpdatedAt ?? ""),
    })).filter((site) => site.id),
    enabled: Boolean(session?.token),
    staleTime: 5 * 60_000,
    retry: false,
  });
}
