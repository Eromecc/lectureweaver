import type {
  AnalyzeRequest,
  AnalyzeSuccess,
  AnalysisOutputOptions,
  KimiRegion,
  ModelAnalysis,
  OutputLanguage,
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
import {
  resolveSessionProviderKey,
  SessionProviderKeyError,
} from "./session-credential";

type Environment = Readonly<Record<string, string | undefined>>;

export type ProviderAnalyzerInput = {
  provider: ProviderId;
  apiKey: string;
  baseUrl?: string;
  model: string;
  chunks: SourceChunk[];
  outputs: AnalysisOutputOptions;
  outputLanguage: OutputLanguage;
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
  openai: ({ apiKey, model, chunks, outputs, outputLanguage }) =>
    analyzeWithOpenAI({ apiKey, model, chunks, outputs, outputLanguage }),
  deepseek: ({ apiKey, baseUrl, model, chunks, outputs, outputLanguage }) =>
    analyzeWithChatCompletions({
      provider: "deepseek",
      apiKey,
      baseUrl: baseUrl ?? "https://api.deepseek.com",
      model,
      chunks,
      outputs,
      outputLanguage,
    }),
  kimi: ({ apiKey, baseUrl, model, chunks, outputs, outputLanguage }) =>
    analyzeWithChatCompletions({
      provider: "kimi",
      apiKey,
      baseUrl: baseUrl ?? KIMI_BASE_URLS.cn,
      model,
      chunks,
      outputs,
      outputLanguage,
    }),
};

function runtimeConfig(
  provider: ProviderId,
  environment: Environment,
  sessionKimiRegion?: KimiRegion,
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

  if (sessionKimiRegion !== undefined) {
    return {
      apiKey: environment.KIMI_API_KEY?.trim(),
      baseUrl:
        sessionKimiRegion === "global"
          ? KIMI_BASE_URLS.global
          : KIMI_BASE_URLS.cn,
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
  sessionApiKey?: string,
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

  const { credentialMode } = request;
  let resolvedSessionApiKey: string | undefined;
  try {
    resolvedSessionApiKey = resolveSessionProviderKey(
      credentialMode,
      sessionApiKey,
    );
  } catch (error: unknown) {
    if (error instanceof SessionProviderKeyError) {
      throw new ProviderRequestError(
        "invalid_request",
        "The credential mode does not match a valid temporary provider credential.",
        400,
        false,
      );
    }
    throw error;
  }

  const config = runtimeConfig(
    request.provider,
    environment,
    credentialMode === "session" ? request.kimiRegion : undefined,
  );
  if (config.configurationError !== undefined) {
    throw new ProviderRequestError(
      "provider_not_configured",
      "The selected model provider has an invalid server configuration.",
      503,
      false,
    );
  }
  const apiKey =
    credentialMode === "session" ? resolvedSessionApiKey : config.apiKey;
  if (apiKey === undefined || apiKey.length === 0) {
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
      apiKey,
      baseUrl: config.baseUrl,
      model: request.model,
      chunks: request.chunks,
      outputs: request.outputs,
      outputLanguage: request.outputLanguage,
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
