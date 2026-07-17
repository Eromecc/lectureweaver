import type { ProviderId } from "@/domain";

export const PROVIDER_LABELS: Record<ProviderId, string> = {
  openai: "OpenAI",
  deepseek: "DeepSeek",
  kimi: "Kimi",
};

export function getProviderLabel(provider: ProviderId): string {
  return PROVIDER_LABELS[provider];
}

export type KimiRegion = "cn" | "global";

export function resolveKimiRegion(
  value: string | undefined,
): KimiRegion | null {
  const normalized = value?.trim().toLowerCase();
  if (normalized === undefined || normalized.length === 0) return "cn";
  return normalized === "cn" || normalized === "global" ? normalized : null;
}
