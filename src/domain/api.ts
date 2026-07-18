import { z } from "zod";

import {
  MAX_CHUNK_CHARACTERS,
  MAX_EXTRACTED_CHARACTERS,
  MAX_SOURCE_CHUNKS,
} from "./limits";
import { ModelAnalysisSchema, SourceChunkListSchema, SourceTypeSchema } from "./schema";

const nonEmptyText = z.string().trim().min(1);
const MAX_CHUNK_ID_CHARACTERS = 160;
const MAX_SOURCE_NAME_CHARACTERS = 512;
const MAX_LOCATOR_CHARACTERS = 240;
const MAX_HEADING_DEPTH = 6;
const MAX_HEADING_CHARACTERS = 240;
const MAX_REQUEST_METADATA_CHARACTERS = 32_000;
const modelId = nonEmptyText
  .max(128)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/, "Invalid model id.");

export const ProviderIdSchema = z.enum(["openai", "deepseek", "kimi"]);
export const CredentialModeSchema = z.enum(["deployment", "session"]);
export const KimiRegionSchema = z.enum(["cn", "global"]);

export const AnalysisTargetSchema = z
  .object({
    provider: ProviderIdSchema,
    model: modelId,
  })
  .strict();

export const AnalysisOutputOptionsSchema = z
  .object({
    ankiCards: z.boolean(),
  })
  .strict();

export const ProviderModelSchema = z
  .object({
    id: modelId,
    label: nonEmptyText.max(80),
    description: nonEmptyText.max(240),
  })
  .strict();

export const PublicProviderSchema = z
  .object({
    id: ProviderIdSchema,
    label: nonEmptyText.max(80),
    description: nonEmptyText.max(240),
    configured: z.boolean(),
    defaultModel: modelId,
    models: z.array(ProviderModelSchema).min(1).max(12),
  })
  .strict()
  .superRefine((provider, context) => {
    const ids = new Set<string>();
    provider.models.forEach((model, index) => {
      if (ids.has(model.id)) {
        context.addIssue({
          code: "custom",
          message: `Duplicate model id: ${model.id}.`,
          path: ["models", index, "id"],
        });
      }
      ids.add(model.id);
    });

    if (!ids.has(provider.defaultModel)) {
      context.addIssue({
        code: "custom",
        message: "The default model must appear in the provider model list.",
        path: ["defaultModel"],
      });
    }
  });

export const PublicProviderCatalogSchema = z
  .object({
    providers: z.array(PublicProviderSchema).min(1).max(3),
  })
  .strict()
  .superRefine((catalog, context) => {
    const ids = new Set<string>();
    catalog.providers.forEach((provider, index) => {
      if (ids.has(provider.id)) {
        context.addIssue({
          code: "custom",
          message: `Duplicate provider id: ${provider.id}.`,
          path: ["providers", index, "id"],
        });
      }
      ids.add(provider.id);
    });
  });

export const AnalyzeRequestSchema = z
  .object({
    provider: ProviderIdSchema,
    model: modelId,
    credentialMode: CredentialModeSchema,
    kimiRegion: KimiRegionSchema.optional(),
    outputs: AnalysisOutputOptionsSchema,
    chunks: SourceChunkListSchema.min(3).max(MAX_SOURCE_CHUNKS),
  })
  .strict()
  .superRefine((request, context) => {
    if (
      request.provider === "kimi" &&
      request.credentialMode === "session" &&
      request.kimiRegion === undefined
    ) {
      context.addIssue({
        code: "custom",
        message: "Temporary Kimi credentials require an explicit region.",
        path: ["kimiRegion"],
      });
    }
    if (
      request.kimiRegion !== undefined &&
      (request.provider !== "kimi" || request.credentialMode !== "session")
    ) {
      context.addIssue({
        code: "custom",
        message: "Kimi region is only valid with a temporary Kimi credential.",
        path: ["kimiRegion"],
      });
    }

    const chunkIds = new Set<string>();
    const sourceTypes = new Set<z.infer<typeof SourceTypeSchema>>();
    let totalCharacters = 0;
    let totalMetadataCharacters = 0;

    request.chunks.forEach((chunk, index) => {
      if (chunkIds.has(chunk.id)) {
        context.addIssue({
          code: "custom",
          message: `Duplicate source chunk id: ${chunk.id}.`,
          path: ["chunks", index, "id"],
        });
      }
      chunkIds.add(chunk.id);
      sourceTypes.add(chunk.sourceType);
      totalCharacters += chunk.text.length;
      totalMetadataCharacters +=
        chunk.id.length +
        chunk.sourceName.length +
        chunk.locator.length +
        (chunk.headingPath?.reduce(
          (total, heading) => total + heading.length,
          0,
        ) ?? 0);

      if (chunk.id.length > MAX_CHUNK_ID_CHARACTERS) {
        context.addIssue({
          code: "custom",
          message: `Chunk ids cannot exceed ${MAX_CHUNK_ID_CHARACTERS} characters.`,
          path: ["chunks", index, "id"],
        });
      }
      if (chunk.sourceName.length > MAX_SOURCE_NAME_CHARACTERS) {
        context.addIssue({
          code: "custom",
          message: `Source names cannot exceed ${MAX_SOURCE_NAME_CHARACTERS} characters.`,
          path: ["chunks", index, "sourceName"],
        });
      }
      if (chunk.locator.length > MAX_LOCATOR_CHARACTERS) {
        context.addIssue({
          code: "custom",
          message: `Locators cannot exceed ${MAX_LOCATOR_CHARACTERS} characters.`,
          path: ["chunks", index, "locator"],
        });
      }
      if ((chunk.headingPath?.length ?? 0) > MAX_HEADING_DEPTH) {
        context.addIssue({
          code: "custom",
          message: `Heading paths cannot exceed ${MAX_HEADING_DEPTH} levels.`,
          path: ["chunks", index, "headingPath"],
        });
      }
      chunk.headingPath?.forEach((heading, headingIndex) => {
        if (heading.length > MAX_HEADING_CHARACTERS) {
          context.addIssue({
            code: "custom",
            message: `Headings cannot exceed ${MAX_HEADING_CHARACTERS} characters.`,
            path: ["chunks", index, "headingPath", headingIndex],
          });
        }
      });

      if (chunk.text.length > MAX_CHUNK_CHARACTERS) {
        context.addIssue({
          code: "custom",
          message: `Source chunks cannot exceed ${MAX_CHUNK_CHARACTERS} characters.`,
          path: ["chunks", index, "text"],
        });
      }
    });

    for (const sourceType of SourceTypeSchema.options) {
      if (!sourceTypes.has(sourceType)) {
        context.addIssue({
          code: "custom",
          message: `At least one ${sourceType} chunk is required.`,
          path: ["chunks"],
        });
      }
    }

    if (totalCharacters > MAX_EXTRACTED_CHARACTERS) {
      context.addIssue({
        code: "custom",
        message: `Source text cannot exceed ${MAX_EXTRACTED_CHARACTERS} characters.`,
        path: ["chunks"],
      });
    }

    if (totalMetadataCharacters > MAX_REQUEST_METADATA_CHARACTERS) {
      context.addIssue({
        code: "custom",
        message: "Source metadata exceeds the live-analysis limit.",
        path: ["chunks"],
      });
    }
  });

export const AnalyzeSuccessSchema = z
  .object({
    provider: ProviderIdSchema,
    model: modelId,
    analysis: ModelAnalysisSchema,
  })
  .strict();

export const AnalyzeErrorCodeSchema = z.enum([
  "invalid_request",
  "request_too_large",
  "provider_not_configured",
  "unsupported_model",
  "provider_auth",
  "provider_balance",
  "rate_limited",
  "provider_timeout",
  "provider_refusal",
  "provider_invalid_output",
  "provider_error",
  "internal_error",
]);

export const AnalyzeErrorSchema = z
  .object({
    error: z
      .object({
        code: AnalyzeErrorCodeSchema,
        message: nonEmptyText.max(500),
        retryable: z.boolean(),
      })
      .strict(),
  })
  .strict();

export type ProviderId = z.infer<typeof ProviderIdSchema>;
export type CredentialMode = z.infer<typeof CredentialModeSchema>;
export type KimiRegion = z.infer<typeof KimiRegionSchema>;
export type AnalysisTarget = z.infer<typeof AnalysisTargetSchema>;
export type AnalysisOutputOptions = z.infer<typeof AnalysisOutputOptionsSchema>;
export type ProviderModel = z.infer<typeof ProviderModelSchema>;
export type PublicProvider = z.infer<typeof PublicProviderSchema>;
export type PublicProviderCatalog = z.infer<typeof PublicProviderCatalogSchema>;
export type AnalyzeRequest = z.infer<typeof AnalyzeRequestSchema>;
export type AnalyzeSuccess = z.infer<typeof AnalyzeSuccessSchema>;
export type AnalyzeErrorCode = z.infer<typeof AnalyzeErrorCodeSchema>;
export type AnalyzeError = z.infer<typeof AnalyzeErrorSchema>;
