import type {
  AnalyzeRequest,
  AnalyzeSuccess,
  AnalysisOutputOptions,
  ModelAnalysis,
  ProviderId,
  SourceChunk,
} from "@/domain";
import { validateModelAnalysisAgainstChunks } from "@/lib/analysis";

import {
  getPublicProviderCatalog,
  isAllowedAnalysisTarget,
} from "./catalog";
import { analyzeWithChatCompletions } from "./chat-completions";
import {
  invalidProviderOutput,
  ProviderRequestError,
} from "./errors";
import { analyzeWithOpenAI } from "./openai";
import { resolveKimiRegion } from "./providers";

type Environment = Readonly<Record<string, string | undefined>>;

export type ProviderAnalyzerInput = {
  provider: ProviderId;
  apiKey: string;
  baseUrl?: string;
  model: string;
  chunks: SourceChunk[];
  outputs: AnalysisOutputOptions;
};

export type ProviderAnalyzer = (
  input: ProviderAnalyzerInput,
) => Promise<ModelAnalysis>;

export type ProviderAnalyzers = Record<ProviderId, ProviderAnalyzer>;

const KIMI_BASE_URLS = {
  cn: "https://api.moonshot.cn/v1",
  global: "https://api.moonshot.ai/v1",
} as const;

const DEFAULT_ANALYZERS: ProviderAnalyzers = {
  openai: ({ apiKey, model, chunks, outputs }) =>
    analyzeWithOpenAI({ apiKey, model, chunks, outputs }),
  deepseek: ({ apiKey, baseUrl, model, chunks, outputs }) =>
    analyzeWithChatCompletions({
      provider: "deepseek",
      apiKey,
      baseUrl: baseUrl ?? "https://api.deepseek.com",
      model,
      chunks,
      outputs,
    }),
  kimi: ({ apiKey, baseUrl, model, chunks, outputs }) =>
    analyzeWithChatCompletions({
      provider: "kimi",
      apiKey,
      baseUrl: baseUrl ?? KIMI_BASE_URLS.cn,
      model,
      chunks,
      outputs,
    }),
};

function runtimeConfig(
  provider: ProviderId,
  environment: Environment,
): {
  apiKey: string | undefined;
  baseUrl?: string;
  configurationError?: string;
} {
  if (provider === "openai") {
    return { apiKey: environment.OPENAI_API_KEY?.trim() };
  }
  if (provider === "deepseek") {
    return {
      apiKey: environment.DEEPSEEK_API_KEY?.trim(),
      baseUrl: "https://api.deepseek.com",
    };
  }

  const region = resolveKimiRegion(environment.KIMI_REGION);
  if (region === null) {
    return {
      apiKey: environment.KIMI_API_KEY?.trim(),
      configurationError: "KIMI_REGION must be either cn or global.",
    };
  }
  return {
    apiKey: environment.KIMI_API_KEY?.trim(),
    baseUrl: region === "global" ? KIMI_BASE_URLS.global : KIMI_BASE_URLS.cn,
  };
}

export async function analyzeWithSelectedProvider(
  request: AnalyzeRequest,
  environment: Environment = process.env,
  analyzers: ProviderAnalyzers = DEFAULT_ANALYZERS,
): Promise<AnalyzeSuccess> {
  const target = { provider: request.provider, model: request.model };
  const catalog = getPublicProviderCatalog(environment);
  if (!isAllowedAnalysisTarget(target, catalog)) {
    throw new ProviderRequestError(
      "unsupported_model",
      "The selected provider/model combination is not allowed by this deployment.",
      400,
      false,
    );
  }

  const config = runtimeConfig(request.provider, environment);
  if (config.configurationError !== undefined) {
    throw new ProviderRequestError(
      "provider_not_configured",
      "The selected model provider has an invalid server configuration.",
      503,
      false,
    );
  }
  if (config.apiKey === undefined || config.apiKey.length === 0) {
    throw new ProviderRequestError(
      "provider_not_configured",
      "The selected model provider is not configured on this deployment.",
      503,
      false,
    );
  }

  try {
    const analysis = await analyzers[request.provider]({
      provider: request.provider,
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      model: request.model,
      chunks: request.chunks,
      outputs: request.outputs,
    });
    const validated = validateModelAnalysisAgainstChunks(
      analysis,
      request.chunks,
      request.outputs,
    );
    return {
      provider: request.provider,
      model: request.model,
      analysis: validated.analysis,
    };
  } catch (error: unknown) {
    if (error instanceof ProviderRequestError) throw error;
    throw invalidProviderOutput(
      catalog.providers.find((provider) => provider.id === request.provider)
        ?.label ?? request.provider,
    );
  }
}
