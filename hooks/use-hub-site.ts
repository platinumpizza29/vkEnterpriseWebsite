"use client";

import { useSites } from "@/hooks/use-sites";

export type HubSite = {
  id: string;
  name: string;
  code?: string;
  is_hub: boolean;
};

export function useHubSite() {
  const query = useSites();
  const hubSite = query.data?.find((site) => site.is_hub === true) ?? null;

  return {
    ...query,
    data: hubSite,
    hubSite,
    hubSiteId: hubSite?.id ?? null,
  };
}
