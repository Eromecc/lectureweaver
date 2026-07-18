import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";

import type {
  AnalysisOutputOptions,
  ModelAnalysis,
  SourceChunk,
} from "@/domain";

import {
  invalidProviderOutput,
  ProviderRequestError,
  providerHttpError,
} from "./errors";
import { buildAnalysisInput, buildAnalysisInstructions } from "./prompt";
import { getProviderLabel } from "./providers";
import { ANALYSIS_PROVIDER_TIMEOUT_MS } from "./timeouts";
import {
  ModelAnalysisWireSchema,
  parseModelAnalysisText,
} from "./wire";

const MAX_PROVIDER_RESPONSE_BYTES = 250_000;
const MAX_PROVIDER_ERROR_BYTES = 32_000;
const MAX_MODEL_OUTPUT_TOKENS = 12_000;

const ChatCompletionEnvelopeSchema = z
  .object({
    choices: z
      .array(
        z
          .object({
            finish_reason: z.string().nullable().optional(),
            message: z
              .object({
                content: z.string().nullable(),
              })
              .passthrough(),
          })
          .passthrough(),
      )
      .min(1),
  })
  .passthrough();

const ProviderErrorEnvelopeSchema = z
  .object({
    error: z
      .object({
        code: z.union([z.string(), z.number()]).nullish(),
        type: z.union([z.string(), z.number()]).nullish(),
      })
      .passthrough(),
  })
  .passthrough();

type ChatProvider = "deepseek" | "kimi";

type ChatAnalysisOptions = {
  provider: ChatProvider;
  apiKey: string;
  baseUrl: string;
  model: string;
  chunks: SourceChunk[];
  outputs?: AnalysisOutputOptions;
  fetchImpl?: typeof fetch;
};

function requestBody(
  provider: ChatProvider,
  model: string,
  chunks: SourceChunk[],
  outputs: AnalysisOutputOptions,
): Record<string, unknown> {
  const messages = [
    { role: "system", content: buildAnalysisInstructions(outputs) },
    { role: "user", content: buildAnalysisInput(chunks, outputs) },
  ];

  if (provider === "deepseek") {
    return {
      model,
      messages,
      thinking: { type: "disabled" },
      response_format: { type: "json_object" },
      max_tokens: MAX_MODEL_OUTPUT_TOKENS,
      stream: false,
    };
  }

  return {
    model,
    messages,
    response_format: zodResponseFormat(
      ModelAnalysisWireSchema,
      "lectureweaver_analysis",
    ),
    max_completion_tokens: MAX_MODEL_OUTPUT_TOKENS,
    stream: false,
  };
}

function finishReasonError(
  providerLabel: string,
  finishReason: string | null | undefined,
): ProviderRequestError | undefined {
  if (finishReason === "length") {
    return invalidProviderOutput(providerLabel);
  }
  if (finishReason === "content_filter") {
    return new ProviderRequestError(
      "provider_refusal",
      `${providerLabel} declined to analyze these sources.`,
      422,
      false,
    );
  }
  if (finishReason === "insufficient_system_resource") {
    return new ProviderRequestError(
      "provider_error",
      `${providerLabel} temporarily lacks capacity for this analysis.`,
      503,
      true,
    );
  }
  return undefined;
}

async function readBoundedResponseText(
  response: Response,
  maxBytes: number,
): Promise<string | undefined> {
  if (response.body === null) return "";

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const parts: string[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel().catch(() => undefined);
        return undefined;
      }
      try {
        parts.push(decoder.decode(value, { stream: true }));
      } catch {
        await reader.cancel().catch(() => undefined);
        return undefined;
      }
    }
    try {
      parts.push(decoder.decode());
    } catch {
      return undefined;
    }
    return parts.join("");
  } finally {
    reader.releaseLock();
  }
}

function upstreamErrorIdentifiers(text: string | undefined): string[] {
  if (text === undefined || text.length === 0) return [];
  try {
    const parsed = ProviderErrorEnvelopeSchema.safeParse(
      JSON.parse(text) as unknown,
    );
    if (!parsed.success) return [];
    return [parsed.data.error.code, parsed.data.error.type]
      .filter((value): value is string | number => value != null)
      .map(String);
  } catch {
    return [];
  }
}

export async function analyzeWithChatCompletions({
  provider,
  apiKey,
  baseUrl,
  model,
  chunks,
  outputs = { ankiCards: false },
  fetchImpl = fetch,
}: ChatAnalysisOptions): Promise<ModelAnalysis> {
  const providerLabel = getProviderLabel(provider);
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    ANALYSIS_PROVIDER_TIMEOUT_MS,
  );

  try {
    const response = await fetchImpl(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody(provider, model, chunks, outputs)),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await readBoundedResponseText(
        response,
        MAX_PROVIDER_ERROR_BYTES,
      );
      throw providerHttpError(
        providerLabel,
        response.status,
        upstreamErrorIdentifiers(errorText),
      );
    }

    const responseText = await readBoundedResponseText(
      response,
      MAX_PROVIDER_RESPONSE_BYTES,
    );
    if (responseText === undefined) {
      throw invalidProviderOutput(providerLabel);
    }

    let envelope: z.infer<typeof ChatCompletionEnvelopeSchema>;
    try {
      envelope = ChatCompletionEnvelopeSchema.parse(
        JSON.parse(responseText) as unknown,
      );
    } catch {
      throw invalidProviderOutput(providerLabel);
    }

    const choice = envelope.choices[0];
    const finishError = finishReasonError(providerLabel, choice?.finish_reason);
    if (finishError !== undefined) throw finishError;

    try {
      return parseModelAnalysisText(choice?.message.content ?? "");
    } catch {
      throw invalidProviderOutput(providerLabel);
    }
  } catch (error: unknown) {
    if (error instanceof ProviderRequestError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ProviderRequestError(
        "provider_timeout",
        `${providerLabel} did not finish within the analysis time limit.`,
        504,
        true,
      );
    }
    throw new ProviderRequestError(
      "provider_error",
      `${providerLabel} could not be reached.`,
      502,
      true,
    );
  } finally {
    clearTimeout(timeout);
  }
}
