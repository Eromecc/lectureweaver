import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";

import type { ModelAnalysis, SourceChunk } from "@/domain";

import {
  invalidProviderOutput,
  ProviderRequestError,
  providerHttpError,
} from "./errors";
import { ANALYSIS_INSTRUCTIONS, buildAnalysisInput } from "./prompt";
import {
  ModelAnalysisWireSchema,
  parseModelAnalysisWire,
} from "./wire";

const PROVIDER_TIMEOUT_MS = 55_000;
const MAX_MODEL_OUTPUT_TOKENS = 12_000;

export type OpenAIInvocation = {
  apiKey: string;
  model: string;
  chunks: SourceChunk[];
};

export type OpenAIInvoker = (
  invocation: OpenAIInvocation,
) => Promise<unknown>;

export type OpenAIParsedResponseLike = {
  status?: string;
  incomplete_details: { reason?: string } | null;
  output_parsed: unknown | null;
  output: readonly unknown[];
};

function hasRefusal(output: readonly unknown[]): boolean {
  return output.some((item) => {
    if (typeof item !== "object" || item === null) return false;
    const record = item as Record<string, unknown>;
    if (record.type !== "message" || !Array.isArray(record.content)) {
      return false;
    }
    return record.content.some(
      (content) =>
        typeof content === "object" &&
        content !== null &&
        (content as Record<string, unknown>).type === "refusal",
    );
  });
}

export function interpretOpenAIResponse(
  response: OpenAIParsedResponseLike,
): unknown {
  if (response.status === "incomplete") {
    if (response.incomplete_details?.reason === "content_filter") {
      throw new ProviderRequestError(
        "provider_refusal",
        "OpenAI declined to analyze these sources.",
        422,
        false,
      );
    }
    throw invalidProviderOutput("OpenAI");
  }

  if (response.status === "failed") {
    throw new ProviderRequestError(
      "provider_error",
      "OpenAI could not complete the analysis request.",
      502,
      true,
    );
  }

  if (response.output_parsed !== null) return response.output_parsed;

  if (hasRefusal(response.output)) {
    throw new ProviderRequestError(
      "provider_refusal",
      "OpenAI declined to analyze these sources.",
      422,
      false,
    );
  }
  throw invalidProviderOutput("OpenAI");
}

export const invokeOpenAIResponses: OpenAIInvoker = async ({
  apiKey,
  model,
  chunks,
}) => {
  const client = new OpenAI({
    apiKey,
    maxRetries: 0,
    timeout: PROVIDER_TIMEOUT_MS,
  });

  const response = await client.responses.parse({
    model,
    instructions: ANALYSIS_INSTRUCTIONS,
    input: buildAnalysisInput(chunks),
    store: false,
    max_output_tokens: MAX_MODEL_OUTPUT_TOKENS,
    text: {
      format: zodTextFormat(
        ModelAnalysisWireSchema,
        "lectureweaver_analysis",
      ),
    },
  });

  return interpretOpenAIResponse(response);
};

export async function analyzeWithOpenAI(
  invocation: OpenAIInvocation,
  invoke: OpenAIInvoker = invokeOpenAIResponses,
): Promise<ModelAnalysis> {
  try {
    return parseModelAnalysisWire(await invoke(invocation));
  } catch (error: unknown) {
    if (error instanceof ProviderRequestError) throw error;
    if (error instanceof OpenAI.APIConnectionTimeoutError) {
      throw new ProviderRequestError(
        "provider_timeout",
        "OpenAI did not finish within the analysis time limit.",
        504,
        true,
      );
    }
    if (error instanceof OpenAI.APIConnectionError) {
      throw new ProviderRequestError(
        "provider_error",
        "OpenAI could not be reached.",
        502,
        true,
      );
    }
    if (error instanceof OpenAI.APIError && error.status !== undefined) {
      throw providerHttpError("OpenAI", error.status, [
        error.code ?? "",
        error.type ?? "",
      ]);
    }
    throw invalidProviderOutput("OpenAI");
  }
}
