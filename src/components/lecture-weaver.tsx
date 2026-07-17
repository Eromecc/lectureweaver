"use client";

import type { ChangeEvent, DragEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronRight,
  CircleCheck,
  Clipboard,
  Download,
  Eye,
  FileText,
  LoaderCircle,
  Lock,
  NotebookPen,
  Presentation,
  RotateCcw,
  ScanText,
  ShieldCheck,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type {
  AnalysisTarget,
  AssessmentStatus,
  PublicProviderCatalog,
  SourceType,
} from "@/domain";
import type {
  AnalysisResult,
  HydratedConceptAssessment,
  HydratedEvidence,
} from "@/lib/analysis";
import {
  LiveAnalysisError,
  requestLiveAnalysis,
} from "@/lib/ai/client";
import {
  loadDemoFiles,
  runFixtureAnalysis,
} from "@/lib/demo";
import {
  processSourceFiles,
  SourceProcessingError,
} from "@/lib/extraction";
import type { ProcessedSources, SourceFiles } from "@/lib/extraction";

type SourceSpec = {
  sourceType: SourceType;
  eyebrow: string;
  title: string;
  detail: string;
  accept: string;
  limit: string;
  icon: LucideIcon;
};

type PipelineMode = "idle" | "loading" | "ready" | "source-map" | "error";
type LoadingKind = "demo" | "live" | "local";
type PipelineErrorState = {
  kind: "processing" | "live" | "demo";
  message: string;
  retryable: boolean;
};
type IssueStatus = Exclude<AssessmentStatus, "covered">;
type IssueFilter = "all" | IssueStatus;

type PublicProvider = PublicProviderCatalog["providers"][number];

const EMPTY_PROVIDER_CATALOG: PublicProviderCatalog = { providers: [] };

const SOURCE_SPECS: readonly SourceSpec[] = [
  {
    sourceType: "slides",
    eyebrow: "01 / Lecture source",
    title: "Slides",
    detail: "Text-based PDF",
    accept: ".pdf,application/pdf",
    limit: "Up to 10 MiB",
    icon: Presentation,
  },
  {
    sourceType: "transcript",
    eyebrow: "02 / Spoken context",
    title: "Transcript",
    detail: "UTF-8 plain text",
    accept: ".txt,text/plain",
    limit: "Up to 1 MiB",
    icon: FileText,
  },
  {
    sourceType: "notes",
    eyebrow: "03 / Your baseline",
    title: "Existing notes",
    detail: "Markdown",
    accept: ".md,.markdown,text/markdown,text/plain",
    limit: "Up to 1 MiB",
    icon: NotebookPen,
  },
] as const;

const SOURCE_NAMES: Record<SourceType, string> = {
  slides: "Slides",
  transcript: "Transcript",
  notes: "Notes",
};

const STATUS_META: Record<
  IssueStatus,
  { label: string; shortLabel: string; accent: string; pill: string; icon: LucideIcon }
> = {
  missing: {
    label: "Missing explanation",
    shortLabel: "Missing",
    accent: "border-l-[#ef6b5a]",
    pill: "bg-[#fee4dd] text-[#a83f32]",
    icon: AlertTriangle,
  },
  partial: {
    label: "Partially covered",
    shortLabel: "Partial",
    accent: "border-l-[#daa83c]",
    pill: "bg-[#f8ebc8] text-[#765511]",
    icon: ScanText,
  },
  contradiction: {
    label: "Possible contradiction",
    shortLabel: "Contradiction",
    accent: "border-l-[#376ab4]",
    pill: "bg-[#dfe8f7] text-[#244f8d]",
    icon: AlertTriangle,
  },
};

const FILTERS: readonly { value: IssueFilter; label: string }[] = [
  { value: "all", label: "All issues" },
  { value: "missing", label: "Missing" },
  { value: "partial", label: "Partial" },
  { value: "contradiction", label: "Contradictions" },
];

const STATUS_RANK: Record<IssueStatus, number> = {
  missing: 0,
  partial: 1,
  contradiction: 2,
};

function hasAllFiles(files: Partial<SourceFiles>): files is SourceFiles {
  return files.slides !== undefined && files.transcript !== undefined && files.notes !== undefined;
}

function defaultTarget(catalog: PublicProviderCatalog): AnalysisTarget | null {
  const provider =
    catalog.providers.find((candidate) => candidate.configured) ??
    catalog.providers[0];
  if (provider === undefined) return null;

  const model =
    provider.models.find((candidate) => candidate.id === provider.defaultModel) ??
    provider.models[0];
  if (model === undefined) return null;

  return { provider: provider.id, model: model.id };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

function processingError(error: unknown): PipelineErrorState {
  return {
    kind: "processing",
    message:
      error instanceof SourceProcessingError || error instanceof Error
        ? error.message
        : "LectureWeaver could not process those files. Please try again.",
    retryable: false,
  };
}

function liveError(error: unknown): PipelineErrorState {
  return {
    kind: "live",
    message:
      error instanceof LiveAnalysisError || error instanceof Error
        ? error.message
        : "The selected model did not return a usable analysis.",
    retryable:
      error instanceof LiveAnalysisError ? error.retryable : true,
  };
}

function demoPipelineError(error: unknown): PipelineErrorState {
  return {
    kind: "demo",
    message:
      error instanceof Error
        ? error.message
        : "The included demo could not be loaded. Please retry.",
    retryable: true,
  };
}

function nextPaint(): Promise<void> {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
}

function LogoMark() {
  return (
    <span
      aria-hidden="true"
      className="relative grid size-9 place-items-center overflow-hidden rounded-[12px] bg-[#14213d]"
    >
      <span className="absolute h-[3px] w-6 -rotate-12 rounded-full bg-[#dcece8]" />
      <span className="absolute h-[3px] w-6 rotate-12 rounded-full bg-[#ef6b5a]" />
      <span className="absolute size-2 rounded-full border-2 border-[#f8ebc8] bg-[#14213d]" />
    </span>
  );
}

function AppHeader({ onTryDemo, loading }: { onTryDemo: () => void; loading: boolean }) {
  return (
    <header className="relative z-20 border-b border-[#14213d]/10 bg-[#f7f4ec]/85 backdrop-blur-xl">
      <div className="mx-auto flex min-h-18 max-w-[1440px] items-center justify-between px-5 sm:px-8 lg:px-12">
        <a href="#top" className="flex items-center gap-3 rounded-xl" aria-label="LectureWeaver home">
          <LogoMark />
          <span className="text-[17px] font-bold tracking-[-0.03em]">LectureWeaver</span>
        </a>
        <div className="flex items-center gap-3">
          <span className="hidden items-center gap-1.5 rounded-full border border-[#2f837c]/20 bg-white/60 px-3 py-1.5 text-xs font-bold text-[#1f625e] sm:flex">
            <Lock className="size-3.5" aria-hidden="true" />
            Local demo · Optional live AI
          </span>
          <button
            type="button"
            onClick={onTryDemo}
            disabled={loading}
            className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[#14213d] px-4 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-[#223252] disabled:cursor-wait disabled:opacity-60"
          >
            {loading ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            Try demo
          </button>
        </div>
      </div>
    </header>
  );
}

function Hero({ onTryDemo, loading }: { onTryDemo: () => void; loading: boolean }) {
  return (
    <section className="relative overflow-hidden border-b border-[#14213d]/10" id="top">
      <div className="fine-grid absolute inset-0 opacity-55" aria-hidden="true" />
      <div className="absolute -right-28 top-14 size-80 rounded-full border-[54px] border-[#2f837c]/10" aria-hidden="true" />
      <div className="absolute -left-16 bottom-4 size-36 rounded-full bg-[#ef6b5a]/10 blur-2xl" aria-hidden="true" />
      <div className="relative mx-auto grid max-w-[1440px] gap-10 px-5 py-18 sm:px-8 sm:py-24 lg:grid-cols-[minmax(0,1.18fr)_minmax(320px,0.62fr)] lg:items-end lg:px-12 lg:py-28">
        <div className="max-w-4xl animate-rise">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#14213d]/10 bg-white/70 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.15em] text-[#53627b]">
            <span className="size-1.5 rounded-full bg-[#ef6b5a]" />
            Completeness-first study review
          </div>
          <h1 className="display-face max-w-4xl text-[clamp(3.4rem,8vw,7.6rem)] leading-[0.86] text-[#14213d]">
            Find what your notes <span className="italic text-[#2f837c]">missed.</span>
          </h1>
          <p className="mt-7 max-w-2xl text-lg leading-8 text-[#53627b] sm:text-xl">
            LectureWeaver checks slides and transcripts against your notes, then ties every gap back to the exact page or paragraph that proves it.
          </p>
        </div>

        <div className="animate-rise rounded-[28px] border border-[#14213d]/10 bg-white/75 p-5 shadow-card sm:p-6 [animation-delay:100ms]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#2f837c]">Judge-ready sample</p>
              <h2 className="mt-2 text-xl font-bold tracking-[-0.035em]">See the full audit in one click.</h2>
            </div>
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#dcece8] text-[#1f625e]">
              <ShieldCheck className="size-5" aria-hidden="true" />
            </span>
          </div>
          <ul className="mt-6 space-y-3 text-sm text-[#53627b]">
            {[
              "Real local PDF and Markdown parsing",
              "No-key fixture locked to source fingerprints",
              "Optional OpenAI, DeepSeek, and Kimi analysis",
            ].map((item) => (
              <li key={item} className="flex items-center gap-3">
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-[#14213d] text-white">
                  <Check className="size-3" aria-hidden="true" />
                </span>
                {item}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={onTryDemo}
            disabled={loading}
            className="mt-7 inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl bg-[#ef6b5a] px-5 font-bold text-white shadow-[0_12px_30px_rgba(239,107,90,0.24)] transition hover:-translate-y-0.5 hover:bg-[#db5849] disabled:cursor-wait disabled:opacity-60"
          >
            {loading ? <LoaderCircle className="size-5 animate-spin" /> : <Sparkles className="size-5" />}
            {loading ? "Weaving the sources…" : "Try the sample lecture"}
            {!loading && <ArrowRight className="size-4" aria-hidden="true" />}
          </button>
          <p className="mt-3 text-center text-xs text-[#53627b]">No API key · no model request · about 3 seconds</p>
        </div>
      </div>
    </section>
  );
}

type FileCardProps = {
  spec: SourceSpec;
  file?: File;
  inputKey: number;
  disabled: boolean;
  onSelect: (sourceType: SourceType, file: File) => void;
};

function FileCard({ spec, file, inputKey, disabled, onSelect }: FileCardProps) {
  const Icon = spec.icon;
  const inputId = `source-${spec.sourceType}-${inputKey}`;

  const pickFile = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.currentTarget.files?.[0];
    if (selected) onSelect(spec.sourceType, selected);
  };

  const dropFile = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    if (disabled) return;
    const selected = event.dataTransfer.files[0];
    if (selected) onSelect(spec.sourceType, selected);
  };

  return (
    <article className="group relative flex min-h-60 flex-col rounded-[26px] border border-[#14213d]/10 bg-white/70 p-5 transition hover:-translate-y-1 hover:border-[#2f837c]/35 hover:shadow-card sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#2f837c]">{spec.eyebrow}</p>
          <h3 className="mt-2 text-2xl font-bold tracking-[-0.04em]">{spec.title}</h3>
        </div>
        <span className="grid size-11 place-items-center rounded-2xl bg-[#dcece8] text-[#1f625e] transition group-hover:rotate-3">
          <Icon className="size-5" aria-hidden="true" />
        </span>
      </div>

      {file ? (
        <div className="mt-7 flex flex-1 flex-col justify-between rounded-2xl border border-[#2f837c]/20 bg-[#edf6f3] p-4">
          <div className="flex items-start gap-3">
            <CircleCheck className="mt-0.5 size-5 shrink-0 text-[#2f837c]" aria-hidden="true" />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold" title={file.name}>{file.name}</p>
              <p className="mt-1 text-xs text-[#53627b]">{formatBytes(file.size)} · ready locally</p>
            </div>
          </div>
          <label htmlFor={inputId} className="mt-5 cursor-pointer text-xs font-bold text-[#1f625e] underline decoration-[#2f837c]/30 underline-offset-4">
            Replace file
          </label>
        </div>
      ) : (
        <label
          htmlFor={inputId}
          onDragOver={(event) => event.preventDefault()}
          onDrop={dropFile}
          className="mt-7 flex flex-1 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-[#14213d]/20 bg-[#f7f4ec]/65 px-4 py-5 text-center transition hover:border-[#2f837c] hover:bg-[#edf6f3]"
        >
          <Upload className="size-5 text-[#2f837c]" aria-hidden="true" />
          <span className="mt-2 text-sm font-bold">Choose or drop a file</span>
          <span className="mt-1 text-xs text-[#53627b]">{spec.detail} · {spec.limit}</span>
        </label>
      )}
      <input
        key={inputKey}
        id={inputId}
        type="file"
        className="sr-only"
        accept={spec.accept}
        disabled={disabled}
        onChange={pickFile}
        aria-label={`Choose ${spec.title.toLowerCase()} file`}
      />
    </article>
  );
}

function LoadingPanel({ message, kind }: { message: string; kind: LoadingKind }) {
  const steps =
    kind === "live"
      ? ["Validate files", "Extract locally", "Analyze normalized chunks", "Hydrate evidence"]
      : kind === "demo"
        ? ["Validate files", "Extract + normalize", "Verify fixture", "Hydrate evidence"]
        : ["Validate files", "Extract + normalize", "Build source map"];
  const eyebrow =
    kind === "live"
      ? "Live model analysis"
      : kind === "demo"
        ? "No-key demo"
        : "Local processing";
  return (
    <section className="animate-rise rounded-[28px] border border-[#2f837c]/20 bg-[#14213d] p-6 text-white shadow-card sm:p-8" aria-live="polite" aria-busy="true">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <span className="relative grid size-13 shrink-0 place-items-center rounded-2xl bg-white/10">
            <span className="absolute inset-2 animate-soft-pulse rounded-xl bg-[#2f837c]/35" />
            <LoaderCircle className="relative size-6 animate-spin text-[#f8ebc8]" aria-hidden="true" />
          </span>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#b8dcd6]">{eyebrow}</p>
            <p className="mt-1 text-lg font-bold">{message}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {steps.map((step, index) => (
            <span key={step} className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-white/70">
              {String(index + 1).padStart(2, "0")} {step}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function SourceMapSummary({
  processed,
  origin,
}: {
  processed: ProcessedSources;
  origin: AnalysisResult["origin"] | null;
}) {
  const statusLabel =
    origin?.kind === "demo"
      ? "Sample fingerprint verified"
      : origin?.kind === "live"
        ? `${origin.providerLabel} · ${origin.model}`
        : "Local source map ready";
  const completedAnalysis = origin !== null;

  return (
    <section className="rounded-[28px] border border-[#14213d]/10 bg-white/70 p-6 shadow-card sm:p-8" aria-labelledby="source-map-title">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#2f837c]">Freshly extracted</p>
          <h2 id="source-map-title" className="mt-2 text-2xl font-bold tracking-[-0.04em]">Trusted source map</h2>
          <p className="mt-2 text-sm leading-6 text-[#53627b]">Every locator below was rebuilt from the files currently in memory.</p>
        </div>
        <span className={`inline-flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold ${completedAnalysis ? "bg-[#dcece8] text-[#1f625e]" : "bg-[#f8ebc8] text-[#765511]"}`}>
          {completedAnalysis ? <ShieldCheck className="size-4" /> : <Lock className="size-4" />}
          {statusLabel}
        </span>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {(["slides", "transcript", "notes"] as const).map((sourceType) => {
          const chunks = processed.chunks.filter((chunk) => chunk.sourceType === sourceType);
          return (
            <div key={sourceType} className="rounded-2xl border border-[#14213d]/10 bg-[#f7f4ec]/80 p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-bold">{SOURCE_NAMES[sourceType]}</span>
                <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-[#53627b]">{chunks.length} chunks</span>
              </div>
              <p className="mt-4 truncate text-xs text-[#53627b]" title={chunks[0]?.sourceName}>{chunks[0]?.sourceName}</p>
              <p className="mt-1 text-xs font-bold text-[#2f837c]">
                {chunks[0]?.locator}{chunks.length > 1 ? ` → ${chunks.at(-1)?.locator}` : ""}
              </p>
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-xs text-[#53627b]">{processed.totalCharacters.toLocaleString()} normalized characters · {processed.chunks.length} chunks total</p>
    </section>
  );
}

function ProviderControls({
  catalog,
  target,
  disabled,
  onProviderChange,
  onModelChange,
}: {
  catalog: PublicProviderCatalog;
  target: AnalysisTarget | null;
  disabled: boolean;
  onProviderChange: (provider: PublicProvider) => void;
  onModelChange: (model: string) => void;
}) {
  const selectedProvider = catalog.providers.find(
    (provider) => provider.id === target?.provider,
  );
  const selectedModel = selectedProvider?.models.find(
    (model) => model.id === target?.model,
  );

  return (
    <fieldset className="mt-6 rounded-[24px] border border-[#14213d]/10 bg-white/55 p-4 sm:p-5">
      <legend className="px-2 text-xs font-bold uppercase tracking-[0.16em] text-[#2f837c]">
        Optional live analysis
      </legend>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm font-bold" htmlFor="analysis-provider">
          AI provider
          <select
            id="analysis-provider"
            value={target?.provider ?? ""}
            disabled={disabled || catalog.providers.length === 0}
            onChange={(event) => {
              const provider = catalog.providers.find(
                (candidate) => candidate.id === event.currentTarget.value,
              );
              if (provider !== undefined) onProviderChange(provider);
            }}
            className="mt-2 min-h-11 w-full rounded-xl border border-[#14213d]/15 bg-white px-3 text-sm text-[#14213d] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {catalog.providers.length === 0 && (
              <option value="">No provider configured</option>
            )}
            {catalog.providers.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.label}{provider.configured ? "" : " — not configured"}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm font-bold" htmlFor="analysis-model">
          AI model
          <select
            id="analysis-model"
            value={target?.model ?? ""}
            disabled={disabled || selectedProvider === undefined || selectedProvider.models.length === 0}
            onChange={(event) => onModelChange(event.currentTarget.value)}
            className="mt-2 min-h-11 w-full rounded-xl border border-[#14213d]/15 bg-white px-3 text-sm text-[#14213d] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {selectedProvider === undefined && <option value="">No model available</option>}
            {selectedProvider?.models.map((model) => (
              <option key={model.id} value={model.id}>{model.label}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-4 flex flex-col gap-2 text-xs leading-5 text-[#53627b] sm:flex-row sm:items-start sm:justify-between">
        <p className="max-w-3xl">
          {selectedModel?.description ?? selectedProvider?.description ?? "This deployment has no live provider settings."}
        </p>
        <span className={`inline-flex w-fit shrink-0 rounded-full px-2.5 py-1 font-bold ${selectedProvider?.configured ? "bg-[#dcece8] text-[#1f625e]" : "bg-[#f8ebc8] text-[#765511]"}`}>
          {selectedProvider?.configured ? "Server key configured" : "Local source map only"}
        </span>
      </div>
    </fieldset>
  );
}

function PipelineErrorPanel({
  error,
  onRetryLive,
  onRetryDemo,
}: {
  error: PipelineErrorState;
  onRetryLive: () => void;
  onRetryDemo: () => void;
}) {
  const liveFailure = error.kind === "live";
  const demoFailure = error.kind === "demo";

  return (
    <section className="rounded-[24px] border border-[#ef6b5a]/35 bg-[#fff0ec] p-6" role="alert">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#fee4dd] text-[#a83f32]"><AlertTriangle className="size-5" /></span>
          <div>
            <h2 className="font-bold">{liveFailure ? "Live analysis did not finish." : demoFailure ? "The included demo did not load." : "We could not process those sources."}</h2>
            <p className="mt-2 text-sm leading-6 text-[#53627b]">{error.message}</p>
            <p className="mt-2 text-xs text-[#53627b]">
              {liveFailure
                ? error.retryable
                  ? "Your local source map is preserved. Retry, select another configured model, or use the included demo."
                  : "Your local source map is preserved. Check the provider configuration, select another model, or use the included demo."
                : demoFailure
                  ? "Retry the same checked-in sample. No live model request will be made."
                : "Replace the affected file and retry, or load the included demo."}
            </p>
          </div>
        </div>
        {liveFailure && error.retryable && (
          <button type="button" onClick={onRetryLive} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#14213d] px-5 text-sm font-bold text-white hover:bg-[#223252]">
            <RotateCcw className="size-4" /> Retry live analysis
          </button>
        )}
        {demoFailure && (
          <button type="button" onClick={onRetryDemo} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#14213d] px-5 text-sm font-bold text-white hover:bg-[#223252]">
            <RotateCcw className="size-4" /> Retry included demo
          </button>
        )}
      </div>
    </section>
  );
}

function SourceMapOnlyPanel({
  provider,
  onTryDemo,
  onAnalyzeLive,
}: {
  provider?: PublicProvider;
  onTryDemo: () => void;
  onAnalyzeLive?: () => void;
}) {
  return (
    <section className="rounded-[28px] border border-[#daa83c]/35 bg-[#fff9e9] p-6 sm:p-8" role="status">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex max-w-3xl items-start gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#f8ebc8] text-[#765511]">
            <Lock className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-lg font-bold tracking-[-0.025em]">Your local source map is ready.</h2>
            <p className="mt-2 text-sm leading-6 text-[#53627b]">
              {provider === undefined
                ? "No live model provider is configured on this deployment, so no normalized chunks were sent."
                : provider.configured
                  ? `Nothing has been sent to ${provider.label} yet. Start live analysis when you are ready to transmit the normalized chunks.`
                  : `${provider.label} is not configured on this deployment, so no normalized chunks were sent.`} The included demo still provides a complete, evidence-linked result without an API key.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {provider?.configured === true && onAnalyzeLive !== undefined && (
            <button type="button" onClick={onAnalyzeLive} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#2f837c] px-5 text-sm font-bold text-white hover:bg-[#1f625e]">
              <ScanText className="size-4" /> Analyze current source map with {provider.label}
            </button>
          )}
          <button type="button" onClick={onTryDemo} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#14213d] px-5 text-sm font-bold text-white hover:bg-[#223252]">
            <Sparkles className="size-4" /> Load included demo
          </button>
        </div>
      </div>
    </section>
  );
}

function ScorePanel({ result }: { result: AnalysisResult }) {
  const { score, counts, total } = result.metrics;
  const scoreLabel = score >= 80 ? "Strong coverage" : score >= 60 ? "Important gaps found" : "Needs a careful pass";
  const originLabel =
    result.origin.kind === "demo"
      ? "Simulated demo analysis · real evidence"
      : `Live analysis · ${result.origin.providerLabel} · ${result.origin.model}`;
  const countItems: readonly { status: AssessmentStatus; label: string; color: string }[] = [
    { status: "covered", label: "Covered", color: "bg-[#2f837c]" },
    { status: "partial", label: "Partial", color: "bg-[#daa83c]" },
    { status: "missing", label: "Missing", color: "bg-[#ef6b5a]" },
    { status: "contradiction", label: "Contradictions", color: "bg-[#376ab4]" },
  ];

  return (
    <section className="overflow-hidden rounded-[30px] bg-[#14213d] text-white shadow-[0_28px_80px_rgba(20,33,61,0.18)]" aria-labelledby="coverage-title">
      <div className="grid lg:grid-cols-[360px_1fr]">
        <div className="relative flex min-h-82 items-center justify-center overflow-hidden border-b border-white/10 p-8 lg:border-b-0 lg:border-r">
          <div className="absolute -left-10 -top-12 size-44 rounded-full bg-[#2f837c]/25 blur-2xl" />
          <div className="relative grid size-58 place-items-center rounded-full" style={{ background: `conic-gradient(#ef6b5a 0 ${score * 3.6}deg, rgba(255,255,255,0.1) ${score * 3.6}deg 360deg)` }}>
            <div className="grid size-48 place-items-center rounded-full bg-[#14213d] text-center shadow-inner">
              <div>
                <span className="display-face text-7xl leading-none">{score}</span>
                <span className="ml-1 text-xl text-white/60">%</span>
                <p className="mt-2 text-xs font-bold uppercase tracking-[0.15em] text-[#b8dcd6]">Coverage score</p>
              </div>
            </div>
          </div>
        </div>
        <div className="p-6 sm:p-9 lg:p-11">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-[#b8dcd6]">
                <span className="size-1.5 rounded-full bg-[#ef6b5a]" /> {originLabel}
              </p>
              <h2 id="coverage-title" className="mt-3 text-3xl font-bold tracking-[-0.045em] sm:text-4xl">{scoreLabel}</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/65">{result.hydrated.summary}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/55">{total} concepts audited</div>
          </div>
          <div className="mt-8 grid grid-cols-2 gap-3 xl:grid-cols-4">
            {countItems.map((item) => (
              <div key={item.status} className="rounded-2xl border border-white/10 bg-white/[0.055] p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className={`size-2 rounded-full ${item.color}`} />
                  <span className="display-face text-3xl">{counts[item.status]}</span>
                </div>
                <p className="mt-3 text-xs font-bold uppercase tracking-[0.12em] text-white/55">{item.label}</p>
              </div>
            ))}
          </div>
          <p className="mt-5 flex items-center gap-2 text-xs text-white/45"><Lock className="size-3.5" /> Score calculated in app code: covered + half of partial.</p>
        </div>
      </div>
    </section>
  );
}

function EvidenceChips({ evidence }: { evidence: readonly HydratedEvidence[] }) {
  return (
    <div className="mt-5 flex flex-wrap gap-2">
      {evidence.slice(0, 3).map((item) => (
        <span key={item.chunkId} className="inline-flex items-center gap-1.5 rounded-full border border-[#14213d]/10 bg-[#f7f4ec] px-2.5 py-1.5 text-[11px] font-bold text-[#53627b]">
          <span className={`size-1.5 rounded-full ${item.chunk.sourceType === "notes" ? "bg-[#376ab4]" : "bg-[#2f837c]"}`} />
          {SOURCE_NAMES[item.chunk.sourceType]} · {item.chunk.locator}
        </span>
      ))}
      {evidence.length > 3 && <span className="px-2 py-1.5 text-[11px] font-bold text-[#53627b]">+{evidence.length - 3} more</span>}
    </div>
  );
}

function IssueCard({ assessment, onOpen }: { assessment: HydratedConceptAssessment; onOpen: () => void }) {
  if (assessment.status === "covered") return null;
  const meta = STATUS_META[assessment.status];
  const Icon = meta.icon;
  return (
    <article className={`animate-rise rounded-[24px] border border-[#14213d]/10 border-l-4 ${meta.accent} bg-white/75 p-5 shadow-[0_12px_35px_rgba(20,33,61,0.055)] sm:p-6`}>
      <div className="flex items-start justify-between gap-4">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.1em] ${meta.pill}`}>
          <Icon className="size-3.5" aria-hidden="true" /> {meta.label}
        </span>
        <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#53627b]">{assessment.importance}</span>
      </div>
      <h3 className="mt-5 text-xl font-bold tracking-[-0.035em]">{assessment.title}</h3>
      <p className="mt-3 text-sm leading-6 text-[#53627b]">{assessment.explanation}</p>
      <EvidenceChips evidence={assessment.evidence} />
      <button type="button" onClick={onOpen} className="mt-6 inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#14213d] px-4 text-sm font-bold text-white transition hover:bg-[#2f837c]">
        <Eye className="size-4" aria-hidden="true" /> Inspect evidence <ChevronRight className="size-4" aria-hidden="true" />
      </button>
    </article>
  );
}

function IssuesPanel({ result, onOpen }: { result: AnalysisResult; onOpen: (id: string) => void }) {
  const [filter, setFilter] = useState<IssueFilter>("all");
  const issues = useMemo(
    () => result.hydrated.assessments
      .filter((assessment): assessment is HydratedConceptAssessment & { status: IssueStatus } => assessment.status !== "covered")
      .map((assessment, index) => ({ assessment, index }))
      .sort((left, right) => {
        const importance = (left.assessment.importance === "core" ? 0 : 1) - (right.assessment.importance === "core" ? 0 : 1);
        const status = STATUS_RANK[left.assessment.status] - STATUS_RANK[right.assessment.status];
        return importance || status || left.index - right.index;
      })
      .map(({ assessment }) => assessment),
    [result],
  );
  const visibleIssues = filter === "all" ? issues : issues.filter((issue) => issue.status === filter);

  return (
    <section aria-labelledby="review-title">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#2f837c]">Review queue</p>
          <h2 id="review-title" className="mt-2 text-3xl font-bold tracking-[-0.045em] sm:text-4xl">Close the important gaps.</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#53627b]">Core findings rise first. Open a card to compare the claim against fresh source excerpts.</p>
        </div>
        <div className="flex max-w-full gap-1 overflow-x-auto rounded-2xl border border-[#14213d]/10 bg-white/65 p-1.5" aria-label="Filter review issues" role="group">
          {FILTERS.map((item) => (
            <button
              key={item.value}
              type="button"
              aria-pressed={filter === item.value}
              onClick={() => setFilter(item.value)}
              className={`min-h-9 shrink-0 rounded-xl px-3 text-xs font-bold transition ${filter === item.value ? "bg-[#14213d] text-white" : "text-[#53627b] hover:bg-[#14213d]/5"}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-7 grid gap-4 lg:grid-cols-2">
        {visibleIssues.map((assessment) => <IssueCard key={assessment.id} assessment={assessment} onOpen={() => onOpen(assessment.id)} />)}
      </div>
      {visibleIssues.length === 0 && <p className="mt-7 rounded-2xl border border-[#14213d]/10 bg-white/60 p-6 text-sm text-[#53627b]">No findings in this category.</p>}
    </section>
  );
}

function PatchPanel({ markdown }: { markdown: string }) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");

  const copyWithSelectionFallback = (): boolean => {
    const textarea = document.createElement("textarea");
    textarea.value = markdown;
    textarea.readOnly = true;
    textarea.style.position = "fixed";
    textarea.style.inset = "0 auto auto -9999px";
    document.body.append(textarea);
    textarea.select();
    textarea.setSelectionRange(0, markdown.length);
    try {
      return typeof document.execCommand === "function" && document.execCommand("copy");
    } finally {
      textarea.remove();
    }
  };

  const copyMarkdown = async () => {
    try {
      if (navigator.clipboard?.writeText === undefined) {
        if (!copyWithSelectionFallback()) throw new Error("Clipboard unavailable.");
      } else {
        await new Promise<void>((resolve, reject) => {
          const timeout = window.setTimeout(
            () => reject(new Error("Clipboard timed out.")),
            1_200,
          );
          Promise.resolve(navigator.clipboard.writeText(markdown)).then(
            () => {
              window.clearTimeout(timeout);
              resolve();
            },
            (clipboardError: unknown) => {
              window.clearTimeout(timeout);
              reject(clipboardError);
            },
          );
        }).catch((clipboardError: unknown) => {
          if (!copyWithSelectionFallback()) throw clipboardError;
        });
      }
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1800);
    } catch {
      setCopyState("error");
    }
  };

  const downloadMarkdown = () => {
    const url = URL.createObjectURL(new Blob([markdown], { type: "text/markdown;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "lectureweaver-additions.md";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  return (
    <section className="overflow-hidden rounded-[30px] border border-[#14213d]/10 bg-white/80 shadow-card" aria-labelledby="patch-title">
      <div className="flex flex-col gap-5 border-b border-[#14213d]/10 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#ef6b5a]">Ready to merge</p>
          <h2 id="patch-title" className="mt-2 text-3xl font-bold tracking-[-0.045em]">Suggested additions</h2>
          <p className="mt-2 text-sm text-[#53627b]">Generated deterministically from actionable findings, with evidence locators included.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={copyMarkdown} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#14213d]/15 bg-white px-4 text-sm font-bold hover:bg-[#f7f4ec]">
            {copyState === "copied" ? <Check className="size-4 text-[#2f837c]" /> : <Clipboard className="size-4" />}
            {copyState === "copied" ? "Copied" : copyState === "error" ? "Copy failed" : "Copy Markdown"}
          </button>
          <button type="button" onClick={downloadMarkdown} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#ef6b5a] px-4 text-sm font-bold text-white hover:bg-[#db5849]">
            <Download className="size-4" /> Download .md
          </button>
        </div>
      </div>
      <div className="relative bg-[#111a30] p-5 sm:p-8">
        <div className="mb-4 flex items-center gap-2" aria-hidden="true">
          <span className="size-2.5 rounded-full bg-[#ef6b5a]" />
          <span className="size-2.5 rounded-full bg-[#daa83c]" />
          <span className="size-2.5 rounded-full bg-[#2f837c]" />
          <span className="ml-2 text-[10px] font-bold uppercase tracking-[0.14em] text-white/35">lectureweaver-additions.md</span>
        </div>
        <pre className="max-h-[34rem] overflow-auto whitespace-pre-wrap break-words font-mono text-[13px] leading-6 text-[#e8edf5]">{markdown}</pre>
      </div>
      <p className="sr-only" aria-live="polite">{copyState === "copied" ? "Markdown copied to clipboard." : copyState === "error" ? "Could not access the clipboard." : ""}</p>
    </section>
  );
}

function EvidenceDrawer({ assessment, onClose }: { assessment: HydratedConceptAssessment; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab") return;

      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
        "button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])",
      );
      if (focusable === undefined || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (first === undefined || last === undefined) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
      previouslyFocused?.focus();
    };
  }, [onClose]);

  const status = assessment.status === "covered" ? null : STATUS_META[assessment.status];
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end bg-[#091124]/55 backdrop-blur-sm sm:items-stretch" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="evidence-title" className="animate-rise flex max-h-[92vh] w-full flex-col rounded-t-[30px] bg-[#f7f4ec] shadow-2xl sm:max-h-none sm:max-w-[620px] sm:rounded-none sm:rounded-l-[30px]">
        <div className="flex items-start justify-between gap-5 border-b border-[#14213d]/10 p-6 sm:p-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#2f837c]">Evidence trail</p>
            <h2 id="evidence-title" className="mt-2 text-2xl font-bold tracking-[-0.04em]">{assessment.title}</h2>
            {status && <span className={`mt-3 inline-flex rounded-full px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.1em] ${status.pill}`}>{status.label}</span>}
          </div>
          <button ref={closeRef} type="button" onClick={onClose} className="grid size-10 shrink-0 place-items-center rounded-full border border-[#14213d]/10 bg-white hover:bg-[#fee4dd]" aria-label="Close evidence panel">
            <X className="size-5" />
          </button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-5 sm:p-8">
          <p className="text-sm leading-6 text-[#53627b]">{assessment.explanation}</p>
          {assessment.evidence.map((item) => (
            <article key={item.chunkId} className="rounded-2xl border border-[#14213d]/10 bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="rounded-full bg-[#dcece8] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#1f625e]">{SOURCE_NAMES[item.chunk.sourceType]}</span>
                <span className="text-xs font-bold text-[#2f837c]">{item.chunk.locator}</span>
              </div>
              <p className="mt-3 text-xs font-bold text-[#14213d]">{item.chunk.sourceName}</p>
              {item.chunk.headingPath?.length ? <p className="mt-1 text-xs text-[#53627b]">{item.chunk.headingPath.join(" › ")}</p> : null}
              <blockquote className="mt-4 border-l-2 border-[#ef6b5a] pl-4 text-sm leading-6 text-[#37445c]">“{item.chunk.text}”</blockquote>
              <p className="mt-4 rounded-xl bg-[#f7f4ec] p-3 text-xs leading-5 text-[#53627b]"><strong className="text-[#14213d]">Why it matters:</strong> {item.relevance}</p>
            </article>
          ))}
        </div>
        <div className="border-t border-[#14213d]/10 bg-white/65 p-5 sm:px-8">
          <p className="flex items-start gap-2 text-xs leading-5 text-[#53627b]"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-[#2f837c]" /> Names, locators, headings, and excerpts come from the files just parsed—not from model output.</p>
        </div>
      </aside>
    </div>
  );
}

function EmptyPreview() {
  const stages = [
    { number: "01", title: "Extract", text: "PDF pages and numbered paragraphs" },
    { number: "02", title: "Analyze", text: "No-key demo or a configured live model" },
    { number: "03", title: "Hydrate", text: "Local evidence locators and Markdown" },
  ];
  return (
    <section className="rounded-[28px] border border-[#14213d]/10 bg-[#eee9dd]/65 p-6 sm:p-8" aria-label="How the demo works">
      <div className="grid gap-4 md:grid-cols-3">
        {stages.map((stage, index) => (
          <div key={stage.number} className="relative rounded-2xl bg-white/65 p-5">
            <span className="text-xs font-bold tracking-[0.16em] text-[#ef6b5a]">{stage.number}</span>
            <h3 className="mt-5 text-lg font-bold">{stage.title}</h3>
            <p className="mt-2 text-sm leading-6 text-[#53627b]">{stage.text}</p>
            {index < stages.length - 1 && <ChevronRight className="absolute -right-3 top-1/2 z-10 hidden size-6 rounded-full bg-[#14213d] p-1 text-white md:block" />}
          </div>
        ))}
      </div>
    </section>
  );
}

export function LectureWeaver(
  { providers = EMPTY_PROVIDER_CATALOG }: { providers?: PublicProviderCatalog } = {},
) {
  const [files, setFiles] = useState<Partial<SourceFiles>>({});
  const [processed, setProcessed] = useState<ProcessedSources | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [mode, setMode] = useState<PipelineMode>("idle");
  const [loadingKind, setLoadingKind] = useState<LoadingKind>("local");
  const [loadingMessage, setLoadingMessage] = useState("Checking file safety…");
  const [error, setError] = useState<PipelineErrorState | null>(null);
  const [target, setTarget] = useState<AnalysisTarget | null>(() =>
    defaultTarget(providers),
  );
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string | null>(null);
  const [inputKey, setInputKey] = useState(0);
  const outputRef = useRef<HTMLDivElement>(null);
  const loading = mode === "loading";
  const ready = hasAllFiles(files);
  const selectedProvider = useMemo(
    () => providers.providers.find((provider) => provider.id === target?.provider),
    [providers, target],
  );
  const selectedAssessment = useMemo(
    () => result?.hydrated.assessments.find((assessment) => assessment.id === selectedAssessmentId) ?? null,
    [result, selectedAssessmentId],
  );

  const updateFile = (sourceType: SourceType, file: File) => {
    setFiles((current) => ({ ...current, [sourceType]: file }));
    setProcessed(null);
    setResult(null);
    setMode("idle");
    setError(null);
    setSelectedAssessmentId(null);
  };

  const scrollToOutput = () => {
    window.setTimeout(
      () => outputRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      50,
    );
  };

  const analyzeProcessedSources = async (
    nextProcessed: ProcessedSources,
    nextTarget: AnalysisTarget,
    providerLabel: string,
  ) => {
    setLoadingKind("live");
    setLoadingMessage(`Analyzing normalized chunks with ${providerLabel} · ${nextTarget.model}…`);
    await nextPaint();

    try {
      const nextResult = await requestLiveAnalysis(nextProcessed, nextTarget);
      setResult(nextResult);
      setMode("ready");
    } catch (analysisError: unknown) {
      setResult(null);
      setError(liveError(analysisError));
      setMode("error");
    }
    scrollToOutput();
  };

  const runManualPipeline = async (
    sourceFiles: SourceFiles,
    requestLive: boolean,
  ) => {
    const nextTarget = target;
    const provider = selectedProvider;
    const canAnalyzeLive =
      requestLive &&
      nextTarget !== null &&
      provider?.configured === true &&
      provider.models.some((model) => model.id === nextTarget.model);

    setMode("loading");
    setLoadingKind(canAnalyzeLive ? "live" : "local");
    setError(null);
    setResult(null);
    setProcessed(null);
    setSelectedAssessmentId(null);
    setLoadingMessage("Validating three local files…");
    await nextPaint();

    try {
      setLoadingMessage("Extracting pages and paragraph structure…");
      const nextProcessed = await processSourceFiles(sourceFiles);
      setProcessed(nextProcessed);

      if (canAnalyzeLive && nextTarget !== null && provider !== undefined) {
        await analyzeProcessedSources(nextProcessed, nextTarget, provider.label);
      } else {
        setLoadingMessage("Finalizing the local source map…");
        await nextPaint();
        setMode("source-map");
        scrollToOutput();
      }
    } catch (pipelineError: unknown) {
      setError(processingError(pipelineError));
      setMode("error");
      scrollToOutput();
    }
  };

  const tryDemo = async () => {
    setMode("loading");
    setLoadingKind("demo");
    setError(null);
    setResult(null);
    setProcessed(null);
    setSelectedAssessmentId(null);
    setLoadingMessage("Loading the included sample files…");
    await nextPaint();
    try {
      const demoFiles = await loadDemoFiles();
      setFiles(demoFiles);
      setLoadingMessage("Extracting pages and paragraph structure…");
      const nextProcessed = await processSourceFiles(demoFiles);
      setProcessed(nextProcessed);
      setLoadingMessage("Verifying the sample fingerprint and hydrating evidence…");
      await nextPaint();
      const demoResult = await runFixtureAnalysis(nextProcessed);
      setResult(demoResult);
      setMode("ready");
      scrollToOutput();
    } catch (demoError: unknown) {
      setError(demoPipelineError(demoError));
      setMode("error");
      scrollToOutput();
    }
  };

  const retryLiveAnalysis = async () => {
    if (
      processed === null ||
      target === null ||
      selectedProvider?.configured !== true ||
      !selectedProvider.models.some((model) => model.id === target.model)
    ) {
      setError(null);
      setMode(processed === null ? "idle" : "source-map");
      return;
    }

    setMode("loading");
    setError(null);
    setResult(null);
    setSelectedAssessmentId(null);
    await analyzeProcessedSources(processed, target, selectedProvider.label);
  };

  const recoverAfterTargetChange = () => {
    if (error?.kind !== "live") return;
    setError(null);
    setMode(processed === null ? "idle" : "source-map");
  };

  const chooseProvider = (provider: PublicProvider) => {
    const model =
      provider.models.find((candidate) => candidate.id === provider.defaultModel) ??
      provider.models[0];
    setTarget(model === undefined ? null : { provider: provider.id, model: model.id });
    recoverAfterTargetChange();
  };

  const chooseModel = (model: string) => {
    if (selectedProvider === undefined) return;
    setTarget({ provider: selectedProvider.id, model });
    recoverAfterTargetChange();
  };

  const reset = () => {
    setFiles({});
    setProcessed(null);
    setResult(null);
    setMode("idle");
    setError(null);
    setSelectedAssessmentId(null);
    setInputKey((value) => value + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <main>
      <AppHeader onTryDemo={() => void tryDemo()} loading={loading} />
      <Hero onTryDemo={() => void tryDemo()} loading={loading} />

      <section className="mx-auto max-w-[1440px] px-5 py-16 sm:px-8 sm:py-20 lg:px-12" aria-labelledby="upload-title">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#2f837c]">Your materials</p>
            <h2 id="upload-title" className="mt-2 text-3xl font-bold tracking-[-0.045em] sm:text-4xl">Build a trusted source map.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#53627b]">Choose all three files. Raw files are parsed in this tab; only normalized text chunks are sent when you run a configured live model.</p>
          </div>
          {(Object.keys(files).length > 0 || processed) && (
            <button type="button" onClick={reset} disabled={loading} className="inline-flex min-h-10 w-fit items-center gap-2 rounded-xl border border-[#14213d]/15 bg-white/60 px-4 text-sm font-bold hover:bg-white disabled:opacity-50">
              <RotateCcw className="size-4" /> Reset
            </button>
          )}
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {SOURCE_SPECS.map((spec) => (
            <FileCard key={spec.sourceType} spec={spec} file={files[spec.sourceType]} inputKey={inputKey} disabled={loading} onSelect={updateFile} />
          ))}
        </div>

        <ProviderControls
          catalog={providers}
          target={target}
          disabled={loading}
          onProviderChange={chooseProvider}
          onModelChange={chooseModel}
        />

        <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-[#14213d]/10 bg-white/50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2 text-xs leading-5 text-[#53627b]"><Lock className="size-4 shrink-0 text-[#2f837c]" /> Raw files stay local · normalized chunks are sent only for configured live analysis · no silent truncation</p>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              disabled={!ready || loading}
              onClick={() => { if (ready) void runManualPipeline(files, false); }}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#14213d]/15 bg-white px-5 text-sm font-bold text-[#14213d] transition hover:bg-[#f7f4ec] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading && loadingKind === "local" ? <LoaderCircle className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
              Build local source map
            </button>
            {selectedProvider?.configured === true && target !== null && (
              <button
                type="button"
                disabled={!ready || loading}
                onClick={() => { if (ready) void runManualPipeline(files, true); }}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#2f837c] px-5 text-sm font-bold text-white transition hover:bg-[#1f625e] disabled:cursor-not-allowed disabled:bg-[#14213d]/20"
              >
                {loading && loadingKind === "live" ? <LoaderCircle className="size-4 animate-spin" /> : <ScanText className="size-4" />}
                Extract and analyze with {selectedProvider.label}
              </button>
            )}
          </div>
        </div>
      </section>

      <div ref={outputRef} className="scroll-mt-5">
        <div className="mx-auto max-w-[1440px] space-y-8 px-5 pb-20 sm:px-8 lg:px-12">
          {mode === "loading" && <LoadingPanel message={loadingMessage} kind={loadingKind} />}
          {mode === "error" && error && (
            <PipelineErrorPanel
              error={error}
              onRetryLive={() => void retryLiveAnalysis()}
              onRetryDemo={() => void tryDemo()}
            />
          )}
          {processed && mode !== "loading" && <SourceMapSummary processed={processed} origin={result?.origin ?? null} />}
          {mode === "source-map" && (
            <SourceMapOnlyPanel
              provider={selectedProvider}
              onTryDemo={() => void tryDemo()}
              onAnalyzeLive={
                selectedProvider?.configured === true
                  ? () => void retryLiveAnalysis()
                  : undefined
              }
            />
          )}
          {mode === "idle" && <EmptyPreview />}

          {result && mode === "ready" && (
            <div className="space-y-18 animate-rise">
              <ScorePanel result={result} />
              <IssuesPanel result={result} onOpen={setSelectedAssessmentId} />
              <PatchPanel markdown={result.markdown} />
            </div>
          )}
        </div>
      </div>

      <footer className="border-t border-[#14213d]/10 bg-[#eee9dd]/70">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-5 px-5 py-8 text-xs text-[#53627b] sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12">
          <div className="flex items-center gap-3"><LogoMark /><span><strong className="text-[#14213d]">LectureWeaver</strong><br />Milestone 2 · Multi-provider analysis</span></div>
          <p className="max-w-xl leading-5 sm:text-right">Try demo remains fixture-only and needs no API key. Live analysis sends normalized chunks—not raw files—to the selected server-configured provider.</p>
        </div>
      </footer>

      {selectedAssessment && <EvidenceDrawer assessment={selectedAssessment} onClose={() => setSelectedAssessmentId(null)} />}
    </main>
  );
}
