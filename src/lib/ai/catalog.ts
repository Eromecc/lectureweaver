import {
  AnalysisTargetSchema,
  PublicProviderCatalogSchema,
  type AnalysisTarget,
  type ProviderId,
  type ProviderModel,
  type PublicProviderCatalog,
} from "@/domain";

import { PROVIDER_LABELS, resolveKimiRegion } from "./providers";

type Environment = Readonly<Record<string, string | undefined>>;

const KNOWN_MODELS: Record<ProviderId, readonly ProviderModel[]> = {
  openai: [
    {
      id: "gpt-5.6",
      label: "GPT-5.6 Sol",
      description: "Flagship quality through the stable GPT-5.6 alias.",
    },
    {
      id: "gpt-5.6-terra",
      label: "GPT-5.6 Terra",
      description: "Balanced capability, latency, and cost.",
    },
    {
      id: "gpt-5.6-luna",
      label: "GPT-5.6 Luna",
      description: "Efficient option for lighter or higher-volume reviews.",
    },
  ],
  deepseek: [
    {
      id: "deepseek-v4-flash",
      label: "DeepSeek V4 Flash",
      description: "Fast, cost-conscious general analysis.",
    },
    {
      id: "deepseek-v4-pro",
      label: "DeepSeek V4 Pro",
      description: "Premium DeepSeek quality for harder comparisons.",
    },
  ],
  kimi: [
    {
      id: "kimi-k3",
      label: "Kimi K3",
      description: "Flagship long-context model with strict structured output.",
    },
    {
      id: "kimi-k2.6",
      label: "Kimi K2.6",
      description: "General-purpose alternative with a 256K context window.",
    },
  ],
};

const FALLBACK_MODELS: Record<ProviderId, string> = {
  openai: "gpt-5.6",
  deepseek: "deepseek-v4-flash",
  kimi: "kimi-k3",
};

function configuredModel(
  provider: ProviderId,
  value: string | undefined,
): string {
  const candidate = value?.trim() || FALLBACK_MODELS[provider];
  return AnalysisTargetSchema.safeParse({ provider, model: candidate }).success
    ? candidate
    : FALLBACK_MODELS[provider];
}

function modelsFor(provider: ProviderId, defaultModel: string): ProviderModel[] {
  const models = [...KNOWN_MODELS[provider]];
  if (!models.some((model) => model.id === defaultModel)) {
    models.unshift({
      id: defaultModel,
      label: defaultModel,
      description: "Deployment-configured model.",
    });
  }
  return models;
}

export function getPublicProviderCatalog(
  environment: Environment = process.env,
): PublicProviderCatalog {
  const openaiModel = configuredModel("openai", environment.OPENAI_MODEL);
  const deepseekModel = configuredModel(
    "deepseek",
    environment.DEEPSEEK_MODEL,
  );
  const kimiModel = configuredModel("kimi", environment.KIMI_MODEL);

  return PublicProviderCatalogSchema.parse({
    providers: [
      {
        id: "openai",
        label: PROVIDER_LABELS.openai,
        description: "Responses API with strict Structured Outputs.",
        configured: Boolean(environment.OPENAI_API_KEY?.trim()),
        defaultModel: openaiModel,
        models: modelsFor("openai", openaiModel),
      },
      {
        id: "deepseek",
        label: PROVIDER_LABELS.deepseek,
        description: "Chat Completions JSON mode with strict local validation.",
        configured: Boolean(environment.DEEPSEEK_API_KEY?.trim()),
        defaultModel: deepseekModel,
        models: modelsFor("deepseek", deepseekModel),
      },
      {
        id: "kimi",
        label: PROVIDER_LABELS.kimi,
        description: "Kimi Chat Completions with strict JSON Schema.",
        configured:
          Boolean(environment.KIMI_API_KEY?.trim()) &&
          resolveKimiRegion(environment.KIMI_REGION) !== null,
        defaultModel: kimiModel,
        models: modelsFor("kimi", kimiModel),
      },
    ],
  });
}

export const EMPTY_PROVIDER_CATALOG = getPublicProviderCatalog({});

export function isAllowedAnalysisTarget(
  target: AnalysisTarget,
  catalog: PublicProviderCatalog,
): boolean {
  const provider = catalog.providers.find((item) => item.id === target.provider);
  return provider?.models.some((model) => model.id === target.model) ?? false;
}
