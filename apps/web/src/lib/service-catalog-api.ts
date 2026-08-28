import { apiFetch } from "@/lib/api";

/** Platform service catalog row from wallet-api. */
export type ServiceCatalogItem = {
  id: string;
  listKind: "x402" | "agent";
  name: string;
  description: string;
  url: string;
  status: string;
  sortOrder: number;
};

type CatalogResponse = {
  ok: true;
  items: ServiceCatalogItem[];
};

/**
 * Fetches active platform services for a list kind.
 * @param kind - `x402` or `agent`
 * @returns Active catalog rows
 */
export async function fetchServiceCatalog(
  kind: "x402" | "agent",
): Promise<ServiceCatalogItem[]> {
  const res = await apiFetch<CatalogResponse>(
    `/api/service-catalog?kind=${kind}`,
  );
  return res.items ?? [];
}
