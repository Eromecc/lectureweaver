import type {
  AnalysisOutputOptions,
  AssessmentStatus,
  EvidenceRef,
  Importance,
  ModelAnalysis,
  NoteChangeType,
  SourceChunk,
} from "@/domain";

import { parseModelAnalysisWire } from "./wire";

type DeepSeekParseOptions = {
  chunks: readonly SourceChunk[];
  outputs: AnalysisOutputOptions;
};

type NormalizedAssessment = {
  status: AssessmentStatus;
  evidenceRefs: EvidenceRef[];
};

const ASSESSMENT_STATUSES: readonly AssessmentStatus[] = [
  "covered",
  "partial",
  "missing",
  "contradiction",
];
const IMPORTANCE_VALUES: readonly Importance[] = ["core", "supporting"];
const NOTE_CHANGE_TYPES: readonly NoteChangeType[] = [
  "preserved",
  "expanded",
  "corrected",
  "new",
];
const CHANGE_TYPE_BY_STATUS: Readonly<Record<AssessmentStatus, NoteChangeType>> = {
  covered: "preserved",
  partial: "expanded",
  missing: "new",
  contradiction: "corrected",
};

const JSON_FENCE = /^```json[\t ]*\r?\n([\s\S]*)\r?\n```[\t ]*$/i;
const MARKDOWN_FENCE = /^\s{0,3}(`{3,}|~{3,})(.*)$/;
const ATX_TOP_LEVEL_HEADING = /^(\s{0,3})#{1,2}([\t ]+.*|[\t ]*)$/;

type FenceState = {
  marker: "`" | "~";
  length: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function normalizeKnownEnum<T extends string>(
  value: unknown,
  allowedValues: readonly T[],
): unknown {
  if (typeof value !== "string") return value;
  const normalized = value.trim().toLowerCase();
  return (
    allowedValues.find((candidate) => candidate.toLowerCase() === normalized) ??
    value
  );
}

function demoteTopLevelAtxHeadings(markdown: string): string {
  let fence: FenceState | null = null;

  return markdown
    .split("\n")
    .map((originalLine) => {
      const hasCarriageReturn = originalLine.endsWith("\r");
      const line = hasCarriageReturn ? originalLine.slice(0, -1) : originalLine;
      const fenceMatch = line.match(MARKDOWN_FENCE);
      const fenceRun = fenceMatch?.[1];
      const marker = fenceRun?.[0];

      if (fence !== null) {
        if (
          (marker === "`" || marker === "~") &&
          marker === fence.marker &&
          (fenceRun?.length ?? 0) >= fence.length &&
          !(fenceMatch?.[2] ?? "").trim()
        ) {
          fence = null;
        }
        return originalLine;
      }

      if ((marker === "`" || marker === "~") && fenceRun !== undefined) {
        fence = { marker, length: fenceRun.length };
        return originalLine;
      }

      const demoted = line.replace(ATX_TOP_LEVEL_HEADING, "$1###$2");
      return hasCarriageReturn ? `${demoted}\r` : demoted;
    })
    .join("\n");
}

function normalizeAssessment(value: unknown): unknown {
  if (!isRecord(value)) return value;

  const normalized: Record<string, unknown> = {
    ...value,
    importance: normalizeKnownEnum(value.importance, IMPORTANCE_VALUES),
    status: normalizeKnownEnum(value.status, ASSESSMENT_STATUSES),
  };

  if (typeof value.suggestedPatch === "string") {
    normalized.suggestedPatch = demoteTopLevelAtxHeadings(value.suggestedPatch);
  }

  if (
    normalized.status === "covered" &&
    (!hasOwn(value, "suggestedPatch") ||
      value.suggestedPatch === null ||
      (typeof value.suggestedPatch === "string" &&
        value.suggestedPatch.trim().length === 0))
  ) {
    normalized.suggestedPatch = null;
  }

  return normalized;
}

function canonicalEvidenceRefs(value: unknown): EvidenceRef[] | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined;

  const references: EvidenceRef[] = [];
  for (const reference of value) {
    if (!isRecord(reference)) return undefined;
    const keys = Object.keys(reference);
    if (
      keys.length !== 2 ||
      !hasOwn(reference, "chunkId") ||
      !hasOwn(reference, "relevance") ||
      typeof reference.chunkId !== "string" ||
      typeof reference.relevance !== "string"
    ) {
      return undefined;
    }
    const chunkId = reference.chunkId.trim();
    const relevance = reference.relevance.trim();
    if (chunkId.length === 0 || relevance.length === 0) return undefined;
    references.push({ chunkId, relevance });
  }

  return references;
}

function buildAssessmentIndex(
  assessments: unknown,
  trustedChunkIds: ReadonlySet<string>,
): ReadonlyMap<string, NormalizedAssessment> | undefined {
  if (!Array.isArray(assessments) || assessments.length === 0) return undefined;

  const index = new Map<string, NormalizedAssessment>();
  for (const assessment of assessments) {
    if (!isRecord(assessment) || typeof assessment.id !== "string") {
      return undefined;
    }
    const id = assessment.id.trim();
    const status = normalizeKnownEnum(
      assessment.status,
      ASSESSMENT_STATUSES,
    );
    const evidenceRefs = canonicalEvidenceRefs(assessment.evidenceRefs);
    if (
      id.length === 0 ||
      index.has(id) ||
      typeof status !== "string" ||
      !ASSESSMENT_STATUSES.includes(status as AssessmentStatus) ||
      evidenceRefs === undefined ||
      evidenceRefs.some((reference) => !trustedChunkIds.has(reference.chunkId))
    ) {
      return undefined;
    }
    index.set(id, {
      status: status as AssessmentStatus,
      evidenceRefs,
    });
  }

  return index;
}

function linkedAssessments(
  assessmentIdsInput: unknown,
  assessmentsById: ReadonlyMap<string, NormalizedAssessment>,
): NormalizedAssessment[] | undefined {
  if (!Array.isArray(assessmentIdsInput) || assessmentIdsInput.length === 0) {
    return undefined;
  }

  const seen = new Set<string>();
  const linked: NormalizedAssessment[] = [];
  for (const assessmentIdInput of assessmentIdsInput) {
    if (typeof assessmentIdInput !== "string") return undefined;
    const assessmentId = assessmentIdInput.trim();
    const assessment = assessmentsById.get(assessmentId);
    if (assessmentId.length === 0 || seen.has(assessmentId) || !assessment) {
      return undefined;
    }
    seen.add(assessmentId);
    linked.push(assessment);
  }
  return linked;
}

function orderedEvidenceUnion(
  assessments: readonly NormalizedAssessment[],
): EvidenceRef[] {
  const seen = new Set<string>();
  const union: EvidenceRef[] = [];

  for (const assessment of assessments) {
    for (const reference of assessment.evidenceRefs) {
      if (seen.has(reference.chunkId)) continue;
      seen.add(reference.chunkId);
      union.push({ ...reference });
    }
  }

  return union;
}

function canCanonicalizeArtifactEvidence(
  value: unknown,
  trustedChunkIds: ReadonlySet<string>,
): boolean {
  if (value === undefined || value === null) return true;
  if (!Array.isArray(value)) return false;
  if (value.length === 0) return true;

  const references = canonicalEvidenceRefs(value);
  return (
    references !== undefined &&
    references.every((reference) => trustedChunkIds.has(reference.chunkId))
  );
}

function normalizeSection(
  value: unknown,
  assessmentsById: ReadonlyMap<string, NormalizedAssessment> | undefined,
  trustedChunkIds: ReadonlySet<string>,
): unknown {
  if (!isRecord(value)) return value;

  const normalized: Record<string, unknown> = {
    ...value,
    changeType: normalizeKnownEnum(value.changeType, NOTE_CHANGE_TYPES),
  };
  if (typeof value.markdown === "string") {
    normalized.markdown = demoteTopLevelAtxHeadings(value.markdown);
  }
  if (assessmentsById === undefined) return normalized;

  const linked = linkedAssessments(value.assessmentIds, assessmentsById);
  if (linked === undefined) return normalized;

  const statuses = new Set(linked.map((assessment) => assessment.status));
  if (statuses.size === 1) {
    const status = linked[0]?.status;
    if (status !== undefined) normalized.changeType = CHANGE_TYPE_BY_STATUS[status];
  }

  if (canCanonicalizeArtifactEvidence(value.evidenceRefs, trustedChunkIds)) {
    normalized.evidenceRefs = orderedEvidenceUnion(linked);
  }

  return normalized;
}

function normalizeCard(
  value: unknown,
  assessmentsById: ReadonlyMap<string, NormalizedAssessment> | undefined,
  trustedChunkIds: ReadonlySet<string>,
): unknown {
  if (!isRecord(value) || assessmentsById === undefined) return value;

  const linked = linkedAssessments(value.assessmentIds, assessmentsById);
  if (linked === undefined) return value;

  return canCanonicalizeArtifactEvidence(value.evidenceRefs, trustedChunkIds)
    ? { ...value, evidenceRefs: orderedEvidenceUnion(linked) }
    : value;
}

function normalizeAnalysisObject(
  input: unknown,
  options: DeepSeekParseOptions,
): unknown {
  if (!isRecord(input)) return input;

  const rootKeys = Object.keys(input);
  const unwrapped =
    rootKeys.length === 1 &&
    rootKeys[0] === "analysis" &&
    isRecord(input.analysis)
      ? input.analysis
      : input;
  const trustedChunkIds = new Set(options.chunks.map((chunk) => chunk.id));

  const assessments = Array.isArray(unwrapped.assessments)
    ? unwrapped.assessments.map(normalizeAssessment)
    : unwrapped.assessments;
  const assessmentsById = buildAssessmentIndex(assessments, trustedChunkIds);

  const normalized: Record<string, unknown> = {
    ...unwrapped,
    assessments,
  };

  if (
    !options.outputs.ankiCards &&
    (!hasOwn(unwrapped, "ankiCards") || unwrapped.ankiCards === null)
  ) {
    normalized.ankiCards = [];
  }

  if (isRecord(unwrapped.enhancedNotes)) {
    const enhancedNotes: Record<string, unknown> = {
      ...unwrapped.enhancedNotes,
    };
    if (typeof unwrapped.enhancedNotes.overview === "string") {
      enhancedNotes.overview = demoteTopLevelAtxHeadings(
        unwrapped.enhancedNotes.overview,
      );
    }
    if (Array.isArray(unwrapped.enhancedNotes.sections)) {
      enhancedNotes.sections = unwrapped.enhancedNotes.sections.map((section) =>
        normalizeSection(section, assessmentsById, trustedChunkIds),
      );
    }
    normalized.enhancedNotes = enhancedNotes;
  }

  if (Array.isArray(normalized.ankiCards)) {
    normalized.ankiCards = normalized.ankiCards.map((card) =>
      normalizeCard(card, assessmentsById, trustedChunkIds),
    );
  }

  return normalized;
}

function parseDeepSeekJson(text: string): unknown {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    throw new SyntaxError("DeepSeek returned an empty response.");
  }

  const fenced = trimmed.match(JSON_FENCE);
  const json = fenced?.[1] ?? trimmed;
  return JSON.parse(json) as unknown;
}

export function parseDeepSeekAnalysisText(
  text: string,
  options: DeepSeekParseOptions,
): ModelAnalysis {
  return parseModelAnalysisWire(
    normalizeAnalysisObject(parseDeepSeekJson(text), options),
  );
}
