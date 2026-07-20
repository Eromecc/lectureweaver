"use client";

import type { ChangeEvent, DragEvent, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  AudioLines,
  BookOpen,
  Brain,
  Check,
  ChevronRight,
  CircleCheck,
  Clipboard,
  Download,
  Eye,
  FileText,
  Headphones,
  LoaderCircle,
  Lock,
  ListChecks,
  NotebookPen,
  Presentation,
  RotateCcw,
  ScanText,
  ShieldCheck,
  Sparkles,
  Upload,
  Volume2,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type {
  AnalyzeErrorCode,
  AnalysisOutputOptions,
  AnalysisTarget,
  AssessmentStatus,
  AudioSpeechFormat,
  AudioTranscriptionSuccess,
  AudioVoice,
  KimiRegion,
  NoteChangeType,
  OutputLanguage,
  ProviderId,
  PublicProviderCatalog,
  SourceType,
} from "@/domain";
import {
  AUDIO_FILE_EXTENSIONS,
  AUDIO_SPEECH_FORMATS,
  AUDIO_VOICES,
  MAX_AUDIO_FILE_BYTES,
  MAX_SPEECH_INPUT_CHARACTERS,
} from "@/domain";
import type {
  AnalysisResult,
  HydratedAnkiCard,
  HydratedConceptAssessment,
  HydratedEnhancedNoteSection,
  HydratedEvidence,
} from "@/lib/analysis";
import { buildNarrationScripts } from "@/lib/analysis";
import {
  LiveAnalysisError,
  requestLiveAnalysis,
} from "@/lib/ai/client";
import { SessionProviderKeySchema } from "@/lib/ai/session-credential";
import {
  AudioClientError,
  requestAudioTranscription,
  requestStudyGuideSpeech,
  validateAudioFile,
} from "@/lib/ai/audio-client";
import {
  loadDemoFiles,
  recoverDemoPdfExtraction,
  runFixtureAnalysis,
} from "@/lib/demo";
import {
  chunkTimestampedTranscript,
  normalizeSourceText,
  processSourceFiles,
  processSourceFilesWithTranscriptChunks,
  readLectureTextFile,
  readTranscriptFile,
  SourceProcessingError,
} from "@/lib/extraction";
import type {
  ProcessedSources,
  ProcessingErrorCode,
  SourceFiles,
} from "@/lib/extraction";
import {
  createUiTranslator,
  translateUiPlural,
  UI_LOCALE_OPTIONS,
} from "@/lib/i18n/ui";
import type {
  UiLocale,
  UiMessageKey,
  UiMessageValues,
  UiTranslator,
} from "@/lib/i18n/ui";
import { ApiSetupGuide } from "@/components/api-setup-guide";

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
type LoadingMessage = {
  key: UiMessageKey;
  values?: UiMessageValues;
};
type PipelineErrorState = {
  kind: "processing" | "live" | "demo";
  message: string;
  retryable: boolean;
  liveCode?: AnalyzeErrorCode;
  sourceType?: SourceType;
  processingCode?: ProcessingErrorCode;
};
type IssueStatus = Exclude<AssessmentStatus, "covered">;
type IssueFilter = "all" | IssueStatus;
type ResultView = "notes" | "audit" | "changes" | "anki" | "audio";
type LectureSourceMode = "pdf" | "text" | "paste";
type SpokenSourceMode = "transcript" | "paste" | "audio";
type TranscriptInputKind = "upload" | "paste";
type PastedTranscriptState =
  | { status: "idle" }
  | { status: "validating" }
  | { status: "ready" }
  | { status: "error"; message: string };
type PastedLectureState = PastedTranscriptState;
type AudioTranscriptionState =
  | { status: "idle" }
  | { status: "validating" }
  | { status: "loading" }
  | {
      status: "error";
      message: string;
      retryable: boolean;
      invalidFile: boolean;
    }
  | { status: "ready"; transcription: AudioTranscriptionSuccess };

type EvidenceDrawerContent = {
  title: string;
  eyebrow: string;
  badge: string;
  badgeClassName: string;
  description: string;
  evidence: readonly HydratedEvidence[];
};
type EvidenceDrawerSelection =
  | { kind: "assessment"; assessment: HydratedConceptAssessment }
  | { kind: "section"; section: HydratedEnhancedNoteSection }
  | { kind: "card"; card: HydratedAnkiCard };

type PublicProvider = PublicProviderCatalog["providers"][number];
type SessionProviderKeys = Partial<Record<ProviderId, string>>;
type OutputLanguagePreference = "follow-interface" | OutputLanguage;

const EMPTY_PROVIDER_CATALOG: PublicProviderCatalog = { providers: [] };
const PASTE_AUTO_VALIDATE_DELAY_MS = 400;

function isOutputLanguagePreference(
  value: string,
): value is OutputLanguagePreference {
  return (
    value === "follow-interface" ||
    value === "en" ||
    value === "zh-CN" ||
    value === "ja" ||
    value === "ko"
  );
}

const SOURCE_SPECS: readonly SourceSpec[] = [
  {
    sourceType: "slides",
    eyebrow: "01 / Lecture source",
    title: "Slides",
    detail: "Text-based PDF",
    accept: ".pdf,.txt,application/pdf,text/plain",
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

function sourceName(sourceType: SourceType, t: UiTranslator): string {
  if (sourceType === "slides") return t("source.slidesTitle");
  if (sourceType === "transcript") return t("source.transcriptTitle");
  return t("source.notesShortName");
}

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

const PDF_TEXT_RECOVERY_CODES: ReadonlySet<ProcessingErrorCode> = new Set([
  "invalid_pdf",
  "encrypted_pdf",
  "empty_source",
  "too_many_pages",
]);

function issueLabel(status: IssueStatus, t: UiTranslator): string {
  if (status === "missing") return t("review.missingExplanation");
  if (status === "partial") return t("review.partiallyCovered");
  return t("review.possibleContradiction");
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

async function createValidatedPastedTextFile({
  rawText,
  fileName,
  readText,
  emptyMessage,
}: {
  rawText: string;
  fileName: string;
  readText: (file: File) => Promise<string>;
  emptyMessage: string;
}): Promise<File> {
  const file = new File([rawText], fileName, { type: "text/plain" });
  const validatedText = await readText(file);
  if (normalizeSourceText(validatedText).length === 0) {
    throw new Error(emptyMessage);
  }
  return file;
}

function processingError(error: unknown): PipelineErrorState {
  return {
    kind: "processing",
    message:
      error instanceof SourceProcessingError || error instanceof Error
        ? error.message
        : "LectureWeaver could not process those files. Please try again.",
    retryable: false,
    ...(error instanceof SourceProcessingError
      ? { sourceType: error.sourceType, processingCode: error.code }
      : {}),
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
    ...(error instanceof LiveAnalysisError ? { liveCode: error.code } : {}),
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

function LanguageToggle({
  locale,
  onChange,
  t,
}: {
  locale: UiLocale;
  onChange: (locale: UiLocale) => void;
  t: UiTranslator;
}) {
  return (
    <div
      className="flex rounded-full border border-[#14213d]/15 bg-white/70 p-1"
      role="group"
      aria-label={t("language.switchAria")}
    >
      {UI_LOCALE_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          lang={option.value}
          aria-pressed={locale === option.value}
          aria-label={`${t("language.label")}: ${option.label}`}
          onClick={() => onChange(option.value)}
          className={`min-h-8 rounded-full px-2.5 text-xs font-bold transition md:px-3 ${locale === option.value ? "bg-[#14213d] text-white" : "text-[#53627b] hover:bg-white"}`}
        >
          <span className="md:hidden">{option.shortLabel}</span>
          <span className="hidden md:inline">{option.label}</span>
        </button>
      ))}
    </div>
  );
}

function AppHeader({
  onTryDemo,
  loading,
  locale,
  onLocaleChange,
  t,
}: {
  onTryDemo: () => void;
  loading: boolean;
  locale: UiLocale;
  onLocaleChange: (locale: UiLocale) => void;
  t: UiTranslator;
}) {
  return (
    <header className="relative z-20 border-b border-[#14213d]/10 bg-[#f7f4ec]/85 backdrop-blur-xl">
      <div className="mx-auto flex min-h-18 max-w-[1440px] items-center justify-between px-3 sm:px-8 lg:px-12">
        <a href="#top" className="flex items-center gap-3 rounded-xl" aria-label={t("app.homeAria")}>
          <LogoMark />
          <span className="hidden text-[17px] font-bold tracking-[-0.03em] min-[390px]:inline">LectureWeaver</span>
        </a>
        <div className="flex items-center gap-1.5 sm:gap-3">
          <span className="hidden items-center gap-1.5 rounded-full border border-[#2f837c]/20 bg-white/60 px-3 py-1.5 text-xs font-bold text-[#1f625e] lg:flex">
            <Lock className="size-3.5" aria-hidden="true" />
            {t("app.localDemoBadge")}
          </span>
          <LanguageToggle locale={locale} onChange={onLocaleChange} t={t} />
          <button
            type="button"
            onClick={onTryDemo}
            disabled={loading}
            aria-label={t("app.tryDemo")}
            className="inline-flex size-10 shrink-0 items-center justify-center gap-2 rounded-full bg-[#14213d] p-0 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-[#223252] disabled:cursor-wait disabled:opacity-60 md:h-auto md:w-auto md:min-h-10 md:px-4"
          >
            {loading ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            <span className="hidden md:inline">{t("app.tryDemo")}</span>
          </button>
        </div>
      </div>
    </header>
  );
}

function Hero({ onTryDemo, loading, t }: { onTryDemo: () => void; loading: boolean; t: UiTranslator }) {
  return (
    <section className="relative overflow-hidden border-b border-[#14213d]/10" id="top">
      <div className="fine-grid absolute inset-0 opacity-55" aria-hidden="true" />
      <div className="absolute -right-28 top-14 size-80 rounded-full border-[54px] border-[#2f837c]/10" aria-hidden="true" />
      <div className="absolute -left-16 bottom-4 size-36 rounded-full bg-[#ef6b5a]/10 blur-2xl" aria-hidden="true" />
      <div className="relative mx-auto grid max-w-[1440px] gap-10 px-5 py-18 sm:px-8 sm:py-24 lg:grid-cols-[minmax(0,1.18fr)_minmax(320px,0.62fr)] lg:items-end lg:px-12 lg:py-28">
        <div className="max-w-4xl animate-rise">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#14213d]/10 bg-white/70 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.15em] text-[#53627b]">
            <span className="size-1.5 rounded-full bg-[#ef6b5a]" />
            {t("hero.eyebrow")}
          </div>
          <h1 className="display-face max-w-4xl text-[clamp(3.4rem,8vw,7.6rem)] leading-[0.86] text-[#14213d]">
            {t("hero.headlinePrefix")} <span className="italic text-[#2f837c]">{t("hero.headlineAccent")}</span>
          </h1>
          <p className="mt-7 max-w-2xl text-lg leading-8 text-[#53627b] sm:text-xl">
            {t("hero.description")}
          </p>
        </div>

        <div className="animate-rise rounded-[28px] border border-[#14213d]/10 bg-white/75 p-5 shadow-card sm:p-6 [animation-delay:100ms]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#2f837c]">{t("hero.sampleEyebrow")}</p>
              <h2 className="mt-2 text-xl font-bold tracking-[-0.035em]">{t("hero.sampleTitle")}</h2>
            </div>
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#dcece8] text-[#1f625e]">
              <ShieldCheck className="size-5" aria-hidden="true" />
            </span>
          </div>
          <ul className="mt-6 space-y-3 text-sm text-[#53627b]">
            {[t("hero.featureParsing"), t("hero.featureNotes"), t("hero.featureAnki")].map((item) => (
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
            {loading ? t("hero.demoLoading") : t("hero.sampleCta")}
            {!loading && <ArrowRight className="size-4" aria-hidden="true" />}
          </button>
          <p className="mt-3 text-center text-xs text-[#53627b]">{t("hero.sampleMeta")}</p>
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
  t: UiTranslator;
  locale: UiLocale;
};

function LectureSourceCard({
  mode,
  file,
  pastedLecture,
  pastedLectureState,
  inputKey,
  disabled,
  onModeChange,
  onFileSelect,
  onPastedLectureChange,
  onUsePastedLecture,
  onClearPastedLecture,
  t,
  locale,
}: {
  mode: LectureSourceMode;
  file?: File;
  pastedLecture: string;
  pastedLectureState: PastedLectureState;
  inputKey: number;
  disabled: boolean;
  onModeChange: (mode: LectureSourceMode) => void;
  onFileSelect: (mode: Exclude<LectureSourceMode, "paste">, file: File) => void;
  onPastedLectureChange: (value: string) => void;
  onUsePastedLecture: () => void;
  onClearPastedLecture: () => void;
  t: UiTranslator;
  locale: UiLocale;
}) {
  const pdfInputId = `source-slides-pdf-${inputKey}`;
  const textInputId = `source-slides-text-${inputKey}`;
  const pasteInputId = `source-slides-paste-${inputKey}`;
  const uploadMode = mode === "pdf" || mode === "text" ? mode : null;
  const inputId = mode === "text" ? textInputId : pdfInputId;
  const validatingPaste = pastedLectureState.status === "validating";

  const selectFile = (
    selectedMode: Exclude<LectureSourceMode, "paste">,
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const selected = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (selected) onFileSelect(selectedMode, selected);
  };

  const dropFile = (
    selectedMode: Exclude<LectureSourceMode, "paste">,
    event: DragEvent<HTMLLabelElement>,
  ) => {
    event.preventDefault();
    if (disabled) return;
    const selected = event.dataTransfer.files[0];
    if (!selected) return;
    const lowerName = selected.name.toLowerCase();
    const actualMode = lowerName.endsWith(".txt")
      ? "text"
      : lowerName.endsWith(".pdf")
        ? "pdf"
        : selectedMode;
    onFileSelect(actualMode, selected);
  };

  return (
    <article className="group relative flex min-h-60 flex-col rounded-[26px] border border-[#14213d]/10 bg-white/70 p-5 transition hover:border-[#2f837c]/35 hover:shadow-card sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#2f837c]">
            {t("source.slidesEyebrow")}
          </p>
          <h3 className="mt-2 text-2xl font-bold tracking-[-0.04em]">
            {t("lecture.title")}
          </h3>
        </div>
        <span className="grid size-11 place-items-center rounded-2xl bg-[#dcece8] text-[#1f625e] transition group-hover:rotate-3">
          <Presentation className="size-5" aria-hidden="true" />
        </span>
      </div>

      <div
        className="mt-5 grid grid-cols-3 gap-1 rounded-xl bg-[#eee9dd] p-1"
        role="group"
        aria-label={t("lecture.modeAria")}
      >
        {([
          ["pdf", t("lecture.pdfMode")],
          ["text", t("lecture.textMode")],
          ["paste", t("lecture.pasteMode")],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={mode === value}
            disabled={disabled}
            onClick={() => onModeChange(value)}
            className={`min-h-9 min-w-0 rounded-lg px-1.5 text-xs font-bold leading-4 transition sm:px-3 ${mode === value ? "bg-white text-[#14213d] shadow-sm" : "text-[#53627b] hover:bg-white/60"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {uploadMode !== null ? (
        file ? (
          <div className="mt-5 flex flex-1 flex-col justify-between rounded-2xl border border-[#2f837c]/20 bg-[#edf6f3] p-4">
            <div className="flex items-start gap-3">
              <CircleCheck className="mt-0.5 size-5 shrink-0 text-[#2f837c]" aria-hidden="true" />
              <div className="min-w-0">
                <p className="truncate text-sm font-bold" title={file.name}>{file.name}</p>
                <p className="mt-1 text-xs text-[#53627b]">
                  {formatBytes(file.size)} · {t("source.readyLocally")}
                </p>
              </div>
            </div>
            <label
              htmlFor={inputId}
              className="mt-5 cursor-pointer text-xs font-bold text-[#1f625e] underline decoration-[#2f837c]/30 underline-offset-4"
            >
              {t("source.replaceFile")}
            </label>
          </div>
        ) : (
          <label
            htmlFor={inputId}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => dropFile(uploadMode, event)}
            className="mt-5 flex flex-1 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-[#14213d]/20 bg-[#f7f4ec]/65 px-4 py-5 text-center transition hover:border-[#2f837c] hover:bg-[#edf6f3]"
          >
            <Upload className="size-5 text-[#2f837c]" aria-hidden="true" />
            <span className="mt-2 text-sm font-bold">
              {uploadMode === "pdf" ? t("lecture.choosePdf") : t("lecture.chooseText")}
            </span>
            <span className="mt-1 text-xs leading-5 text-[#53627b]">
              {uploadMode === "pdf" ? t("lecture.pdfDetail") : t("lecture.textDetail")}
            </span>
          </label>
        )
      ) : (
        <div className="mt-5 flex flex-1 flex-col gap-3">
          <div>
            <label htmlFor={pasteInputId} className="text-xs font-bold text-[#14213d]">
              {t("lecture.pasteLabel")}
            </label>
            <textarea
              id={pasteInputId}
              value={pastedLecture}
              disabled={disabled || validatingPaste}
              onChange={(event) => onPastedLectureChange(event.currentTarget.value)}
              placeholder={t("lecture.pastePlaceholder")}
              aria-invalid={pastedLectureState.status === "error"}
              aria-describedby={`${pasteInputId}-description ${pasteInputId}-count`}
              className="mt-2 min-h-32 w-full resize-y rounded-2xl border border-[#14213d]/15 bg-white px-4 py-3 text-sm leading-6 text-[#14213d] outline-none transition placeholder:text-[#53627b]/70 focus:border-[#2f837c] focus:ring-2 focus:ring-[#2f837c]/20 disabled:cursor-wait disabled:opacity-60"
            />
            <div className="mt-2 flex flex-wrap items-start justify-between gap-2 text-[11px] leading-4 text-[#53627b]">
              <p id={`${pasteInputId}-description`} className="max-w-sm">
                {t("lecture.pasteDescription")}
              </p>
              <p id={`${pasteInputId}-count`} className="shrink-0 tabular-nums">
                {t("lecture.pasteCharacters", {
                  count: pastedLecture.length.toLocaleString(locale),
                })} · {formatBytes(new Blob([pastedLecture]).size)}
              </p>
            </div>
          </div>

          {pastedLectureState.status === "error" && (
            <div className="rounded-xl border border-[#ef6b5a]/35 bg-[#fff0ec] p-3 text-xs leading-5 text-[#a83f32]" role="alert">
              <p className="font-bold">{t("lecture.pasteErrorTitle")}</p>
              <p className="mt-1">{pastedLectureState.message}</p>
            </div>
          )}

          {pastedLectureState.status === "ready" && file && (
            <div className="flex items-start gap-3 rounded-xl border border-[#2f837c]/20 bg-[#edf6f3] p-3">
              <CircleCheck className="mt-0.5 size-4 shrink-0 text-[#2f837c]" aria-hidden="true" />
              <p className="min-w-0 text-xs leading-5 text-[#53627b]">
                <span className="font-bold text-[#14213d]">{file.name}</span> · {formatBytes(file.size)} · {t("lecture.pasteReadySuffix")}
              </p>
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              disabled={disabled || validatingPaste}
              onClick={onUsePastedLecture}
              className="inline-flex min-h-11 w-full flex-1 items-center justify-center gap-2 rounded-xl bg-[#14213d] px-4 text-xs font-bold text-white transition hover:bg-[#223252] disabled:cursor-wait disabled:opacity-50 sm:w-auto"
            >
              {validatingPaste && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
              {validatingPaste
                ? t("lecture.pasteLoading")
                : pastedLectureState.status === "ready"
                  ? t("lecture.pasteReplace")
                  : t("lecture.pasteUse")}
            </button>
            {pastedLecture.length > 0 && (
              <button
                type="button"
                disabled={disabled || validatingPaste}
                onClick={onClearPastedLecture}
                className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-[#14213d]/15 bg-white px-3 text-xs font-bold text-[#14213d] hover:bg-[#f7f4ec] disabled:opacity-50 sm:w-auto"
              >
                {t("lecture.pasteClear")}
              </button>
            )}
          </div>
          <p className="sr-only" aria-live="polite">
            {validatingPaste
              ? t("lecture.pasteLoading")
              : pastedLectureState.status === "ready"
                ? t("lecture.pasteReadyAnnouncement")
                : ""}
          </p>
        </div>
      )}

      <input
        key={`lecture-pdf-${inputKey}`}
        id={pdfInputId}
        type="file"
        className="sr-only"
        accept=".pdf,application/pdf"
        disabled={disabled}
        onChange={(event) => selectFile("pdf", event)}
        aria-label={t("lecture.choosePdfAria")}
      />
      <input
        key={`lecture-text-${inputKey}`}
        id={textInputId}
        type="file"
        className="sr-only"
        accept=".txt,text/plain"
        disabled={disabled}
        onChange={(event) => selectFile("text", event)}
        aria-label={t("lecture.chooseTextAria")}
      />
    </article>
  );
}

function FileCard({ spec, file, inputKey, disabled, onSelect, t, locale }: FileCardProps) {
  const Icon = spec.icon;
  const inputId = `source-${spec.sourceType}-${inputKey}`;
  const copy = spec.sourceType === "slides"
    ? {
        eyebrow: t("source.slidesEyebrow"),
        title: t("source.slidesTitle"),
        detail: t("source.slidesDetail"),
        limit: t("source.slidesLimit"),
      }
    : {
        eyebrow: t("source.notesEyebrow"),
        title: t("source.notesTitle"),
        detail: t("source.notesDetail"),
        limit: t("source.notesLimit"),
      };

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
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#2f837c]">{copy.eyebrow}</p>
          <h3 className="mt-2 text-2xl font-bold tracking-[-0.04em]">{copy.title}</h3>
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
              <p className="mt-1 text-xs text-[#53627b]">{formatBytes(file.size)} · {t("source.readyLocally")}</p>
            </div>
          </div>
          <label htmlFor={inputId} className="mt-5 cursor-pointer text-xs font-bold text-[#1f625e] underline decoration-[#2f837c]/30 underline-offset-4">
            {t("source.replaceFile")}
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
          <span className="mt-2 text-sm font-bold">{t("source.chooseOrDropFile")}</span>
          <span className="mt-1 text-xs text-[#53627b]">{copy.detail} · {copy.limit}</span>
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
        aria-label={t("source.chooseFileAria", {
          source: locale === "en" ? copy.title.toLowerCase() : copy.title,
        })}
      />
    </article>
  );
}

function formatDuration(seconds: number): string {
  const wholeSeconds = Math.max(0, Math.round(seconds));
  const hours = Math.floor(wholeSeconds / 3_600);
  const minutes = Math.floor((wholeSeconds % 3_600) / 60);
  const remainingSeconds = wholeSeconds % 60;
  return hours > 0
    ? `${hours}:${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`
    : `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

function transcriptDownloadName(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  const base = (dot > 0 ? fileName.slice(0, dot) : fileName)
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "lecture";
  return `${base}-transcript.txt`;
}

function SpokenSourceCard({
  mode,
  transcriptInputKind,
  transcriptFile,
  pastedTranscript,
  pastedTranscriptState,
  audioFile,
  transcriptionState,
  inputKey,
  disabled,
  audioConfigured,
  onModeChange,
  onTranscriptSelect,
  onPastedTranscriptChange,
  onUsePastedTranscript,
  onClearPastedTranscript,
  onAudioSelect,
  onTranscribe,
  t,
  locale,
}: {
  mode: SpokenSourceMode;
  transcriptInputKind: TranscriptInputKind | null;
  transcriptFile?: File;
  pastedTranscript: string;
  pastedTranscriptState: PastedTranscriptState;
  audioFile: File | null;
  transcriptionState: AudioTranscriptionState;
  inputKey: number;
  disabled: boolean;
  audioConfigured: boolean;
  onModeChange: (mode: SpokenSourceMode) => void;
  onTranscriptSelect: (file: File) => void;
  onPastedTranscriptChange: (value: string) => void;
  onUsePastedTranscript: () => void;
  onClearPastedTranscript: () => void;
  onAudioSelect: (file: File) => void;
  onTranscribe: () => void;
  t: UiTranslator;
  locale: UiLocale;
}) {
  const transcriptInputId = `source-transcript-${inputKey}`;
  const audioInputId = `source-audio-${inputKey}`;
  const pastedTranscriptInputId = `source-transcript-paste-${inputKey}`;
  const transcribing = transcriptionState.status === "loading";
  const validatingPaste = pastedTranscriptState.status === "validating";
  const invalidAudio =
    transcriptionState.status === "error" && transcriptionState.invalidFile;
  const blockedProvider =
    transcriptionState.status === "error" &&
    !transcriptionState.retryable &&
    !transcriptionState.invalidFile;

  const selectTranscript = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.currentTarget.files?.[0];
    if (selected) onTranscriptSelect(selected);
  };
  const selectAudio = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.currentTarget.files?.[0];
    if (selected) onAudioSelect(selected);
  };
  const dropFile = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    if (disabled) return;
    const selected = event.dataTransfer.files[0];
    if (selected) {
      if (mode === "transcript") onTranscriptSelect(selected);
      else onAudioSelect(selected);
    }
  };

  return (
    <article className="group relative flex min-h-60 flex-col rounded-[26px] border border-[#14213d]/10 bg-white/70 p-5 transition hover:-translate-y-1 hover:border-[#2f837c]/35 hover:shadow-card sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#2f837c]">
            {t("source.transcriptEyebrow")}
          </p>
          <h3 className="mt-2 text-2xl font-bold tracking-[-0.04em]">
            {t("spoken.title")}
          </h3>
        </div>
        <span className="grid size-11 place-items-center rounded-2xl bg-[#dcece8] text-[#1f625e] transition group-hover:rotate-3">
          {mode === "audio" ? (
            <AudioLines className="size-5" aria-hidden="true" />
          ) : mode === "paste" ? (
            <Clipboard className="size-5" aria-hidden="true" />
          ) : (
            <FileText className="size-5" aria-hidden="true" />
          )}
        </span>
      </div>

      <div
        className="mt-5 grid grid-cols-3 gap-1 rounded-xl border border-[#14213d]/10 bg-[#f7f4ec] p-1"
        role="group"
        aria-label={t("spoken.modeAria")}
      >
        <button
          type="button"
          aria-pressed={mode === "transcript"}
          disabled={disabled}
          onClick={() => onModeChange("transcript")}
          className={`min-h-9 min-w-0 rounded-lg px-1.5 text-xs font-bold leading-4 transition sm:px-3 ${mode === "transcript" ? "bg-white text-[#14213d] shadow-sm" : "text-[#53627b] hover:bg-white/60"}`}
        >
          {t("spoken.transcriptMode")}
        </button>
        <button
          type="button"
          aria-pressed={mode === "paste"}
          disabled={disabled}
          onClick={() => onModeChange("paste")}
          className={`min-h-9 min-w-0 rounded-lg px-1.5 text-xs font-bold leading-4 transition sm:px-3 ${mode === "paste" ? "bg-white text-[#14213d] shadow-sm" : "text-[#53627b] hover:bg-white/60"}`}
        >
          {t("spoken.pasteMode")}
        </button>
        <button
          type="button"
          aria-pressed={mode === "audio"}
          disabled={disabled}
          onClick={() => onModeChange("audio")}
          className={`min-h-9 min-w-0 rounded-lg px-1.5 text-xs font-bold leading-4 transition sm:px-3 ${mode === "audio" ? "bg-white text-[#14213d] shadow-sm" : "text-[#53627b] hover:bg-white/60"}`}
        >
          {t("spoken.audioMode")}
        </button>
      </div>

      {mode === "transcript" ? (
        transcriptInputKind === "upload" && transcriptFile ? (
          <div className="mt-5 flex flex-1 flex-col justify-between rounded-2xl border border-[#2f837c]/20 bg-[#edf6f3] p-4">
            <div className="flex items-start gap-3">
              <CircleCheck className="mt-0.5 size-5 shrink-0 text-[#2f837c]" aria-hidden="true" />
              <div className="min-w-0">
                <p className="truncate text-sm font-bold" title={transcriptFile.name}>
                  {transcriptFile.name}
                </p>
                <p className="mt-1 text-xs text-[#53627b]">
                  {formatBytes(transcriptFile.size)} · {t("source.readyLocally")}
                </p>
              </div>
            </div>
            <label
              htmlFor={transcriptInputId}
              className="mt-5 cursor-pointer text-xs font-bold text-[#1f625e] underline decoration-[#2f837c]/30 underline-offset-4"
            >
              {t("source.replaceFile")}
            </label>
          </div>
        ) : (
          <label
            htmlFor={transcriptInputId}
            onDragOver={(event) => event.preventDefault()}
            onDrop={dropFile}
            className="mt-5 flex flex-1 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-[#14213d]/20 bg-[#f7f4ec]/65 px-4 py-5 text-center transition hover:border-[#2f837c] hover:bg-[#edf6f3]"
          >
            <Upload className="size-5 text-[#2f837c]" aria-hidden="true" />
            <span className="mt-2 text-sm font-bold">{t("spoken.chooseTranscript")}</span>
            <span className="mt-1 text-xs text-[#53627b]">UTF-8 TXT · {t("source.transcriptLimit")}</span>
          </label>
        )
      ) : mode === "paste" ? (
        <div className="mt-5 flex flex-1 flex-col gap-3">
          <div>
            <label
              htmlFor={pastedTranscriptInputId}
              className="block text-sm font-bold text-[#14213d]"
            >
              {t("spoken.pasteLabel")}
            </label>
            <textarea
              id={pastedTranscriptInputId}
              value={pastedTranscript}
              disabled={disabled || validatingPaste}
              rows={7}
              onChange={(event) => onPastedTranscriptChange(event.currentTarget.value)}
              placeholder={t("spoken.pastePlaceholder")}
              aria-invalid={pastedTranscriptState.status === "error"}
              aria-describedby={`${pastedTranscriptInputId}-description ${pastedTranscriptInputId}-count`}
              className="mt-2 min-h-36 w-full resize-y rounded-2xl border border-[#14213d]/15 bg-white px-4 py-3 text-sm leading-6 text-[#14213d] outline-none transition placeholder:text-[#53627b]/65 focus:border-[#2f837c] focus:ring-4 focus:ring-[#2f837c]/10 disabled:cursor-not-allowed disabled:opacity-60"
            />
            <div className="mt-2 flex flex-wrap items-start justify-between gap-2 text-xs leading-5 text-[#53627b]">
              <p id={`${pastedTranscriptInputId}-description`} className="max-w-sm">
                {t("spoken.pasteDescription")}
              </p>
              <p id={`${pastedTranscriptInputId}-count`} className="shrink-0 tabular-nums">
                {t("spoken.pasteCharacters", {
                  count: pastedTranscript.length.toLocaleString(locale),
                })} · {formatBytes(new Blob([pastedTranscript]).size)}
              </p>
            </div>
          </div>

          {pastedTranscriptState.status === "error" && (
            <div
              className="rounded-xl border border-[#ef6b5a]/35 bg-[#fff0ec] p-3 text-xs leading-5 text-[#a83f32]"
              role="alert"
            >
              <p className="font-bold">{t("spoken.pasteErrorTitle")}</p>
              <p className="mt-1">{pastedTranscriptState.message}</p>
            </div>
          )}

          {pastedTranscriptState.status === "ready" &&
            transcriptInputKind === "paste" &&
            transcriptFile && (
              <div className="flex items-start gap-3 rounded-xl border border-[#2f837c]/20 bg-[#edf6f3] p-3 text-xs text-[#1f625e]">
                <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <p>
                  <span className="font-bold">{transcriptFile.name}</span> · {formatBytes(transcriptFile.size)} · {t("spoken.pasteReadySuffix")}
                </p>
              </div>
            )}

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              disabled={disabled || validatingPaste}
              onClick={onUsePastedTranscript}
              className="inline-flex min-h-11 w-full flex-1 items-center justify-center gap-2 rounded-xl bg-[#14213d] px-4 text-sm font-bold text-white transition hover:bg-[#223252] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              {validatingPaste ? (
                <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Clipboard className="size-4" aria-hidden="true" />
              )}
              {validatingPaste
                ? t("spoken.pasteLoading")
                : pastedTranscriptState.status === "ready"
                  ? t("spoken.pasteReplace")
                  : t("spoken.pasteUse")}
            </button>
            {pastedTranscript.length > 0 && (
              <button
                type="button"
                disabled={disabled || validatingPaste}
                onClick={onClearPastedTranscript}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#14213d]/15 bg-white px-4 text-sm font-bold text-[#14213d] transition hover:bg-[#f7f4ec] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                <X className="size-4" aria-hidden="true" />
                {t("spoken.pasteClear")}
              </button>
            )}
          </div>
          <p className="sr-only" aria-live="polite">
            {validatingPaste
              ? t("spoken.pasteLoading")
              : pastedTranscriptState.status === "ready"
                ? t("spoken.pasteReadyAnnouncement")
                : ""}
          </p>
        </div>
      ) : (
        <div className="mt-5 flex flex-1 flex-col gap-3">
          {audioFile ? (
            <div className="rounded-2xl border border-[#2f837c]/20 bg-[#edf6f3] p-4">
              <div className="flex items-start gap-3">
                {transcriptionState.status === "ready" ? (
                  <CircleCheck className="mt-0.5 size-5 shrink-0 text-[#2f837c]" aria-hidden="true" />
                ) : (
                  <AudioLines className="mt-0.5 size-5 shrink-0 text-[#2f837c]" aria-hidden="true" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold" title={audioFile.name}>
                    {audioFile.name}
                  </p>
                  <p className="mt-1 text-xs text-[#53627b]">
                    {formatBytes(audioFile.size)}
                    {transcriptionState.status === "ready"
                      ? ` · ${t("spoken.transcriptReadySuffix")}`
                      : transcriptionState.status === "validating"
                        ? ` · ${t("spoken.signatureCheckingSuffix")}`
                        : ` · ${t("spoken.awaitingTranscriptionSuffix")}`}
                  </p>
                </div>
              </div>
              <label
                htmlFor={audioInputId}
                className="mt-4 inline-flex cursor-pointer text-xs font-bold text-[#1f625e] underline decoration-[#2f837c]/30 underline-offset-4"
              >
                {t("spoken.replaceAudio")}
              </label>
            </div>
          ) : (
            <label
              htmlFor={audioInputId}
              onDragOver={(event) => event.preventDefault()}
              onDrop={dropFile}
              className="flex flex-1 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-[#14213d]/20 bg-[#f7f4ec]/65 px-4 py-5 text-center transition hover:border-[#2f837c] hover:bg-[#edf6f3]"
            >
              <Upload className="size-5 text-[#2f837c]" aria-hidden="true" />
              <span className="mt-2 text-sm font-bold">{t("spoken.chooseAudio")}</span>
              <span className="mt-1 text-xs leading-5 text-[#53627b]">
                {t("spoken.audioFormats", { megabytes: Math.round(MAX_AUDIO_FILE_BYTES / 1_000_000) })}
              </span>
            </label>
          )}

          <div className="rounded-2xl border border-[#daa83c]/30 bg-[#fff7df] p-3 text-xs leading-5 text-[#765511]">
            <p className="font-bold">{t("spoken.cloudTitle")}</p>
            <p className="mt-1">
              {t("spoken.cloudDisclosure")}
            </p>
          </div>

          {!audioConfigured && (
            <p className="rounded-xl bg-[#eee9dd] p-3 text-xs font-bold leading-5 text-[#53627b]">
              {t("spoken.unconfigured")}
            </p>
          )}

          {transcriptionState.status === "error" && (
            <div className="rounded-xl border border-[#ef6b5a]/35 bg-[#fff0ec] p-3 text-xs leading-5 text-[#a83f32]" role="alert">
              <p className="font-bold">{t("spoken.errorTitle")}</p>
              <p className="mt-1">{transcriptionState.message}</p>
            </div>
          )}

          {transcriptionState.status === "ready" && (
            <div className="rounded-2xl border border-[#14213d]/10 bg-white p-4">
              <p className="text-xs font-bold uppercase tracking-[0.13em] text-[#2f837c]">
                {t("spoken.timestampReady")}
              </p>
              <p className="mt-2 text-xs leading-5 text-[#53627b]">
                {formatDuration(transcriptionState.transcription.durationSeconds)} · {translateUiPlural(locale, transcriptionState.transcription.segments.length, { one: "spoken.segmentCountOne", other: "spoken.segmentCountOther" })} · {transcriptionState.transcription.model}
              </p>
              <details className="mt-3 rounded-xl bg-[#f7f4ec]">
                <summary className="cursor-pointer px-3 py-2 text-xs font-bold">
                  {t("spoken.previewTranscript")}
                </summary>
                <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words border-t border-[#14213d]/10 p-3 font-sans text-xs leading-5 text-[#53627b]">
                  {transcriptionState.transcription.text}
                </pre>
              </details>
              <div className="mt-3">
                <ExportActions
                  text={transcriptionState.transcription.text}
                  fileName={transcriptDownloadName(
                    transcriptionState.transcription.fileName,
                  )}
                  mimeType="text/plain;charset=utf-8"
                  copyLabel={t("spoken.copyTranscript")}
                  downloadLabel={t("spoken.downloadTranscript")}
                  t={t}
                />
              </div>
            </div>
          )}

          <button
            type="button"
            disabled={
              disabled ||
              !audioConfigured ||
              transcriptionState.status === "validating" ||
              audioFile === null ||
              transcribing ||
              invalidAudio ||
              blockedProvider
            }
            onClick={onTranscribe}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#14213d] px-4 text-sm font-bold text-white transition hover:bg-[#223252] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {transcribing ? (
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            ) : transcriptionState.status === "validating" ? (
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <AudioLines className="size-4" aria-hidden="true" />
            )}
            {transcribing
              ? t("spoken.transcribing")
              : transcriptionState.status === "validating"
                ? t("spoken.checkingAudio")
              : !audioConfigured
                ? t("spoken.audioUnavailable")
              : transcriptionState.status === "ready"
                ? t("spoken.transcribeAgain")
                : invalidAudio
                  ? t("spoken.replaceInvalid")
                : blockedProvider
                  ? t("spoken.checkConfiguration")
                : transcriptionState.status === "error" && transcriptionState.retryable
                  ? t("spoken.retry")
                  : t("spoken.send")}
          </button>
          <p className="sr-only" aria-live="polite">
            {transcribing
              ? t("spoken.progressTranscribing")
              : transcriptionState.status === "validating"
                ? t("spoken.progressValidating")
              : transcriptionState.status === "ready"
                ? t("spoken.progressReady")
                : ""}
          </p>
        </div>
      )}

      <input
        key={`transcript-${inputKey}`}
        id={transcriptInputId}
        type="file"
        className="sr-only"
        accept=".txt,text/plain"
        disabled={disabled}
        onChange={selectTranscript}
        aria-label={t("spoken.chooseTranscriptAria")}
      />
      <input
        key={`audio-${inputKey}`}
        id={audioInputId}
        type="file"
        className="sr-only"
        accept={AUDIO_FILE_EXTENSIONS.join(",")}
        disabled={disabled}
        onChange={selectAudio}
        aria-label={t("spoken.chooseAudioAria")}
      />
    </article>
  );
}

function LoadingPanel({ message, kind, t }: { message: string; kind: LoadingKind; t: UiTranslator }) {
  const steps =
    kind === "live"
      ? [t("pipeline.validateFiles"), t("pipeline.auditConcepts"), t("pipeline.rebuildNotes"), t("pipeline.createStudyTools"), t("pipeline.hydrateEvidence")]
      : kind === "demo"
        ? [t("pipeline.validateFiles"), t("pipeline.extractNormalize"), t("pipeline.verifyFixture"), t("pipeline.buildStudyPack"), t("pipeline.hydrateEvidence")]
        : [t("pipeline.validateFiles"), t("pipeline.extractNormalize"), t("pipeline.buildSourceMap")];
  const eyebrow =
    kind === "live"
      ? t("pipeline.live")
      : kind === "demo"
        ? t("pipeline.demo")
        : t("pipeline.local");
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
            {kind === "live" && (
              <p className="mt-2 max-w-2xl text-xs leading-5 text-white/60">
                {t("pipeline.liveWaitHint")}
              </p>
            )}
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
  locale,
  t,
}: {
  processed: ProcessedSources;
  origin: AnalysisResult["origin"] | null;
  locale: UiLocale;
  t: UiTranslator;
}) {
  const statusLabel =
    origin?.kind === "demo"
      ? t("sourceMap.sampleVerified")
      : origin?.kind === "live"
        ? `${origin.providerLabel} · ${origin.model}`
        : t("sourceMap.localReady");
  const completedAnalysis = origin !== null;

  return (
    <section className="rounded-[28px] border border-[#14213d]/10 bg-white/70 p-6 shadow-card sm:p-8" aria-labelledby="source-map-title">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#2f837c]">{t("sourceMap.eyebrow")}</p>
          <h2 id="source-map-title" className="mt-2 text-2xl font-bold tracking-[-0.04em]">{t("sourceMap.title")}</h2>
          <p className="mt-2 text-sm leading-6 text-[#53627b]">{t("sourceMap.description")}</p>
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
                <span className="text-sm font-bold">{sourceName(sourceType, t)}</span>
                <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-[#53627b]">{translateUiPlural(locale, chunks.length, { one: "sourceMap.chunkCountOne", other: "sourceMap.chunkCountOther" })}</span>
              </div>
              <p className="mt-4 truncate text-xs text-[#53627b]" title={chunks[0]?.sourceName}>{chunks[0]?.sourceName}</p>
              <p className="mt-1 text-xs font-bold text-[#2f837c]">
                {chunks[0]?.locator}{chunks.length > 1 ? ` → ${chunks.at(-1)?.locator}` : ""}
              </p>
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-xs text-[#53627b]">{t("sourceMap.total", { characters: processed.totalCharacters.toLocaleString(locale), chunks: processed.chunks.length })}</p>
    </section>
  );
}

const SESSION_PROVIDER_IDS = ["openai", "deepseek", "kimi"] as const satisfies readonly ProviderId[];
const SESSION_PROVIDER_LABELS: Readonly<Record<ProviderId, string>> = {
  openai: "OpenAI",
  deepseek: "DeepSeek",
  kimi: "Kimi",
};

function sessionKeyStatus(value: string | undefined): "empty" | "valid" | "invalid" {
  if (value === undefined || value.length === 0) return "empty";
  return SessionProviderKeySchema.safeParse(value).success ? "valid" : "invalid";
}

function ProviderControls({
  catalog,
  target,
  sessionKeys,
  kimiRegion,
  disabled,
  onProviderChange,
  onModelChange,
  onSessionKeyChange,
  onClearSessionKey,
  onClearAllSessionKeys,
  onKimiRegionChange,
  t,
}: {
  catalog: PublicProviderCatalog;
  target: AnalysisTarget | null;
  sessionKeys: SessionProviderKeys;
  kimiRegion: KimiRegion | null;
  disabled: boolean;
  onProviderChange: (provider: PublicProvider) => void;
  onModelChange: (model: string) => void;
  onSessionKeyChange: (provider: ProviderId, value: string) => void;
  onClearSessionKey: (provider: ProviderId) => void;
  onClearAllSessionKeys: () => void;
  onKimiRegionChange: (region: KimiRegion | null) => void;
  t: UiTranslator;
}) {
  const selectedProvider = catalog.providers.find(
    (provider) => provider.id === target?.provider,
  );
  const selectedModel = selectedProvider?.models.find(
    (model) => model.id === target?.model,
  );
  const selectedSessionStatus =
    selectedProvider === undefined
      ? "empty"
      : sessionKeyStatus(sessionKeys[selectedProvider.id]);
  const selectedSessionReady =
    selectedSessionStatus === "valid" &&
    (selectedProvider?.id !== "kimi" || kimiRegion !== null);
  const hasSessionInput = SESSION_PROVIDER_IDS.some(
    (provider) => (sessionKeys[provider]?.length ?? 0) > 0,
  );
  const selectedCredentialLabel =
    selectedSessionReady
      ? t("provider.temporaryActive")
      : selectedSessionStatus === "valid" && selectedProvider?.id === "kimi"
        ? t("provider.kimiRegionPlaceholder")
        : selectedSessionStatus === "invalid"
          ? t("provider.temporaryInvalid")
          : selectedProvider?.configured
            ? t("provider.serverKeyConfigured")
            : t("provider.localOnly");
  const selectedCredentialClass =
    selectedSessionReady ||
    (selectedSessionStatus === "empty" && selectedProvider?.configured)
      ? "bg-[#dcece8] text-[#1f625e]"
      : selectedSessionStatus === "invalid"
        ? "bg-[#fee4dd] text-[#a83f32]"
        : "bg-[#f8ebc8] text-[#765511]";

  return (
    <fieldset className="mt-6 rounded-[24px] border border-[#14213d]/10 bg-white/55 p-4 sm:p-5">
      <legend className="px-2 text-xs font-bold uppercase tracking-[0.16em] text-[#2f837c]">
        {t("provider.legend")}
      </legend>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm font-bold" htmlFor="analysis-provider">
          {t("provider.providerLabel")}
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
              <option value="">{t("provider.noneConfigured")}</option>
            )}
            {catalog.providers.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.label}{provider.configured ? "" : ` — ${t("provider.notConfiguredSuffix")}`}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm font-bold" htmlFor="analysis-model">
          {t("provider.modelLabel")}
          <select
            id="analysis-model"
            value={target?.model ?? ""}
            disabled={disabled || selectedProvider === undefined || selectedProvider.models.length === 0}
            onChange={(event) => onModelChange(event.currentTarget.value)}
            className="mt-2 min-h-11 w-full rounded-xl border border-[#14213d]/15 bg-white px-3 text-sm text-[#14213d] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {selectedProvider === undefined && <option value="">{t("provider.noModel")}</option>}
            {selectedProvider?.models.map((model) => (
              <option key={model.id} value={model.id}>{model.label}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-4 flex flex-col gap-2 text-xs leading-5 text-[#53627b] sm:flex-row sm:items-start sm:justify-between">
        <p className="max-w-3xl">
          {selectedModel?.description ?? selectedProvider?.description ?? t("provider.noSettings")}
        </p>
        <span className={`inline-flex w-fit shrink-0 rounded-full px-2.5 py-1 font-bold ${selectedCredentialClass}`}>
          {selectedCredentialLabel}
        </span>
      </div>

      <div className="mt-5 border-t border-[#14213d]/10 pt-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-sm font-bold text-[#14213d]">
              {t("provider.temporaryTitle")}
            </h3>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-[#53627b]">
              {t("provider.temporaryDescription")}
            </p>
          </div>
          <button
            type="button"
            disabled={disabled || !hasSessionInput}
            onClick={onClearAllSessionKeys}
            className="inline-flex min-h-9 w-fit shrink-0 items-center justify-center rounded-lg border border-[#14213d]/15 bg-white px-3 text-xs font-bold text-[#14213d] transition hover:bg-[#f7f4ec] disabled:cursor-not-allowed disabled:opacity-45"
          >
            {t("provider.clearAll")}
          </button>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          {SESSION_PROVIDER_IDS.map((providerId) => {
            const providerLabel =
              catalog.providers.find((provider) => provider.id === providerId)?.label ??
              SESSION_PROVIDER_LABELS[providerId];
            const value = sessionKeys[providerId] ?? "";
            const status = sessionKeyStatus(value);
            const inputId = `temporary-${providerId}-key`;
            const statusId = `${inputId}-status`;

            return (
              <div
                key={providerId}
                className="rounded-2xl border border-[#14213d]/10 bg-[#f7f4ec]/70 p-4"
              >
                <label htmlFor={inputId} className="block text-xs font-bold text-[#14213d]">
                  {t("provider.temporaryKeyLabel", { provider: providerLabel })}
                </label>
                <input
                  id={inputId}
                  type="password"
                  value={value}
                  disabled={disabled}
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  data-1p-ignore="true"
                  data-lpignore="true"
                  aria-invalid={status === "invalid"}
                  aria-describedby={statusId}
                  onChange={(event) =>
                    onSessionKeyChange(providerId, event.currentTarget.value)
                  }
                  placeholder={t("provider.temporaryKeyPlaceholder")}
                  className="mt-2 min-h-11 w-full rounded-xl border border-[#14213d]/15 bg-white px-3 font-mono text-sm text-[#14213d] placeholder:font-sans disabled:cursor-not-allowed disabled:opacity-60"
                />
                <div className="mt-2 flex min-h-7 items-start justify-between gap-3">
                  <p
                    id={statusId}
                    aria-live="polite"
                    className={`text-[11px] leading-5 ${
                      status === "valid"
                        ? "font-bold text-[#1f625e]"
                        : status === "invalid"
                          ? "font-bold text-[#a83f32]"
                          : "text-[#53627b]"
                    }`}
                  >
                    {status === "valid"
                      ? providerId === "kimi" && kimiRegion === null
                        ? t("provider.kimiRegionPlaceholder")
                        : t("provider.temporaryReady")
                      : status === "invalid"
                        ? t("provider.temporaryInvalid")
                        : t("provider.temporaryEmpty")}
                  </p>
                  <button
                    type="button"
                    disabled={disabled || value.length === 0}
                    onClick={() => onClearSessionKey(providerId)}
                    className="shrink-0 text-[11px] font-bold text-[#1f625e] underline decoration-[#2f837c]/30 underline-offset-4 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {t("provider.clearKey", { provider: providerLabel })}
                  </button>
                </div>

                {providerId === "kimi" && (
                  <label htmlFor="temporary-kimi-region" className="mt-3 block text-xs font-bold text-[#14213d]">
                    {t("provider.kimiRegionLabel")}
                    <select
                      id="temporary-kimi-region"
                      value={kimiRegion ?? ""}
                      disabled={disabled}
                      onChange={(event) =>
                        onKimiRegionChange(
                          event.currentTarget.value === "cn" ||
                            event.currentTarget.value === "global"
                            ? event.currentTarget.value
                            : null,
                        )
                      }
                      className="mt-2 min-h-10 w-full rounded-xl border border-[#14213d]/15 bg-white px-3 text-xs text-[#14213d] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <option value="">{t("provider.kimiRegionPlaceholder")}</option>
                      <option value="cn">{t("provider.kimiRegionCn")}</option>
                      <option value="global">{t("provider.kimiRegionGlobal")}</option>
                    </select>
                  </label>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-4 rounded-2xl border border-[#daa83c]/30 bg-[#fff7df] p-4 text-xs leading-5 text-[#765511]">
          <p className="flex items-start gap-2 font-bold">
            <Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>{t("provider.temporaryTrust")}</span>
          </p>
          <p className="mt-2 pl-6">{t("provider.temporaryVisibility")}</p>
        </div>
      </div>
    </fieldset>
  );
}

function OutputOptions({
  includeAnki,
  locale,
  outputLanguagePreference,
  disabled,
  onAnkiChange,
  onOutputLanguageChange,
  t,
}: {
  includeAnki: boolean;
  locale: UiLocale;
  outputLanguagePreference: OutputLanguagePreference;
  disabled: boolean;
  onAnkiChange: (includeAnki: boolean) => void;
  onOutputLanguageChange: (language: OutputLanguagePreference) => void;
  t: UiTranslator;
}) {
  const interfaceLanguage =
    UI_LOCALE_OPTIONS.find((option) => option.value === locale)?.label ??
    locale;

  return (
    <section
      aria-labelledby="study-pack-outputs-title"
      className="mt-4 min-w-0 rounded-[24px] border border-[#14213d]/10 bg-[#14213d] p-4 text-white sm:p-5"
    >
      <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h2
            id="study-pack-outputs-title"
            className="inline-flex max-w-full rounded-xl bg-white/10 px-3 py-2 text-sm font-bold leading-5 text-[#b8dcd6] [overflow-wrap:anywhere]"
          >
            {t("outputs.legend")}
          </h2>
          <p className="mt-2 max-w-2xl text-xs leading-5 text-white/60">
            {t("outputs.languageDescription")}
          </p>
        </div>

        <label
          className="block min-w-0 text-xs font-bold text-white lg:w-80 lg:shrink-0"
          htmlFor="study-pack-output-language"
        >
          {t("outputs.languageLabel")}
          <select
            id="study-pack-output-language"
            value={outputLanguagePreference}
            disabled={disabled}
            onChange={(event) => {
              const value = event.currentTarget.value;
              if (isOutputLanguagePreference(value)) {
                onOutputLanguageChange(value);
              }
            }}
            className="mt-2 min-h-11 w-full rounded-xl border border-white/15 bg-white px-3 text-sm text-[#14213d] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <option value="follow-interface">
              {t("outputs.followInterface", { language: interfaceLanguage })}
            </option>
            {UI_LOCALE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-4 grid min-w-0 gap-3 lg:grid-cols-2">
        <div className="flex min-w-0 items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.06] p-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#2f837c]">
            <BookOpen className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1 [overflow-wrap:anywhere]">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <p className="text-sm font-bold">{t("outputs.notesTitle")}</p>
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-[#b8dcd6]">
                {t("outputs.alwaysIncluded")}
              </span>
            </div>
            <p className="mt-1 text-xs leading-5 text-white/60">
              {t("outputs.notesDescription")}
            </p>
          </div>
        </div>

        <label className="flex min-w-0 cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.06] p-4 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#ef6b5a]">
          <input
            type="checkbox"
            checked={includeAnki}
            disabled={disabled}
            onChange={(event) => onAnkiChange(event.currentTarget.checked)}
            className="mt-2 size-4 shrink-0 accent-[#ef6b5a]"
          />
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#ef6b5a]">
            <Brain className="size-5" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
            <span className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="block text-sm font-bold">{t("outputs.ankiTitle")}</span>
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-[#ffd5cf]">
                {t("outputs.optional")}
              </span>
            </span>
            <span className="mt-1 block text-xs leading-5 text-white/60">
              {t("outputs.ankiDescription")}
            </span>
          </span>
        </label>
      </div>
      <p className="mt-3 px-1 text-xs leading-5 text-white/55">
        {t("outputs.retention")}
      </p>
      <p className="mt-2 px-1 text-[11px] leading-5 text-white/45">
        {t("outputs.demoLanguageNote")}
      </p>
    </section>
  );
}

function PipelineErrorPanel({
  error,
  onRetryLive,
  onRetryDemo,
  onUseLectureText,
  allowLectureTextRecovery,
  t,
  locale,
}: {
  error: PipelineErrorState;
  onRetryLive: () => void;
  onRetryDemo: () => void;
  onUseLectureText: () => void;
  allowLectureTextRecovery: boolean;
  t: UiTranslator;
  locale: UiLocale;
}) {
  const liveFailure = error.kind === "live";
  const liveTimeout = liveFailure && error.liveCode === "provider_timeout";
  const demoFailure = error.kind === "demo";
  const lectureSourceFailure =
    allowLectureTextRecovery &&
    error.kind === "processing" &&
    error.sourceType === "slides" &&
    error.processingCode !== undefined &&
    PDF_TEXT_RECOVERY_CODES.has(error.processingCode);

  return (
    <section className="rounded-[24px] border border-[#ef6b5a]/35 bg-[#fff0ec] p-6" role="alert">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#fee4dd] text-[#a83f32]"><AlertTriangle className="size-5" /></span>
          <div>
            <h2 className="font-bold">{liveFailure ? t("error.liveTitle") : demoFailure ? t("error.demoTitle") : t("error.processingTitle")}</h2>
            <p className="mt-2 text-sm leading-6 text-[#53627b]">{error.message}</p>
            <p className="mt-2 text-xs text-[#53627b]">
              {liveFailure
                ? liveTimeout
                  ? t("error.liveTimeoutRecovery")
                  : error.retryable
                  ? t("error.liveRetryRecovery")
                  : t("error.liveConfigRecovery")
                : demoFailure
                  ? t("error.demoRecovery")
                : t("error.replaceAndRetry")}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {lectureSourceFailure && (
            <button type="button" onClick={onUseLectureText} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#2f837c] px-5 text-sm font-bold text-white hover:bg-[#1f625e]">
              <FileText className="size-4" aria-hidden="true" /> {t("error.useLectureText")}
            </button>
          )}
          {liveFailure && error.retryable && (
            <button type="button" onClick={onRetryLive} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#14213d] px-5 text-sm font-bold text-white hover:bg-[#223252]">
              <RotateCcw className="size-4" /> {t("error.retry")}
            </button>
          )}
          {demoFailure && (
            <button type="button" onClick={onRetryDemo} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#14213d] px-5 text-sm font-bold text-white hover:bg-[#223252]">
              <RotateCcw className="size-4" /> {locale === "en" ? "Retry included demo" : t("error.retryDemo")}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

function SourceMapOnlyPanel({
  provider,
  canAnalyzeLive,
  analysisHint,
  onTryDemo,
  onAnalyzeLive,
  t,
}: {
  provider?: PublicProvider;
  canAnalyzeLive: boolean;
  analysisHint: string;
  onTryDemo: () => void;
  onAnalyzeLive: () => void;
  t: UiTranslator;
}) {
  return (
    <section className="rounded-[28px] border border-[#daa83c]/35 bg-[#fff9e9] p-6 sm:p-8" role="status">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex max-w-3xl items-start gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#f8ebc8] text-[#765511]">
            <Lock className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-lg font-bold tracking-[-0.025em]">{t("empty.title")}</h2>
            <p id="source-map-analysis-status" className="mt-2 text-sm leading-6 text-[#53627b]">
              {provider === undefined
                ? t("empty.unconfigured")
                : canAnalyzeLive
                  ? t("empty.notSent", { provider: provider.label })
                  : analysisHint}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {provider !== undefined && (
            <button
              type="button"
              disabled={!canAnalyzeLive}
              aria-describedby="source-map-analysis-status"
              onClick={onAnalyzeLive}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#2f837c] px-5 text-sm font-bold text-white hover:bg-[#1f625e] disabled:cursor-not-allowed disabled:bg-[#14213d]/20"
            >
              <ScanText className="size-4" /> {t("empty.analyzeCurrent", { provider: provider.label })}
            </button>
          )}
          <button type="button" onClick={onTryDemo} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#14213d] px-5 text-sm font-bold text-white hover:bg-[#223252]">
            <Sparkles className="size-4" /> {t("error.tryDemo")}
          </button>
        </div>
      </div>
    </section>
  );
}

function ScorePanel({ result, t }: { result: AnalysisResult; t: UiTranslator }) {
  const { score, counts, total } = result.metrics;
  const scoreLabel = score >= 80 ? t("score.strong") : score >= 60 ? t("score.gaps") : t("score.needsPass");
  const originLabel =
    result.origin.kind === "demo"
      ? t("score.demoOrigin")
      : t("score.liveOrigin", { provider: result.origin.providerLabel, model: result.origin.model });
  const countItems: readonly { status: AssessmentStatus; label: string; color: string }[] = [
    { status: "covered", label: t("score.covered"), color: "bg-[#2f837c]" },
    { status: "partial", label: t("score.partial"), color: "bg-[#daa83c]" },
    { status: "missing", label: t("score.missing"), color: "bg-[#ef6b5a]" },
    { status: "contradiction", label: t("score.contradictions"), color: "bg-[#376ab4]" },
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
                <p className="mt-2 text-xs font-bold uppercase tracking-[0.15em] text-[#b8dcd6]">{t("score.coverage")}</p>
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
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/55">{t("score.conceptsAudited", { count: total })}</div>
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
          <p className="mt-5 flex items-center gap-2 text-xs text-white/45"><Lock className="size-3.5" /> {t("score.explanation")}</p>
        </div>
      </div>
    </section>
  );
}

function EvidenceChips({ evidence, t }: { evidence: readonly HydratedEvidence[]; t: UiTranslator }) {
  return (
    <div className="mt-5 flex flex-wrap gap-2">
      {evidence.slice(0, 3).map((item) => (
        <span key={item.chunkId} className="inline-flex items-center gap-1.5 rounded-full border border-[#14213d]/10 bg-[#f7f4ec] px-2.5 py-1.5 text-[11px] font-bold text-[#53627b]">
          <span className={`size-1.5 rounded-full ${item.chunk.sourceType === "notes" ? "bg-[#376ab4]" : "bg-[#2f837c]"}`} />
          {sourceName(item.chunk.sourceType, t)} · {item.chunk.locator}
        </span>
      ))}
      {evidence.length > 3 && <span className="px-2 py-1.5 text-[11px] font-bold text-[#53627b]">{t("evidence.more", { count: evidence.length - 3 })}</span>}
    </div>
  );
}

function IssueCard({ assessment, onOpen, t }: { assessment: HydratedConceptAssessment; onOpen: () => void; t: UiTranslator }) {
  if (assessment.status === "covered") return null;
  const meta = STATUS_META[assessment.status];
  const Icon = meta.icon;
  return (
    <article className={`animate-rise rounded-[24px] border border-[#14213d]/10 border-l-4 ${meta.accent} bg-white/75 p-5 shadow-[0_12px_35px_rgba(20,33,61,0.055)] sm:p-6`}>
      <div className="flex items-start justify-between gap-4">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.1em] ${meta.pill}`}>
          <Icon className="size-3.5" aria-hidden="true" /> {issueLabel(assessment.status, t)}
        </span>
        <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#53627b]">{assessment.importance === "core" ? t("review.core") : t("review.supporting")}</span>
      </div>
      <h3 className="mt-5 text-xl font-bold tracking-[-0.035em]">{assessment.title}</h3>
      <p className="mt-3 text-sm leading-6 text-[#53627b]">{assessment.explanation}</p>
      <EvidenceChips evidence={assessment.evidence} t={t} />
      <button type="button" onClick={onOpen} className="mt-6 inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#14213d] px-4 text-sm font-bold text-white transition hover:bg-[#2f837c]">
        <Eye className="size-4" aria-hidden="true" /> {t("review.inspectEvidence")} <ChevronRight className="size-4" aria-hidden="true" />
      </button>
    </article>
  );
}

function IssuesPanel({
  result,
  onOpen,
  t,
}: {
  result: AnalysisResult;
  onOpen: (assessment: HydratedConceptAssessment) => void;
  t: UiTranslator;
}) {
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
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#2f837c]">{t("review.eyebrow")}</p>
          <h2 id="review-title" className="mt-2 text-3xl font-bold tracking-[-0.045em] sm:text-4xl">{t("review.title")}</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#53627b]">{t("review.description")}</p>
        </div>
        <div className="flex max-w-full gap-1 overflow-x-auto rounded-2xl border border-[#14213d]/10 bg-white/65 p-1.5" aria-label={t("review.filterAria")} role="group">
          {FILTERS.map((item) => (
            <button
              key={item.value}
              type="button"
              aria-pressed={filter === item.value}
              onClick={() => setFilter(item.value)}
              className={`min-h-9 shrink-0 rounded-xl px-3 text-xs font-bold transition ${filter === item.value ? "bg-[#14213d] text-white" : "text-[#53627b] hover:bg-[#14213d]/5"}`}
            >
              {item.value === "all" ? t("review.all") : item.value === "missing" ? t("review.missing") : item.value === "partial" ? t("review.partial") : t("review.contradictions")}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-7 grid gap-4 lg:grid-cols-2">
        {visibleIssues.map((assessment) => <IssueCard key={assessment.id} assessment={assessment} onOpen={() => onOpen(assessment)} t={t} />)}
      </div>
      {visibleIssues.length === 0 && <p className="mt-7 rounded-2xl border border-[#14213d]/10 bg-white/60 p-6 text-sm text-[#53627b]">{t("review.none")}</p>}
    </section>
  );
}

function ExportActions({
  text,
  fileName,
  mimeType,
  copyLabel,
  downloadLabel,
  t,
}: {
  text: string;
  fileName: string;
  mimeType: string;
  copyLabel: string;
  downloadLabel: string;
  t: UiTranslator;
}) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");

  const fallbackCopy = (): boolean => {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.readOnly = true;
    textarea.style.position = "fixed";
    textarea.style.inset = "0 auto auto -9999px";
    document.body.append(textarea);
    textarea.select();
    textarea.setSelectionRange(0, text.length);
    try {
      return typeof document.execCommand === "function" && document.execCommand("copy");
    } finally {
      textarea.remove();
    }
  };

  const copyText = async () => {
    try {
      if (navigator.clipboard?.writeText === undefined) {
        if (!fallbackCopy()) throw new Error("Clipboard unavailable.");
      } else {
        await navigator.clipboard.writeText(text);
      }
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1_800);
    } catch {
      if (fallbackCopy()) {
        setCopyState("copied");
        window.setTimeout(() => setCopyState("idle"), 1_800);
      } else {
        setCopyState("error");
      }
    }
  };

  const download = () => {
    const url = URL.createObjectURL(new Blob([text], { type: mimeType }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => void copyText()}
        className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#14213d]/15 bg-white px-4 text-sm font-bold hover:bg-[#f7f4ec]"
      >
        {copyState === "copied" ? <Check className="size-4 text-[#2f837c]" /> : <Clipboard className="size-4" />}
        {copyState === "copied" ? t("export.copied") : copyState === "error" ? t("export.copyFailed") : copyLabel}
      </button>
      <button
        type="button"
        onClick={download}
        className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#ef6b5a] px-4 text-sm font-bold text-white hover:bg-[#db5849]"
      >
        <Download className="size-4" /> {downloadLabel}
      </button>
      <p className="sr-only" aria-live="polite">
        {copyState === "copied" ? t("export.copiedAnnouncement", { label: copyLabel }) : copyState === "error" ? t("export.clipboardUnavailable") : ""}
      </p>
    </div>
  );
}

const CHANGE_META: Record<
  NoteChangeType,
  { label: string; className: string }
> = {
  preserved: { label: "Preserved", className: "bg-[#dcece8] text-[#1f625e]" },
  expanded: { label: "Expanded", className: "bg-[#f8ebc8] text-[#765511]" },
  corrected: { label: "Corrected", className: "bg-[#dfe8f7] text-[#244f8d]" },
  new: { label: "New", className: "bg-[#fee4dd] text-[#a83f32]" },
};

function changeLabel(changeType: NoteChangeType, t: UiTranslator): string {
  if (changeType === "preserved") return t("notes.preserved");
  if (changeType === "expanded") return t("notes.expanded");
  if (changeType === "corrected") return t("notes.corrected");
  return t("notes.new");
}

function renderInlineMarkdown(value: string, keyPrefix: string): ReactNode[] {
  return value
    .split(/(\*\*[^*\n]+\*\*|`[^`\n]+`|\*[^*\n]+\*)/g)
    .filter((token) => token.length > 0)
    .map((token, index) => {
      const key = `${keyPrefix}-${index}`;
      if (token.startsWith("**") && token.endsWith("**")) {
        return <strong key={key} className="font-bold text-[#14213d]">{token.slice(2, -2)}</strong>;
      }
      if (token.startsWith("`") && token.endsWith("`")) {
        return <code key={key} className="rounded bg-[#14213d]/8 px-1 py-0.5 font-mono text-[0.92em] text-[#14213d]">{token.slice(1, -1)}</code>;
      }
      if (token.startsWith("*") && token.endsWith("*")) {
        return <em key={key}>{token.slice(1, -1)}</em>;
      }
      return token;
    });
}

function SafeMarkdownBody({ markdown }: { markdown: string }) {
  const blocks = markdown.trim().split(/\n{2,}/);
  return (
    <div className="space-y-3 text-sm leading-7 text-[#53627b]">
      {blocks.map((block, blockIndex) => {
        const lines = block.split("\n").filter((line) => line.trim().length > 0);
        const key = `markdown-block-${blockIndex}`;
        if (lines.every((line) => /^\s*[-+*]\s+/.test(line))) {
          return (
            <ul key={key} className="list-disc space-y-1 pl-5 marker:text-[#ef6b5a]">
              {lines.map((line, lineIndex) => (
                <li key={`${key}-${lineIndex}`}>{renderInlineMarkdown(line.replace(/^\s*[-+*]\s+/, ""), `${key}-${lineIndex}`)}</li>
              ))}
            </ul>
          );
        }
        if (lines.every((line) => /^\s*\d+[.)]\s+/.test(line))) {
          return (
            <ol key={key} className="list-decimal space-y-1 pl-5 marker:font-bold marker:text-[#2f837c]">
              {lines.map((line, lineIndex) => (
                <li key={`${key}-${lineIndex}`}>{renderInlineMarkdown(line.replace(/^\s*\d+[.)]\s+/, ""), `${key}-${lineIndex}`)}</li>
              ))}
            </ol>
          );
        }
        const subheading = lines.length === 1 ? lines[0]?.match(/^#{3,6}\s+(.+)$/) : null;
        if (subheading?.[1] !== undefined) {
          return <h4 key={key} className="pt-1 text-base font-bold text-[#14213d]">{renderInlineMarkdown(subheading[1], key)}</h4>;
        }
        if (lines.every((line) => /^\s*>\s?/.test(line))) {
          return <blockquote key={key} className="border-l-2 border-[#ef6b5a] pl-4 italic">{renderInlineMarkdown(lines.map((line) => line.replace(/^\s*>\s?/, "")).join(" "), key)}</blockquote>;
        }
        return (
          <p key={key}>
            {lines.map((line, lineIndex) => (
              <span key={`${key}-${lineIndex}`}>
                {lineIndex > 0 ? <br /> : null}
                {renderInlineMarkdown(line, `${key}-${lineIndex}`)}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}

function EnhancedNotesPanel({
  result,
  onOpen,
  t,
}: {
  result: AnalysisResult;
  onOpen: (section: HydratedEnhancedNoteSection) => void;
  t: UiTranslator;
}) {
  return (
    <section className="overflow-hidden rounded-[30px] border border-[#14213d]/10 bg-white/80 shadow-card" aria-labelledby="enhanced-notes-title">
      <div className="flex flex-col gap-5 border-b border-[#14213d]/10 p-6 lg:flex-row lg:items-center lg:justify-between sm:p-8">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#2f837c]">{t("notes.eyebrow")}</p>
          <h2 id="enhanced-notes-title" className="mt-2 text-3xl font-bold tracking-[-0.045em]">{t("notes.title")}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#53627b]">{t("notes.description")}</p>
        </div>
        <ExportActions
          text={result.enhancedMarkdown}
          fileName="lectureweaver-enhanced-notes.md"
          mimeType="text/markdown;charset=utf-8"
          copyLabel={t("notes.copy")}
          downloadLabel={t("notes.export")}
          t={t}
        />
      </div>

      <div className="bg-[#f7f4ec]/75 p-5 sm:p-8">
        <div className="rounded-2xl border border-[#14213d]/10 bg-white p-5 sm:p-6">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#53627b]">{t("notes.sectionCount", { count: result.hydrated.enhancedNotes.sections.length })}</p>
          <h3 className="mt-2 text-2xl font-bold tracking-[-0.035em]">{result.hydrated.enhancedNotes.title}</h3>
          <div className="mt-3"><SafeMarkdownBody markdown={result.hydrated.enhancedNotes.overview} /></div>
        </div>

        <nav className="mt-5 rounded-2xl border border-[#14213d]/10 bg-[#14213d] p-5 text-white sm:p-6" aria-label={t("notes.contentsAria")}>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#b8dcd6]">{t("notes.contents")}</p>
          <ol className="mt-4 grid gap-2 md:grid-cols-2">
            {result.hydrated.enhancedNotes.sections.map((section, index) => (
              <li key={section.id}>
                <a href={`#enhanced-section-${index + 1}`} className="group flex min-h-11 items-center gap-3 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-sm font-bold transition hover:bg-white/[0.12] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ef6b5a]">
                  <span className="text-xs text-[#ef9b8d]">{String(index + 1).padStart(2, "0")}</span>
                  <span className="flex-1">{section.heading}</span>
                  <ArrowRight className="size-4 text-white/35 transition group-hover:translate-x-0.5 group-hover:text-white" aria-hidden="true" />
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {result.hydrated.enhancedNotes.sections.map((section, index) => {
            const change = CHANGE_META[section.changeType];
            return (
              <article id={`enhanced-section-${index + 1}`} key={section.id} className="scroll-mt-5 rounded-[24px] border border-[#14213d]/10 bg-white p-5 sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${change.className}`}>{changeLabel(section.changeType, t)}</span>
                  <span className="text-xs font-bold text-[#53627b]">{String(index + 1).padStart(2, "0")}</span>
                </div>
                <h3 className="mt-4 text-xl font-bold tracking-[-0.03em]">{section.heading}</h3>
                <p className="mt-2 text-xs font-bold leading-5 text-[#2f837c]">{t("notes.learningObjective")} · {section.learningObjective}</p>
                <div className="mt-4"><SafeMarkdownBody markdown={section.markdown} /></div>
                <EvidenceChips evidence={section.evidence} t={t} />
                <button type="button" onClick={() => onOpen(section)} className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#14213d]/15 px-4 text-sm font-bold hover:bg-[#f7f4ec]">
                  <Eye className="size-4" aria-hidden="true" /> {t("notes.inspectSources")}
                </button>
              </article>
            );
          })}
        </div>

        <details className="mt-5 rounded-2xl border border-[#14213d]/10 bg-[#111a30] text-white">
          <summary className="cursor-pointer px-5 py-4 text-sm font-bold">{t("notes.viewMarkdown")}</summary>
          <pre className="max-h-[34rem] overflow-auto whitespace-pre-wrap break-words border-t border-white/10 p-5 font-mono text-[13px] leading-6 text-[#e8edf5]">{result.enhancedMarkdown}</pre>
        </details>
      </div>
    </section>
  );
}

function AnkiPanel({
  result,
  onOpen,
  t,
}: {
  result: AnalysisResult;
  onOpen: (card: HydratedAnkiCard) => void;
  t: UiTranslator;
}) {
  const cards = result.hydrated.ankiCards;

  if (cards.length === 0) {
    return (
      <section className="rounded-[30px] border border-[#14213d]/10 bg-white/75 p-8 text-center shadow-card" aria-labelledby="anki-title">
        <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#eee9dd] text-[#53627b]"><Brain className="size-6" /></span>
        <h2 id="anki-title" className="mt-4 text-2xl font-bold">{t("anki.notRequestedTitle")}</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[#53627b]">{t("anki.notRequestedDescription")}</p>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-[30px] border border-[#14213d]/10 bg-white/80 shadow-card" aria-labelledby="anki-title">
      <div className="flex flex-col gap-5 border-b border-[#14213d]/10 p-6 lg:flex-row lg:items-center lg:justify-between sm:p-8">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#ef6b5a]">{t("anki.eyebrow")}</p>
          <h2 id="anki-title" className="mt-2 text-3xl font-bold tracking-[-0.045em]">{t("anki.readyCount", { count: cards.length })}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#53627b]">{t("anki.description")}</p>
        </div>
        <ExportActions
          text={result.ankiImportText}
          fileName="lectureweaver-anki.txt"
          mimeType="text/plain;charset=utf-8"
          copyLabel={t("anki.copy")}
          downloadLabel={t("anki.download")}
          t={t}
        />
      </div>

      <div className="grid gap-4 bg-[#f7f4ec]/75 p-5 lg:grid-cols-2 sm:p-8">
        {cards.map((card, index) => (
          <article key={card.id} className="rounded-[24px] border border-[#14213d]/10 bg-white p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <span className="rounded-full bg-[#14213d] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white">{t("anki.basicCard")}</span>
              <span className="text-xs font-bold text-[#53627b]">{String(index + 1).padStart(2, "0")}</span>
            </div>
            <p className="mt-5 text-xs font-bold uppercase tracking-[0.12em] text-[#2f837c]">{t("anki.front")}</p>
            <h3 className="mt-2 text-lg font-bold leading-7">{card.front}</h3>
            <details className="mt-4 rounded-2xl bg-[#f7f4ec] p-4">
              <summary className="cursor-pointer text-sm font-bold">{t("anki.reveal")}</summary>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#53627b]">{card.back}</p>
            </details>
            <EvidenceChips evidence={card.evidence} t={t} />
            <button type="button" onClick={() => onOpen(card)} className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#14213d]/15 px-4 text-sm font-bold hover:bg-[#f7f4ec]">
              <Eye className="size-4" aria-hidden="true" /> {t("anki.inspectSource")}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

type GeneratedAudioState = {
  url: string;
  fileName: string;
  scriptId: string;
  scriptLabel: string;
  voice: AudioVoice;
  format: AudioSpeechFormat;
};

function AudioStudyGuidePanel({
  result,
  audioConfigured,
  sessionApiKey,
  t,
}: {
  result: AnalysisResult;
  audioConfigured: boolean;
  sessionApiKey?: string;
  t: UiTranslator;
}) {
  const scripts = useMemo(
    () =>
      buildNarrationScripts(
        result.hydrated,
        MAX_SPEECH_INPUT_CHARACTERS,
        result.outputLanguage,
      ),
    [result],
  );
  const firstAvailableScript = scripts.find((script) => script.withinLimit);
  const [scriptId, setScriptId] = useState(firstAvailableScript?.id ?? "");
  const [voice, setVoice] = useState<AudioVoice>("marin");
  const [format, setFormat] = useState<AudioSpeechFormat>("mp3");
  const [generating, setGenerating] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [generated, setGenerated] = useState<GeneratedAudioState | null>(null);
  const speechRequestRef = useRef<AbortController | null>(null);
  const selectedScript = scripts.find((script) => script.id === scriptId);
  const localizeScriptLabel = (id: string, fallback: string): string => {
    if (id === "full") return t("audio.fullGuide");
    const sectionIndex = result.hydrated.enhancedNotes.sections.findIndex(
      (section) => section.id === id,
    );
    const section = result.hydrated.enhancedNotes.sections[sectionIndex];
    return section === undefined
      ? fallback
      : t("audio.sectionLabel", {
          number: sectionIndex + 1,
          heading: section.heading,
        });
  };
  const generatedScriptLabel = generated === null
    ? null
    : localizeScriptLabel(generated.scriptId, generated.scriptLabel);

  useEffect(() => {
    return () => {
      speechRequestRef.current?.abort();
      speechRequestRef.current = null;
    };
  }, []);

  useEffect(() => {
    const url = generated?.url;
    return () => {
      if (url !== undefined) URL.revokeObjectURL(url);
    };
  }, [generated?.url]);

  const invalidateGeneratedAudio = () => {
    setGenerated(null);
    setAudioError(null);
  };

  const generateAudio = async () => {
    if (selectedScript === undefined || !selectedScript.withinLimit) return;
    speechRequestRef.current?.abort();
    const controller = new AbortController();
    speechRequestRef.current = controller;
    setGenerating(true);
    setAudioError(null);
    try {
      const speech = await requestStudyGuideSpeech(
        {
          text: selectedScript.text,
          voice,
          format,
        },
        {
          signal: controller.signal,
          ...(sessionApiKey === undefined ? {} : { sessionApiKey }),
        },
      );
      if (
        controller.signal.aborted ||
        speechRequestRef.current !== controller
      ) {
        return;
      }
      const url = URL.createObjectURL(speech.blob);
      setGenerated({
        url,
        fileName: speech.fileName,
        scriptId: selectedScript.id,
        scriptLabel: selectedScript.label,
        voice,
        format,
      });
    } catch (speechError: unknown) {
      if (controller.signal.aborted) return;
      setGenerated(null);
      setAudioError(
        speechError instanceof AudioClientError || speechError instanceof Error
          ? speechError.message
          : t("audio.failedFallback"),
      );
    } finally {
      if (speechRequestRef.current === controller) {
        speechRequestRef.current = null;
        if (!controller.signal.aborted) setGenerating(false);
      }
    }
  };

  const downloadAudio = () => {
    if (generated === null) return;
    const anchor = document.createElement("a");
    anchor.href = generated.url;
    anchor.download = generated.fileName;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
  };

  return (
    <section className="overflow-hidden rounded-[30px] border border-[#14213d]/10 bg-white/80 shadow-card" aria-labelledby="audio-guide-title">
      <div className="border-b border-[#14213d]/10 p-6 sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#2f837c]">
              {t("audio.eyebrow")}
            </p>
            <h2 id="audio-guide-title" className="mt-2 text-3xl font-bold tracking-[-0.045em]">
              {t("audio.title")}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#53627b]">
              {t("audio.description")}
            </p>
          </div>
          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-[#f8ebc8] px-3 py-1.5 text-xs font-bold text-[#765511]">
            <Volume2 className="size-4" aria-hidden="true" /> {t("audio.aiDisclosure")}
          </span>
        </div>
      </div>

      <div className="grid gap-5 bg-[#f7f4ec]/75 p-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] sm:p-8">
        <div className="rounded-[24px] border border-[#14213d]/10 bg-white p-5 sm:p-6">
          <h3 className="text-lg font-bold tracking-[-0.03em]">{t("audio.chooseNarration")}</h3>
          <p className="mt-2 text-xs leading-5 text-[#53627b]">
            {t("audio.requestLimit", { limit: MAX_SPEECH_INPUT_CHARACTERS.toLocaleString() })}
          </p>

          <label htmlFor="audio-script" className="mt-5 block text-sm font-bold">
            {t("audio.narrationSection")}
            <select
              id="audio-script"
              value={scriptId}
              disabled={generating}
              onChange={(event) => {
                setScriptId(event.currentTarget.value);
                invalidateGeneratedAudio();
              }}
              className="mt-2 min-h-11 w-full rounded-xl border border-[#14213d]/15 bg-white px-3 text-sm text-[#14213d] disabled:opacity-60"
            >
              {scripts.map((script) => (
                <option key={script.id} value={script.id} disabled={!script.withinLimit}>
                  {localizeScriptLabel(script.id, script.label)} · {t("audio.charactersShort", { count: script.characters.toLocaleString() })}{script.withinLimit ? "" : ` · ${t("audio.tooLongShort")}`}
                </option>
              ))}
            </select>
          </label>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label htmlFor="audio-voice" className="block text-sm font-bold">
            {t("audio.voice")}
              <select
                id="audio-voice"
                value={voice}
                disabled={generating}
                onChange={(event) => {
                  const selected = AUDIO_VOICES.find(
                    (candidate) => candidate === event.currentTarget.value,
                  );
                  if (selected !== undefined) {
                    setVoice(selected);
                    invalidateGeneratedAudio();
                  }
                }}
                className="mt-2 min-h-11 w-full rounded-xl border border-[#14213d]/15 bg-white px-3 text-sm capitalize text-[#14213d] disabled:opacity-60"
              >
                {AUDIO_VOICES.map((candidate) => (
                  <option key={candidate} value={candidate} className="capitalize">
                    {candidate}
                  </option>
                ))}
              </select>
            </label>

            <label htmlFor="audio-format" className="block text-sm font-bold">
              {t("audio.format")}
              <select
                id="audio-format"
                value={format}
                disabled={generating}
                onChange={(event) => {
                  const selected = AUDIO_SPEECH_FORMATS.find(
                    (candidate) => candidate === event.currentTarget.value,
                  );
                  if (selected !== undefined) {
                    setFormat(selected);
                    invalidateGeneratedAudio();
                  }
                }}
                className="mt-2 min-h-11 w-full rounded-xl border border-[#14213d]/15 bg-white px-3 text-sm uppercase text-[#14213d] disabled:opacity-60"
              >
                {AUDIO_SPEECH_FORMATS.map((candidate) => (
                  <option key={candidate} value={candidate}>
                    {candidate.toUpperCase()}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <button
            type="button"
            onClick={() => void generateAudio()}
            disabled={
              generating ||
              !audioConfigured ||
              selectedScript === undefined ||
              !selectedScript.withinLimit
            }
            className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#2f837c] px-5 text-sm font-bold text-white transition hover:bg-[#1f625e] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {generating ? (
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Volume2 className="size-4" aria-hidden="true" />
            )}
            {generating
              ? t("audio.generating")
              : !audioConfigured
                ? t("audio.unavailable")
              : audioError !== null
                ? t("audio.retry")
              : generated === null
                ? t("audio.generate")
                : t("audio.regenerate")}
          </button>
          <p className="mt-3 text-xs leading-5 text-[#53627b]">
            {t("audio.transmissionDisclosure")}
          </p>
          {!audioConfigured && (
            <p className="mt-3 rounded-xl bg-[#eee9dd] p-3 text-xs font-bold leading-5 text-[#53627b]">
              {t("audio.unconfiguredSpeech")}
            </p>
          )}
        </div>

        <div className="flex min-h-80 flex-col rounded-[24px] border border-[#14213d]/10 bg-[#14213d] p-5 text-white sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#b8dcd6]">
                {t("audio.playback")}
              </p>
              <h3 className="mt-2 text-xl font-bold">
                {generatedScriptLabel ?? t("audio.placeholder")}
              </h3>
            </div>
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white/10 text-[#f8ebc8]">
              <Headphones className="size-5" aria-hidden="true" />
            </span>
          </div>

          {audioError !== null && (
            <div className="mt-5 rounded-2xl border border-[#ef9b8d]/40 bg-[#ef6b5a]/15 p-4 text-sm leading-6" role="alert">
              <p className="font-bold">{t("audio.failedTitle")}</p>
              <p className="mt-1 text-white/75">{audioError}</p>
            </div>
          )}

          {generated === null ? (
            <div className="grid flex-1 place-items-center py-10 text-center">
              <div className="max-w-sm">
                <AudioLines className="mx-auto size-9 text-white/25" aria-hidden="true" />
                <p className="mt-4 text-sm leading-6 text-white/60">
                  {t("audio.emptyInstructions")}
                </p>
              </div>
            </div>
          ) : (
            <div className="mt-6 flex flex-1 flex-col justify-between gap-6">
              <div>
                <p className="text-xs text-white/60">
                  {t("audio.generatedMeta", { voice: generated.voice, format: generated.format.toUpperCase() })}
                </p>
                <audio
                  className="mt-4 w-full"
                  controls
                  preload="metadata"
                  src={generated.url}
                  aria-label={t("audio.playerAria", { label: generatedScriptLabel ?? generated.scriptLabel })}
                >
                  {t("audio.unsupportedPlayback")}
                </audio>
              </div>
              <button
                type="button"
                onClick={downloadAudio}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#ef6b5a] px-5 text-sm font-bold text-white transition hover:bg-[#db5849]"
              >
                <Download className="size-4" aria-hidden="true" /> {t("audio.download")} {generated.format.toUpperCase()}
              </button>
            </div>
          )}
          <p className="mt-5 border-t border-white/10 pt-4 text-[11px] leading-5 text-white/45">
            {t("audio.disclosureDetail")}
          </p>
        </div>
      </div>
    </section>
  );
}

function StudyWorkspace({
  result,
  view,
  audioConfigured,
  audioSessionApiKey,
  onViewChange,
  onOpenAssessment,
  onOpenSection,
  onOpenCard,
  t,
}: {
  result: AnalysisResult;
  view: ResultView;
  audioConfigured: boolean;
  audioSessionApiKey?: string;
  onViewChange: (view: ResultView) => void;
  onOpenAssessment: (assessment: HydratedConceptAssessment) => void;
  onOpenSection: (section: HydratedEnhancedNoteSection) => void;
  onOpenCard: (card: HydratedAnkiCard) => void;
  t: UiTranslator;
}) {
  const views: readonly { id: ResultView; label: string; icon: LucideIcon }[] = [
    { id: "notes", label: t("workspace.notesTab"), icon: BookOpen },
    { id: "audit", label: t("workspace.auditTab"), icon: ListChecks },
    { id: "changes", label: t("workspace.changesTab"), icon: ScanText },
    { id: "anki", label: t("workspace.ankiTab", { count: result.hydrated.ankiCards.length }), icon: Brain },
    { id: "audio", label: t("workspace.audioTab"), icon: Headphones },
  ];

  return (
    <section aria-label={t("workspace.aria")}>
      <div className="mb-5 flex max-w-full gap-1 overflow-x-auto rounded-2xl border border-[#14213d]/10 bg-white/65 p-1.5" role="group" aria-label={t("workspace.chooseViewAria")}>
        {views.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              id={`study-view-${item.id}`}
              type="button"
              aria-pressed={view === item.id}
              aria-controls="study-view-panel"
              onClick={() => onViewChange(item.id)}
              className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-4 text-sm font-bold transition ${view === item.id ? "bg-[#14213d] text-white" : "text-[#53627b] hover:bg-[#14213d]/5"}`}
            >
              <Icon className="size-4" aria-hidden="true" /> {item.label}
            </button>
          );
        })}
      </div>

      <div id="study-view-panel" role="region" aria-labelledby={`study-view-${view}`} aria-live="polite">
        {view === "notes" && <EnhancedNotesPanel result={result} onOpen={onOpenSection} t={t} />}
        {view === "audit" && <IssuesPanel result={result} onOpen={onOpenAssessment} t={t} />}
        {view === "changes" && <PatchPanel markdown={result.markdown} t={t} />}
        {view === "anki" && <AnkiPanel result={result} onOpen={onOpenCard} t={t} />}
        {view === "audio" && (
          <AudioStudyGuidePanel
            result={result}
            audioConfigured={audioConfigured}
            sessionApiKey={audioSessionApiKey}
            t={t}
          />
        )}
      </div>
    </section>
  );
}

function PatchPanel({ markdown, t }: { markdown: string; t: UiTranslator }) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");

  if (markdown.length === 0) {
    return (
      <section className="rounded-[30px] border border-[#14213d]/10 bg-white/80 p-8 text-center shadow-card" aria-labelledby="patch-title">
        <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#dcece8] text-[#1f625e]"><CircleCheck className="size-6" aria-hidden="true" /></span>
        <h2 id="patch-title" className="mt-4 text-2xl font-bold">{t("changes.emptyTitle")}</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[#53627b]">{t("changes.emptyDescription")}</p>
      </section>
    );
  }

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
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#ef6b5a]">{t("changes.eyebrow")}</p>
          <h2 id="patch-title" className="mt-2 text-3xl font-bold tracking-[-0.045em]">{t("changes.title")}</h2>
          <p className="mt-2 text-sm text-[#53627b]">{t("changes.description")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={copyMarkdown} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#14213d]/15 bg-white px-4 text-sm font-bold hover:bg-[#f7f4ec]">
            {copyState === "copied" ? <Check className="size-4 text-[#2f837c]" /> : <Clipboard className="size-4" />}
            {copyState === "copied" ? t("export.copied") : copyState === "error" ? t("export.copyFailed") : t("changes.copy")}
          </button>
          <button type="button" onClick={downloadMarkdown} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#ef6b5a] px-4 text-sm font-bold text-white hover:bg-[#db5849]">
            <Download className="size-4" /> {t("notes.export")}
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
      <p className="sr-only" aria-live="polite">{copyState === "copied" ? t("export.copiedAnnouncement", { label: t("changes.copy") }) : copyState === "error" ? t("export.clipboardUnavailable") : ""}</p>
    </section>
  );
}

function EvidenceDrawer({
  content,
  onClose,
  t,
}: {
  content: EvidenceDrawerContent;
  onClose: () => void;
  t: UiTranslator;
}) {
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

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end bg-[#091124]/55 backdrop-blur-sm sm:items-stretch" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="evidence-title" className="animate-rise flex max-h-[92vh] w-full flex-col rounded-t-[30px] bg-[#f7f4ec] shadow-2xl sm:max-h-none sm:max-w-[620px] sm:rounded-none sm:rounded-l-[30px]">
        <div className="flex items-start justify-between gap-5 border-b border-[#14213d]/10 p-6 sm:p-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#2f837c]">{content.eyebrow}</p>
            <h2 id="evidence-title" className="mt-2 text-2xl font-bold tracking-[-0.04em]">{content.title}</h2>
            <span className={`mt-3 inline-flex rounded-full px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.1em] ${content.badgeClassName}`}>{content.badge}</span>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} className="grid size-10 shrink-0 place-items-center rounded-full border border-[#14213d]/10 bg-white hover:bg-[#fee4dd]" aria-label={t("evidence.closeAria")}>
            <X className="size-5" />
          </button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-5 sm:p-8">
          <p className="whitespace-pre-wrap text-sm leading-6 text-[#53627b]">{content.description}</p>
          {content.evidence.map((item) => (
            <article key={item.chunkId} className="rounded-2xl border border-[#14213d]/10 bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="rounded-full bg-[#dcece8] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#1f625e]">{sourceName(item.chunk.sourceType, t)}</span>
                <span className="text-xs font-bold text-[#2f837c]">{item.chunk.locator}</span>
              </div>
              <p className="mt-3 text-xs font-bold text-[#14213d]">{item.chunk.sourceName}</p>
              {item.chunk.headingPath?.length ? <p className="mt-1 text-xs text-[#53627b]">{item.chunk.headingPath.join(" › ")}</p> : null}
              <blockquote className="mt-4 border-l-2 border-[#ef6b5a] pl-4 text-sm leading-6 text-[#37445c]">“{item.chunk.text}”</blockquote>
              <p className="mt-4 rounded-xl bg-[#f7f4ec] p-3 text-xs leading-5 text-[#53627b]"><strong className="text-[#14213d]">{t("evidence.whyItMatters")}</strong> {item.relevance}</p>
            </article>
          ))}
        </div>
        <div className="border-t border-[#14213d]/10 bg-white/65 p-5 sm:px-8">
          <p className="flex items-start gap-2 text-xs leading-5 text-[#53627b]"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-[#2f837c]" /> {t("evidence.trust")}</p>
        </div>
      </aside>
    </div>
  );
}

function EmptyPreview({ t }: { t: UiTranslator }) {
  const stages = [
    { number: "01", title: t("how.extractTitle"), text: t("how.extractText") },
    { number: "02", title: t("how.analyzeTitle"), text: t("how.analyzeText") },
    { number: "03", title: t("how.buildTitle"), text: t("how.buildText") },
  ];
  return (
    <section className="rounded-[28px] border border-[#14213d]/10 bg-[#eee9dd]/65 p-6 sm:p-8" aria-label={t("how.aria")}>
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
  const [locale, setLocale] = useState<UiLocale>("en");
  const t = useMemo(() => createUiTranslator(locale), [locale]);
  const [files, setFiles] = useState<Partial<SourceFiles>>({});
  const [processed, setProcessed] = useState<ProcessedSources | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [mode, setMode] = useState<PipelineMode>("idle");
  const [loadingKind, setLoadingKind] = useState<LoadingKind>("local");
  const [loadingMessage, setLoadingMessage] = useState<LoadingMessage>({
    key: "pipeline.checkingSafety",
  });
  const [error, setError] = useState<PipelineErrorState | null>(null);
  const [target, setTarget] = useState<AnalysisTarget | null>(() =>
    defaultTarget(providers),
  );
  const [sessionProviderKeys, setSessionProviderKeys] =
    useState<SessionProviderKeys>({});
  const [sessionKimiRegion, setSessionKimiRegion] =
    useState<KimiRegion | null>(null);
  const [includeAnki, setIncludeAnki] = useState(false);
  const [outputLanguagePreference, setOutputLanguagePreference] =
    useState<OutputLanguagePreference>("follow-interface");
  const [resultView, setResultView] = useState<ResultView>("notes");
  const [evidenceSelection, setEvidenceSelection] = useState<EvidenceDrawerSelection | null>(null);
  const [inputKey, setInputKey] = useState(0);
  const [lectureSourceMode, setLectureSourceMode] =
    useState<LectureSourceMode>("pdf");
  const [pastedLecture, setPastedLecture] = useState("");
  const [pastedLectureState, setPastedLectureState] =
    useState<PastedLectureState>({ status: "idle" });
  const [spokenSourceMode, setSpokenSourceMode] = useState<SpokenSourceMode>("transcript");
  const [transcriptInputKind, setTranscriptInputKind] =
    useState<TranscriptInputKind | null>(null);
  const [pastedTranscript, setPastedTranscript] = useState("");
  const [pastedTranscriptState, setPastedTranscriptState] =
    useState<PastedTranscriptState>({ status: "idle" });
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [transcriptionState, setTranscriptionState] = useState<AudioTranscriptionState>({
    status: "idle",
  });
  const outputRef = useRef<HTMLDivElement>(null);
  const sessionProviderKeysRef = useRef<SessionProviderKeys>({});
  const audioSelectionRef = useRef<File | null>(null);
  const transcriptionRequestRef = useRef<AbortController | null>(null);
  const revealOutputTimerRef = useRef<number | null>(null);
  const lecturePasteValidationVersionRef = useRef(0);
  const pasteValidationVersionRef = useRef(0);
  const lecturePasteAutoValidationTimerRef = useRef<number | null>(null);
  const transcriptPasteAutoValidationTimerRef = useRef<number | null>(null);
  const loading = mode === "loading";
  const transcribing = transcriptionState.status === "loading";
  const checkingAudio = transcriptionState.status === "validating";
  const validatingPaste = pastedTranscriptState.status === "validating";
  const validatingLecturePaste = pastedLectureState.status === "validating";
  const busy = loading || transcribing || checkingAudio || validatingPaste || validatingLecturePaste;
  const lectureReady = files.slides !== undefined;
  const transcriptReady = (() => {
    if (spokenSourceMode === "audio") {
      return transcriptionState.status === "ready";
    }
    if (spokenSourceMode === "paste") {
      return (
        files.transcript !== undefined &&
        transcriptInputKind === "paste" &&
        pastedTranscriptState.status === "ready"
      );
    }
    return files.transcript !== undefined && transcriptInputKind === "upload";
  })();
  const primarySourceReady = lectureReady || transcriptReady;
  const sourceReadinessKey: UiMessageKey | null = (() => {
    if (primarySourceReady) return null;

    if (lectureSourceMode === "paste") {
      if (pastedLectureState.status === "error") {
        return "analysis.fixLecturePaste";
      }
      if (pastedLecture.trim().length > 0) {
        return "analysis.preparingLecturePaste";
      }
    }

    if (spokenSourceMode === "audio") {
      if (audioFile === null) return "analysis.missingAudio";
      return "analysis.transcribeAudio";
    } else if (spokenSourceMode === "paste") {
      if (pastedTranscriptState.status === "error") {
        return "analysis.fixTranscriptPaste";
      }
      if (pastedTranscript.trim().length > 0) {
        return "analysis.preparingTranscriptPaste";
      }
    }

    return "analysis.missingPrimary";
  })();
  const ready = primarySourceReady;
  const sourceReadinessHint = t(
    sourceReadinessKey ?? "analysis.sourcesReady",
  );
  const selectedProvider = useMemo(
    () => providers.providers.find((provider) => provider.id === target?.provider),
    [providers, target],
  );
  const selectedProviderReady = useMemo(() => {
    if (selectedProvider === undefined) return false;
    const value = sessionProviderKeys[selectedProvider.id];
    const status = sessionKeyStatus(value);
    if (status === "valid") {
      return selectedProvider.id !== "kimi" || sessionKimiRegion !== null;
    }
    return status === "empty" && selectedProvider.configured;
  }, [selectedProvider, sessionKimiRegion, sessionProviderKeys]);
  const selectedProviderSessionStatus =
    selectedProvider === undefined
      ? "empty"
      : sessionKeyStatus(sessionProviderKeys[selectedProvider.id]);
  const resolvedOutputLanguage: OutputLanguage =
    outputLanguagePreference === "follow-interface"
      ? locale
      : outputLanguagePreference;
  const canAnalyzeLive =
    selectedProvider !== undefined &&
    target !== null &&
    selectedProviderReady &&
    ready &&
    !busy;
  const liveAnalysisHint = (() => {
    if (selectedProvider === undefined || target === null) {
      return t("analysis.chooseProvider");
    }
    if (selectedProviderSessionStatus === "invalid") {
      return t("analysis.invalidKey", { provider: selectedProvider.label });
    }
    if (
      selectedProvider.id === "kimi" &&
      selectedProviderSessionStatus === "valid" &&
      sessionKimiRegion === null
    ) {
      return t("analysis.kimiRegion");
    }
    if (!selectedProviderReady) {
      return t("analysis.enterKey", { provider: selectedProvider.label });
    }
    if (sourceReadinessKey !== null) return sourceReadinessHint;
    if (busy) return t("analysis.busy");
    return t("analysis.ready", { provider: selectedProvider.label });
  })();
  const liveAnalysisDescriptionId =
    liveAnalysisHint === sourceReadinessHint
      ? "source-readiness"
      : "live-analysis-readiness";
  const openAiSessionApiKey = useMemo(() => {
    const value = sessionProviderKeys.openai;
    return sessionKeyStatus(value) === "valid" ? value : undefined;
  }, [sessionProviderKeys.openai]);
  const audioConfigured = useMemo(
    () => {
      const openAiInputStatus = sessionKeyStatus(sessionProviderKeys.openai);
      return openAiInputStatus === "valid" ||
        (openAiInputStatus === "empty" && providers.providers.some(
        (provider) => provider.id === "openai" && provider.configured,
        ));
    },
    [providers, sessionProviderKeys.openai],
  );
  const outputOptions = useMemo<AnalysisOutputOptions>(
    () => ({ ankiCards: includeAnki }),
    [includeAnki],
  );
  const evidenceContent = useMemo<EvidenceDrawerContent | null>(() => {
    if (evidenceSelection === null) return null;

    if (evidenceSelection.kind === "assessment") {
      const { assessment } = evidenceSelection;
      const status = assessment.status === "covered"
        ? { label: t("score.covered"), pill: "bg-[#dcece8] text-[#1f625e]" }
        : { ...STATUS_META[assessment.status], label: issueLabel(assessment.status, t) };
      return {
        title: assessment.title,
        eyebrow: t("evidence.auditEyebrow"),
        badge: status.label,
        badgeClassName: status.pill,
        description: assessment.explanation,
        evidence: assessment.evidence,
      };
    }

    if (evidenceSelection.kind === "section") {
      const { section } = evidenceSelection;
      const change = CHANGE_META[section.changeType];
      return {
        title: section.heading,
        eyebrow: t("evidence.notesEyebrow"),
        badge: changeLabel(section.changeType, t),
        badgeClassName: change.className,
        description: `${section.learningObjective}\n\n${section.markdown}`,
        evidence: section.evidence,
      };
    }

    const { card } = evidenceSelection;
    return {
      title: card.front,
      eyebrow: t("evidence.ankiEyebrow"),
      badge: t("anki.basicCard"),
      badgeClassName: "bg-[#14213d] text-white",
      description: card.back,
      evidence: card.evidence,
    };
  }, [evidenceSelection, t]);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    return () => {
      sessionProviderKeysRef.current = {};
      audioSelectionRef.current = null;
      transcriptionRequestRef.current?.abort();
      transcriptionRequestRef.current = null;
      if (revealOutputTimerRef.current !== null) {
        window.clearTimeout(revealOutputTimerRef.current);
        revealOutputTimerRef.current = null;
      }
      if (lecturePasteAutoValidationTimerRef.current !== null) {
        window.clearTimeout(lecturePasteAutoValidationTimerRef.current);
        lecturePasteAutoValidationTimerRef.current = null;
      }
      if (transcriptPasteAutoValidationTimerRef.current !== null) {
        window.clearTimeout(transcriptPasteAutoValidationTimerRef.current);
        transcriptPasteAutoValidationTimerRef.current = null;
      }
      lecturePasteValidationVersionRef.current += 1;
      pasteValidationVersionRef.current += 1;
    };
  }, []);

  useEffect(() => {
    const clearOnPageHide = () => {
      sessionProviderKeysRef.current = {};
      setSessionProviderKeys({});
      setSessionKimiRegion(null);
    };
    window.addEventListener("pagehide", clearOnPageHide);
    return () => window.removeEventListener("pagehide", clearOnPageHide);
  }, []);

  const replaceSessionProviderKeys = (next: SessionProviderKeys) => {
    sessionProviderKeysRef.current = next;
    setSessionProviderKeys(next);
  };

  const resetTranscriptionCredentialError = () => {
    setTranscriptionState((current) =>
      current.status === "error" && !current.invalidFile
        ? { status: "idle" }
        : current,
    );
  };

  const changeSessionProviderKey = (provider: ProviderId, value: string) => {
    replaceSessionProviderKeys({
      ...sessionProviderKeysRef.current,
      [provider]: value,
    });
    if (provider === "openai") resetTranscriptionCredentialError();
    if (provider === "kimi" && value.length === 0) setSessionKimiRegion(null);
  };

  const clearSessionProviderKey = (provider: ProviderId) => {
    const next = { ...sessionProviderKeysRef.current };
    delete next[provider];
    replaceSessionProviderKeys(next);
    if (provider === "openai") resetTranscriptionCredentialError();
    if (provider === "kimi") setSessionKimiRegion(null);
  };

  const clearAllSessionProviderKeys = () => {
    replaceSessionProviderKeys({});
    setSessionKimiRegion(null);
    resetTranscriptionCredentialError();
  };

  const cancelRevealOutput = () => {
    if (revealOutputTimerRef.current !== null) {
      window.clearTimeout(revealOutputTimerRef.current);
      revealOutputTimerRef.current = null;
    }
  };

  const cancelLecturePasteAutoValidation = () => {
    if (lecturePasteAutoValidationTimerRef.current !== null) {
      window.clearTimeout(lecturePasteAutoValidationTimerRef.current);
      lecturePasteAutoValidationTimerRef.current = null;
    }
  };

  const cancelTranscriptPasteAutoValidation = () => {
    if (transcriptPasteAutoValidationTimerRef.current !== null) {
      window.clearTimeout(transcriptPasteAutoValidationTimerRef.current);
      transcriptPasteAutoValidationTimerRef.current = null;
    }
  };

  const clearPipelineAfterSourceChange = () => {
    cancelRevealOutput();
    setProcessed(null);
    setResult(null);
    setMode("idle");
    setError(null);
    setEvidenceSelection(null);
    setResultView("notes");
  };

  const updateFile = (sourceType: SourceType, file: File) => {
    if (sourceType === "slides") {
      cancelLecturePasteAutoValidation();
    }
    setFiles((current) => ({ ...current, [sourceType]: file }));
    if (sourceType === "transcript") {
      cancelTranscriptPasteAutoValidation();
      pasteValidationVersionRef.current += 1;
      transcriptionRequestRef.current?.abort();
      transcriptionRequestRef.current = null;
      setSpokenSourceMode("transcript");
      setTranscriptInputKind("upload");
      setPastedTranscriptState({ status: "idle" });
      setAudioFile(null);
      audioSelectionRef.current = null;
      setTranscriptionState({ status: "idle" });
    }
    clearPipelineAfterSourceChange();
  };

  const chooseLectureSourceMode = (nextMode: LectureSourceMode) => {
    if (nextMode === lectureSourceMode) return;
    cancelLecturePasteAutoValidation();
    lecturePasteValidationVersionRef.current += 1;
    setLectureSourceMode(nextMode);
    setFiles((current) => {
      const next = { ...current };
      delete next.slides;
      return next;
    });
    setPastedLectureState({ status: "idle" });
    clearPipelineAfterSourceChange();
    if (nextMode === "paste" && pastedLecture.trim().length > 0) {
      const scheduledVersion = lecturePasteValidationVersionRef.current;
      lecturePasteAutoValidationTimerRef.current = window.setTimeout(() => {
        if (lecturePasteValidationVersionRef.current !== scheduledVersion) return;
        void acceptPastedLecture(pastedLecture);
      }, PASTE_AUTO_VALIDATE_DELAY_MS);
    }
  };

  const chooseLectureFile = (
    nextMode: Exclude<LectureSourceMode, "paste">,
    file: File,
  ) => {
    cancelLecturePasteAutoValidation();
    lecturePasteValidationVersionRef.current += 1;
    setLectureSourceMode(nextMode);
    setPastedLecture("");
    setPastedLectureState({ status: "idle" });
    updateFile("slides", file);
  };

  const changePastedLecture = (value: string) => {
    cancelLecturePasteAutoValidation();
    lecturePasteValidationVersionRef.current += 1;
    setPastedLecture(value);
    setPastedLectureState({ status: "idle" });
    if (lectureSourceMode === "paste") {
      setFiles((current) => {
        const next = { ...current };
        delete next.slides;
        return next;
      });
    }
    clearPipelineAfterSourceChange();
    if (lectureSourceMode === "paste" && value.trim().length > 0) {
      const scheduledVersion = lecturePasteValidationVersionRef.current;
      lecturePasteAutoValidationTimerRef.current = window.setTimeout(() => {
        if (lecturePasteValidationVersionRef.current !== scheduledVersion) return;
        void acceptPastedLecture(value);
      }, PASTE_AUTO_VALIDATE_DELAY_MS);
    }
  };

  const clearPastedLecture = () => {
    changePastedLecture("");
  };

  const acceptPastedLecture = async (rawLecture = pastedLecture) => {
    cancelLecturePasteAutoValidation();
    const validationVersion = lecturePasteValidationVersionRef.current + 1;
    lecturePasteValidationVersionRef.current = validationVersion;
    setPastedLectureState({ status: "validating" });
    clearPipelineAfterSourceChange();

    try {
      const lectureFile = await createValidatedPastedTextFile({
        rawText: rawLecture,
        fileName: "pasted-lecture.txt",
        readText: readLectureTextFile,
        emptyMessage: t("lecture.pasteEmptyError"),
      });
      if (lecturePasteValidationVersionRef.current !== validationVersion) return;
      setFiles((current) => ({ ...current, slides: lectureFile }));
      setLectureSourceMode("paste");
      setPastedLectureState({ status: "ready" });
    } catch (pasteError: unknown) {
      if (lecturePasteValidationVersionRef.current !== validationVersion) return;
      setPastedLectureState({
        status: "error",
        message:
          pasteError instanceof Error
            ? pasteError.message
            : t("lecture.pasteEmptyError"),
      });
    }
  };

  const recoverWithLectureText = () => {
    if (lectureSourceMode !== "paste") {
      chooseLectureSourceMode("paste");
    } else {
      clearPipelineAfterSourceChange();
    }
    window.setTimeout(() => {
      document.getElementById(`source-slides-paste-${inputKey}`)?.focus();
    }, 0);
  };

  const chooseSpokenSourceMode = (nextMode: SpokenSourceMode) => {
    if (nextMode === spokenSourceMode) return;
    cancelTranscriptPasteAutoValidation();
    pasteValidationVersionRef.current += 1;
    cancelRevealOutput();
    if (nextMode !== "audio") {
      transcriptionRequestRef.current?.abort();
      transcriptionRequestRef.current = null;
    }
    setSpokenSourceMode(nextMode);
    setProcessed(null);
    setResult(null);
    setMode("idle");
    setError(null);
    setEvidenceSelection(null);
    setResultView("notes");
    if (
      nextMode === "paste" &&
      pastedTranscript.trim().length > 0 &&
      !(
        transcriptInputKind === "paste" &&
        pastedTranscriptState.status === "ready" &&
        files.transcript !== undefined
      )
    ) {
      const scheduledVersion = pasteValidationVersionRef.current;
      transcriptPasteAutoValidationTimerRef.current = window.setTimeout(() => {
        if (pasteValidationVersionRef.current !== scheduledVersion) return;
        void acceptPastedTranscript(pastedTranscript);
      }, PASTE_AUTO_VALIDATE_DELAY_MS);
    }
  };

  const changePastedTranscript = (value: string) => {
    cancelTranscriptPasteAutoValidation();
    pasteValidationVersionRef.current += 1;
    setPastedTranscript(value);
    setPastedTranscriptState({ status: "idle" });
    if (transcriptInputKind === "paste") {
      setFiles((current) => {
        const next = { ...current };
        delete next.transcript;
        return next;
      });
      setTranscriptInputKind(null);
    }
    setProcessed(null);
    setResult(null);
    setMode("idle");
    setError(null);
    setEvidenceSelection(null);
    setResultView("notes");
    if (spokenSourceMode === "paste" && value.trim().length > 0) {
      const scheduledVersion = pasteValidationVersionRef.current;
      transcriptPasteAutoValidationTimerRef.current = window.setTimeout(() => {
        if (pasteValidationVersionRef.current !== scheduledVersion) return;
        void acceptPastedTranscript(value);
      }, PASTE_AUTO_VALIDATE_DELAY_MS);
    }
  };

  const clearPastedTranscript = () => {
    changePastedTranscript("");
  };

  const acceptPastedTranscript = async (rawTranscript = pastedTranscript) => {
    cancelTranscriptPasteAutoValidation();
    const validationVersion = pasteValidationVersionRef.current + 1;
    pasteValidationVersionRef.current = validationVersion;
    setPastedTranscriptState({ status: "validating" });
    setProcessed(null);
    setResult(null);
    setMode("idle");
    setError(null);
    setEvidenceSelection(null);
    setResultView("notes");

    try {
      const transcriptFile = await createValidatedPastedTextFile({
        rawText: rawTranscript,
        fileName: "pasted-transcript.txt",
        readText: readTranscriptFile,
        emptyMessage: t("spoken.pasteEmptyError"),
      });
      if (pasteValidationVersionRef.current !== validationVersion) return;
      transcriptionRequestRef.current?.abort();
      transcriptionRequestRef.current = null;
      setFiles((current) => ({ ...current, transcript: transcriptFile }));
      setSpokenSourceMode("paste");
      setTranscriptInputKind("paste");
      setAudioFile(null);
      audioSelectionRef.current = null;
      setTranscriptionState({ status: "idle" });
      setPastedTranscriptState({ status: "ready" });
    } catch (pasteError: unknown) {
      if (pasteValidationVersionRef.current !== validationVersion) return;
      setPastedTranscriptState({
        status: "error",
        message:
          pasteError instanceof Error
            ? pasteError.message
            : t("spoken.pasteEmptyError"),
      });
    }
  };

  const chooseAudioFile = async (file: File) => {
    transcriptionRequestRef.current?.abort();
    transcriptionRequestRef.current = null;
    audioSelectionRef.current = file;
    setSpokenSourceMode("audio");
    setAudioFile(file);
    setProcessed(null);
    setResult(null);
    setMode("idle");
    setError(null);
    setEvidenceSelection(null);
    setResultView("notes");
    setTranscriptionState({ status: "validating" });
    try {
      await validateAudioFile(file);
      if (audioSelectionRef.current !== file) return;
      setTranscriptionState({ status: "idle" });
    } catch (audioValidationError: unknown) {
      if (audioSelectionRef.current !== file) return;
      setTranscriptionState({
        status: "error",
        message:
          audioValidationError instanceof Error
            ? audioValidationError.message
            : "Choose a supported audio recording within the upload limit.",
        retryable: false,
        invalidFile: true,
      });
    }
  };

  const transcribeAudio = async () => {
    if (audioFile === null) return;
    transcriptionRequestRef.current?.abort();
    const controller = new AbortController();
    transcriptionRequestRef.current = controller;
    setTranscriptionState({ status: "loading" });
    setProcessed(null);
    setResult(null);
    setMode("idle");
    setError(null);
    setEvidenceSelection(null);
    setResultView("notes");
    try {
      const transcription = await requestAudioTranscription(audioFile, {
        signal: controller.signal,
        ...(openAiSessionApiKey === undefined
          ? {}
          : { sessionApiKey: openAiSessionApiKey }),
      });
      if (
        controller.signal.aborted ||
        transcriptionRequestRef.current !== controller
      ) {
        return;
      }
      setTranscriptionState({ status: "ready", transcription });
    } catch (transcriptionError: unknown) {
      if (controller.signal.aborted) return;
      setTranscriptionState({
        status: "error",
        message:
          transcriptionError instanceof AudioClientError || transcriptionError instanceof Error
            ? transcriptionError.message
            : "The audio transcription could not be completed.",
        retryable:
          transcriptionError instanceof AudioClientError
            ? transcriptionError.retryable
            : true,
        invalidFile:
          transcriptionError instanceof AudioClientError &&
          (transcriptionError.code === "invalid_file" ||
            transcriptionError.code === "invalid_request"),
      });
    } finally {
      if (transcriptionRequestRef.current === controller) {
        transcriptionRequestRef.current = null;
      }
    }
  };

  const revealOutput = () => {
    if (revealOutputTimerRef.current !== null) {
      window.clearTimeout(revealOutputTimerRef.current);
    }
    revealOutputTimerRef.current = window.setTimeout(
      () => {
        revealOutputTimerRef.current = null;
        const output = outputRef.current;
        if (output === null) return;
        output.focus({ preventScroll: true });
        const reduceMotion =
          typeof window.matchMedia === "function" &&
          window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        output.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
      },
      50,
    );
  };

  const analyzeProcessedSources = async (
    nextProcessed: ProcessedSources,
    nextTarget: AnalysisTarget,
    providerLabel: string,
  ) => {
    setLoadingKind("live");
    setLoadingMessage({
      key: "pipeline.analyzing",
      values: { provider: providerLabel, model: nextTarget.model },
    });
    await nextPaint();

    try {
      const sessionApiKey =
        sessionKeyStatus(sessionProviderKeys[nextTarget.provider]) === "valid"
          ? sessionProviderKeys[nextTarget.provider]
          : undefined;
      if (
        nextTarget.provider === "kimi" &&
        sessionApiKey !== undefined &&
        sessionKimiRegion === null
      ) {
        setResult(null);
        setMode("source-map");
        revealOutput();
        return;
      }
      const nextResult = sessionApiKey === undefined
        ? await requestLiveAnalysis(
            nextProcessed,
            nextTarget,
            outputOptions,
            { outputLanguage: resolvedOutputLanguage },
          )
        : await requestLiveAnalysis(
            nextProcessed,
            nextTarget,
            outputOptions,
            {
              outputLanguage: resolvedOutputLanguage,
              sessionApiKey,
              ...(nextTarget.provider === "kimi" && sessionKimiRegion !== null
                ? { sessionKimiRegion }
                : {}),
            },
          );
      setResult(nextResult);
      setResultView("notes");
      setMode("ready");
    } catch (analysisError: unknown) {
      setResult(null);
      setError(liveError(analysisError));
      setMode("error");
    }
    revealOutput();
  };

  const runManualPipeline = async (requestLive: boolean) => {
    const sourceFiles: Partial<SourceFiles> = {};
    if (files.slides !== undefined) sourceFiles.slides = files.slides;
    if (files.notes !== undefined) sourceFiles.notes = files.notes;
    if (
      spokenSourceMode === "transcript" &&
      transcriptInputKind === "upload" &&
      files.transcript !== undefined
    ) {
      sourceFiles.transcript = files.transcript;
    }
    if (
      spokenSourceMode === "paste" &&
      transcriptInputKind === "paste" &&
      pastedTranscriptState.status === "ready" &&
      files.transcript !== undefined
    ) {
      sourceFiles.transcript = files.transcript;
    }
    const audioTranscription =
      spokenSourceMode === "audio" && transcriptionState.status === "ready"
        ? transcriptionState.transcription
        : null;
    if (
      sourceFiles.slides === undefined &&
      sourceFiles.transcript === undefined &&
      audioTranscription === null
    ) {
      return;
    }
    const nextTarget = target;
    const provider = selectedProvider;
    const canAnalyzeLive =
      requestLive &&
      nextTarget !== null &&
      provider !== undefined &&
      selectedProviderReady &&
      provider.models.some((model) => model.id === nextTarget.model);

    setMode("loading");
    setLoadingKind(canAnalyzeLive ? "live" : "local");
    setError(null);
    setResult(null);
    setProcessed(null);
    setEvidenceSelection(null);
    setResultView("notes");
    setLoadingMessage({
      key:
        audioTranscription !== null
          ? "pipeline.validatingAudioSources"
          : "pipeline.validatingTextSources",
    });
    await nextPaint();

    try {
      setLoadingMessage({
        key:
          audioTranscription !== null
            ? "pipeline.extractingAudioSources"
            : "pipeline.extractingTextSources",
      });
      let nextProcessed: ProcessedSources;
      if (audioTranscription !== null) {
        nextProcessed = await processSourceFilesWithTranscriptChunks(
          {
            ...(sourceFiles.slides === undefined
              ? {}
              : { slides: sourceFiles.slides }),
            ...(sourceFiles.notes === undefined
              ? {}
              : { notes: sourceFiles.notes }),
          },
          chunkTimestampedTranscript(
            audioTranscription.segments,
            audioTranscription.fileName,
          ),
        );
      } else {
        nextProcessed = await processSourceFiles(sourceFiles);
      }
      setProcessed(nextProcessed);

      if (canAnalyzeLive && nextTarget !== null && provider !== undefined) {
        await analyzeProcessedSources(nextProcessed, nextTarget, provider.label);
      } else {
        setLoadingMessage({ key: "pipeline.finalizingSourceMap" });
        await nextPaint();
        setMode("source-map");
        revealOutput();
      }
    } catch (pipelineError: unknown) {
      setError(processingError(pipelineError));
      setMode("error");
      revealOutput();
    }
  };

  const tryDemo = async () => {
    cancelLecturePasteAutoValidation();
    cancelTranscriptPasteAutoValidation();
    lecturePasteValidationVersionRef.current += 1;
    pasteValidationVersionRef.current += 1;
    transcriptionRequestRef.current?.abort();
    transcriptionRequestRef.current = null;
    setMode("loading");
    setLoadingKind("demo");
    setError(null);
    setResult(null);
    setProcessed(null);
    setEvidenceSelection(null);
    setResultView("notes");
    setIncludeAnki(true);
    setLoadingMessage({ key: "pipeline.loadingDemo" });
    await nextPaint();
    try {
      const demoFiles = await loadDemoFiles();
      setLectureSourceMode("pdf");
      setFiles(demoFiles);
      setPastedLecture("");
      lecturePasteValidationVersionRef.current += 1;
      setPastedLectureState({ status: "idle" });
      setSpokenSourceMode("transcript");
      setTranscriptInputKind("upload");
      setPastedTranscript("");
      pasteValidationVersionRef.current += 1;
      setPastedTranscriptState({ status: "idle" });
      setAudioFile(null);
      audioSelectionRef.current = null;
      setTranscriptionState({ status: "idle" });
      setLoadingMessage({ key: "pipeline.extractingTextSources" });
      let nextFiles = demoFiles;
      let nextProcessed: ProcessedSources;
      try {
        nextProcessed = await processSourceFiles(demoFiles);
      } catch (extractionError: unknown) {
        const recovered = await recoverDemoPdfExtraction(
          extractionError,
          demoFiles,
        );
        nextFiles = recovered.files;
        nextProcessed = recovered.processed;
      }
      setLectureSourceMode(
        nextFiles.slides.name.toLowerCase().endsWith(".pdf") ? "pdf" : "text",
      );
      setFiles(nextFiles);
      setProcessed(nextProcessed);
      setLoadingMessage({ key: "pipeline.verifyingDemo" });
      await nextPaint();
      const demoResult = await runFixtureAnalysis(nextProcessed, {
        ankiCards: true,
      });
      setResult(demoResult);
      setMode("ready");
      revealOutput();
    } catch (demoError: unknown) {
      setError(demoPipelineError(demoError));
      setMode("error");
      revealOutput();
    }
  };

  const retryLiveAnalysis = async () => {
    if (
      processed === null ||
      target === null ||
      !selectedProviderReady ||
      selectedProvider === undefined ||
      !selectedProvider.models.some((model) => model.id === target.model)
    ) {
      setError(null);
      setMode(processed === null ? "idle" : "source-map");
      return;
    }

    setMode("loading");
    setError(null);
    setResult(null);
    setEvidenceSelection(null);
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

  const chooseAnkiOutput = (nextValue: boolean) => {
    setIncludeAnki(nextValue);
    setEvidenceSelection(null);
  };

  const openAssessmentEvidence = (assessment: HydratedConceptAssessment) => {
    cancelRevealOutput();
    setEvidenceSelection({ kind: "assessment", assessment });
  };

  const openSectionEvidence = (section: HydratedEnhancedNoteSection) => {
    cancelRevealOutput();
    setEvidenceSelection({ kind: "section", section });
  };

  const openCardEvidence = (card: HydratedAnkiCard) => {
    cancelRevealOutput();
    setEvidenceSelection({ kind: "card", card });
  };

  const reset = () => {
    cancelRevealOutput();
    cancelLecturePasteAutoValidation();
    cancelTranscriptPasteAutoValidation();
    transcriptionRequestRef.current?.abort();
    transcriptionRequestRef.current = null;
    clearAllSessionProviderKeys();
    setFiles({});
    setLectureSourceMode("pdf");
    setPastedLecture("");
    lecturePasteValidationVersionRef.current += 1;
    setPastedLectureState({ status: "idle" });
    setSpokenSourceMode("transcript");
    setTranscriptInputKind(null);
    setPastedTranscript("");
    pasteValidationVersionRef.current += 1;
    setPastedTranscriptState({ status: "idle" });
    setAudioFile(null);
    audioSelectionRef.current = null;
    setTranscriptionState({ status: "idle" });
    setProcessed(null);
    setResult(null);
    setMode("idle");
    setError(null);
    setEvidenceSelection(null);
    setResultView("notes");
    setIncludeAnki(false);
    setInputKey((value) => value + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <main>
      <AppHeader
        onTryDemo={() => void tryDemo()}
        loading={busy}
        locale={locale}
        onLocaleChange={setLocale}
        t={t}
      />
      <Hero onTryDemo={() => void tryDemo()} loading={busy} t={t} />

      <section className="mx-auto max-w-[1440px] px-5 py-16 sm:px-8 sm:py-20 lg:px-12" aria-labelledby="upload-title">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#2f837c]">{t("upload.eyebrow")}</p>
            <h2 id="upload-title" className="mt-2 text-3xl font-bold tracking-[-0.045em] sm:text-4xl">{t("upload.title")}</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#53627b]">{t("upload.description")}</p>
          </div>
          {(Object.keys(files).length > 0 ||
            pastedLecture.length > 0 ||
            pastedTranscript.length > 0 ||
            audioFile !== null ||
            processed ||
            SESSION_PROVIDER_IDS.some(
              (provider) => (sessionProviderKeys[provider]?.length ?? 0) > 0,
            )) && (
            <button type="button" onClick={reset} disabled={busy} className="inline-flex min-h-10 w-fit items-center gap-2 rounded-xl border border-[#14213d]/15 bg-white/60 px-4 text-sm font-bold hover:bg-white disabled:opacity-50">
              <RotateCcw className="size-4" /> {t("app.reset")}
            </button>
          )}
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {SOURCE_SPECS.map((spec) =>
            spec.sourceType === "slides" ? (
              <LectureSourceCard
                key={spec.sourceType}
                mode={lectureSourceMode}
                file={files.slides}
                pastedLecture={pastedLecture}
                pastedLectureState={pastedLectureState}
                inputKey={inputKey}
                disabled={busy}
                onModeChange={chooseLectureSourceMode}
                onFileSelect={chooseLectureFile}
                onPastedLectureChange={changePastedLecture}
                onUsePastedLecture={() => void acceptPastedLecture()}
                onClearPastedLecture={clearPastedLecture}
                t={t}
                locale={locale}
              />
            ) : spec.sourceType === "transcript" ? (
              <SpokenSourceCard
                key={spec.sourceType}
                mode={spokenSourceMode}
                transcriptInputKind={transcriptInputKind}
                transcriptFile={files.transcript}
                pastedTranscript={pastedTranscript}
                pastedTranscriptState={pastedTranscriptState}
                audioFile={audioFile}
                transcriptionState={transcriptionState}
                inputKey={inputKey}
                disabled={busy}
                audioConfigured={audioConfigured}
                onModeChange={chooseSpokenSourceMode}
                onTranscriptSelect={(file) => updateFile("transcript", file)}
                onPastedTranscriptChange={changePastedTranscript}
                onUsePastedTranscript={() => void acceptPastedTranscript()}
                onClearPastedTranscript={clearPastedTranscript}
                onAudioSelect={chooseAudioFile}
                onTranscribe={() => void transcribeAudio()}
                t={t}
                locale={locale}
              />
            ) : (
              <FileCard
                key={spec.sourceType}
                spec={spec}
                file={files[spec.sourceType]}
                inputKey={inputKey}
                disabled={busy}
                onSelect={updateFile}
                t={t}
                locale={locale}
              />
            ),
          )}
        </div>

        <ProviderControls
          catalog={providers}
          target={target}
          sessionKeys={sessionProviderKeys}
          kimiRegion={sessionKimiRegion}
          disabled={busy}
          onProviderChange={chooseProvider}
          onModelChange={chooseModel}
          onSessionKeyChange={changeSessionProviderKey}
          onClearSessionKey={clearSessionProviderKey}
          onClearAllSessionKeys={clearAllSessionProviderKeys}
          onKimiRegionChange={setSessionKimiRegion}
          t={t}
        />

        <ApiSetupGuide locale={locale} className="mt-4" />

        <OutputOptions
          includeAnki={includeAnki}
          locale={locale}
          outputLanguagePreference={outputLanguagePreference}
          disabled={busy}
          onAnkiChange={chooseAnkiOutput}
          onOutputLanguageChange={setOutputLanguagePreference}
          t={t}
        />

        <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-[#14213d]/10 bg-white/50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2 text-xs leading-5 text-[#53627b]"><Lock className="size-4 shrink-0 text-[#2f837c]" /> {t("upload.privacy")}</p>
          <div className="flex min-w-0 flex-col gap-2 sm:items-end">
            <p
              id="source-readiness"
              aria-live="polite"
              className={`max-w-xl text-sm font-bold leading-5 sm:text-right ${
                ready ? "text-[#1f625e]" : "text-[#765511]"
              }`}
            >
              {sourceReadinessHint}
            </p>
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
              <button
                type="button"
                disabled={!ready || busy}
                aria-describedby="source-readiness"
                onClick={() => { if (ready) void runManualPipeline(false); }}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#14213d]/15 bg-white px-5 text-sm font-bold text-[#14213d] transition hover:bg-[#f7f4ec] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading && loadingKind === "local" ? <LoaderCircle className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
                {t("upload.buildLocal")}
              </button>
              {selectedProvider !== undefined && target !== null && (
                <button
                  type="button"
                  disabled={!canAnalyzeLive}
                  aria-describedby={liveAnalysisDescriptionId}
                  onClick={() => { if (canAnalyzeLive) void runManualPipeline(true); }}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#2f837c] px-5 text-sm font-bold text-white transition hover:bg-[#1f625e] disabled:cursor-not-allowed disabled:bg-[#14213d]/20"
                >
                  {loading && loadingKind === "live" ? <LoaderCircle className="size-4 animate-spin" /> : <ScanText className="size-4" />}
                  {t("upload.analyzeWith", { provider: selectedProvider.label })}
                </button>
              )}
            </div>
            {liveAnalysisHint !== sourceReadinessHint && (
              <p
                id="live-analysis-readiness"
                aria-live="polite"
                className={`max-w-xl text-sm leading-5 sm:text-right ${
                  canAnalyzeLive ? "font-bold text-[#1f625e]" : "text-[#765511]"
                }`}
              >
                {liveAnalysisHint}
              </p>
            )}
          </div>
        </div>
      </section>

      <div ref={outputRef} tabIndex={-1} className="scroll-mt-5 outline-none">
        <div className="mx-auto max-w-[1440px] space-y-8 px-5 pb-20 sm:px-8 lg:px-12">
          {mode === "loading" && (
            <LoadingPanel
              message={t(loadingMessage.key, loadingMessage.values)}
              kind={loadingKind}
              t={t}
            />
          )}
          {mode === "error" && error && (
            <PipelineErrorPanel
              error={error}
              onRetryLive={() => void retryLiveAnalysis()}
              onRetryDemo={() => void tryDemo()}
              onUseLectureText={recoverWithLectureText}
              allowLectureTextRecovery={lectureSourceMode === "pdf"}
              t={t}
              locale={locale}
            />
          )}
          {processed && mode !== "loading" && <SourceMapSummary processed={processed} origin={result?.origin ?? null} locale={locale} t={t} />}
          {mode === "source-map" && (
            <SourceMapOnlyPanel
              provider={selectedProvider}
              canAnalyzeLive={canAnalyzeLive}
              analysisHint={liveAnalysisHint}
              onTryDemo={() => void tryDemo()}
              onAnalyzeLive={() => void retryLiveAnalysis()}
              t={t}
            />
          )}
          {mode === "idle" && <EmptyPreview t={t} />}

          {result && mode === "ready" && (
            <div className="space-y-18 animate-rise">
              <ScorePanel result={result} t={t} />
              <StudyWorkspace
                result={result}
                view={resultView}
                audioConfigured={audioConfigured}
                audioSessionApiKey={openAiSessionApiKey}
                onViewChange={setResultView}
                onOpenAssessment={openAssessmentEvidence}
                onOpenSection={openSectionEvidence}
                onOpenCard={openCardEvidence}
                t={t}
              />
            </div>
          )}
        </div>
      </div>

      <footer className="border-t border-[#14213d]/10 bg-[#eee9dd]/70">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-5 px-5 py-8 text-xs text-[#53627b] sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12">
          <div className="flex items-center gap-3"><LogoMark /><span><strong className="text-[#14213d]">LectureWeaver</strong><br />{t("app.footerTagline")}</span></div>
          <p className="max-w-xl leading-5 sm:text-right">{t("app.footerPrivacy")}</p>
        </div>
      </footer>

      {evidenceContent && <EvidenceDrawer content={evidenceContent} onClose={() => setEvidenceSelection(null)} t={t} />}
    </main>
  );
}
