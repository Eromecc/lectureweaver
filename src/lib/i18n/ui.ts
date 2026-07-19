/**
 * Static application chrome only. User uploads, trusted excerpts, model output,
 * filenames, provider/model names, and generated study-pack content must be
 * rendered verbatim instead of being passed through this catalog.
 */

export const UI_LOCALES = ["en", "zh-CN", "ja", "ko"] as const;

export type UiLocale = (typeof UI_LOCALES)[number];

export const DEFAULT_UI_LOCALE: UiLocale = "en";

export const UI_LOCALE_OPTIONS = [
  { value: "en", label: "English", shortLabel: "EN" },
  { value: "zh-CN", label: "简体中文", shortLabel: "中文" },
  { value: "ja", label: "日本語", shortLabel: "日" },
  { value: "ko", label: "한국어", shortLabel: "한" },
] as const satisfies readonly {
  value: UiLocale;
  label: string;
  shortLabel: string;
}[];

const ENGLISH_UI_MESSAGES = {
  "language.label": "Language",
  "language.switchAria": "Choose interface language",

  "app.homeAria": "LectureWeaver home",
  "app.localDemoBadge": "Local demo · Optional live AI",
  "app.tryDemo": "Try demo",
  "app.reset": "Reset",
  "app.footerTagline": "Evidence-grounded study pack",
  "app.footerPrivacy":
    "Try demo remains fixture-only and needs no API key. Optional live AI can use a deployment or temporary current-tab key to transcribe an uploaded recording, rebuild notes, create Anki cards, and generate a disclosed AI-voice study guide.",

  "hero.eyebrow": "Evidence-grounded study pack",
  "hero.headlinePrefix": "Turn lectures into notes you can",
  "hero.headlineAccent": "study.",
  "hero.description":
    "LectureWeaver audits what is missing, rebuilds your notes into a clearer learning guide, and creates optional Anki cards—each tied back to the source that supports it.",
  "hero.sampleEyebrow": "Judge-ready sample",
  "hero.sampleTitle": "Build a complete study pack in one click.",
  "hero.featureParsing": "Real local PDF, TXT, and Markdown parsing",
  "hero.featureNotes": "Reorganized notes with trusted evidence",
  "hero.featureAnki": "Anki-ready cards with no API key needed",
  "hero.demoLoading": "Weaving the sources…",
  "hero.sampleCta": "Try the sample lecture",
  "hero.sampleMeta": "No API key · no model request · about 3 seconds",

  "upload.eyebrow": "Your materials",
  "upload.title": "Build a trusted source map.",
  "upload.description":
    "Upload a lecture PDF or TXT—or paste lecture text—then add Markdown notes and a transcript file, pasted transcript, or recording. Text is parsed in this tab; audio is sent only after you explicitly request transcription.",
  "upload.privacy":
    "PDF, TXT, Markdown, and pasted text stay local · audio is sent to OpenAI only for explicit transcription · normalized chunks are sent only after you explicitly start live analysis · no silent truncation",
  "upload.buildLocal": "Build local source map",
  "upload.analyzeWith": "Extract and analyze with {provider}",

  "source.slidesEyebrow": "01 / Lecture source",
  "source.slidesTitle": "Lecture",
  "source.slidesDetail": "PDF, TXT, or pasted text",
  "source.slidesLimit": "10 MiB PDF · 1 MiB text",
  "source.transcriptEyebrow": "02 / Spoken context",
  "source.transcriptTitle": "Transcript",
  "source.transcriptDetail": "UTF-8 plain text",
  "source.transcriptLimit": "Up to 1 MiB",
  "source.notesEyebrow": "03 / Your baseline",
  "source.notesTitle": "Existing notes",
  "source.notesShortName": "Notes",
  "source.notesDetail": "Markdown",
  "source.notesLimit": "Up to 1 MiB",
  "source.readyLocally": "ready locally",
  "source.replaceFile": "Replace file",
  "source.chooseOrDropFile": "Choose or drop a file",
  "source.chooseFileAria": "Choose {source} file",

  "lecture.title": "Lecture material",
  "lecture.modeAria": "Choose lecture material type",
  "lecture.pdfMode": "PDF",
  "lecture.textMode": "TXT file",
  "lecture.pasteMode": "Paste lecture",
  "lecture.choosePdf": "Choose or drop a PDF",
  "lecture.chooseText": "Choose or drop a TXT file",
  "lecture.choosePdfAria": "Choose lecture PDF file",
  "lecture.chooseTextAria": "Choose lecture TXT file",
  "lecture.pdfDetail": "Text-based PDF · up to 10 MiB",
  "lecture.textDetail": "UTF-8 plain text · up to 1 MiB",
  "lecture.pasteLabel": "Paste lecture text",
  "lecture.pastePlaceholder": "Paste the lecture handout, outline, or slide text here…",
  "lecture.pasteDescription":
    "Pasted text validates automatically after a short pause; select Validate lecture text now to run it immediately. It then enters the same local chunking and evidence pipeline as a TXT upload.",
  "lecture.pasteUse": "Validate lecture text now",
  "lecture.pasteReplace": "Validate updated lecture text",
  "lecture.pasteClear": "Clear text",
  "lecture.pasteEmptyError": "Paste lecture text before continuing.",
  "lecture.pasteReadySuffix": "lecture text ready",
  "lecture.pasteCharacters": "{count} characters",
  "lecture.pasteLoading": "Validating lecture text…",
  "lecture.pasteReadyAnnouncement": "Pasted lecture text is ready.",
  "lecture.pasteErrorTitle": "Lecture text is not ready.",

  "spoken.title": "Transcript file, pasted text, or audio",
  "spoken.modeAria": "Choose spoken source type",
  "spoken.transcriptMode": "Transcript TXT",
  "spoken.pasteMode": "Paste text",
  "spoken.pasteLabel": "Paste transcript text",
  "spoken.pastePlaceholder": "Paste or type the lecture transcript here…",
  "spoken.pasteDescription":
    "Pasted text validates automatically after a short pause; select Validate transcript now to run it immediately. It uses the same local pipeline as a TXT upload.",
  "spoken.pasteUse": "Validate transcript now",
  "spoken.pasteReplace": "Validate updated transcript",
  "spoken.pasteClear": "Clear pasted text",
  "spoken.pasteEmptyError": "Paste transcript text before continuing.",
  "spoken.pasteReadySuffix": "pasted text ready",
  "spoken.pasteCharacters": "{count} characters",
  "spoken.pasteLoading": "Validating pasted transcript…",
  "spoken.pasteReadyAnnouncement": "Pasted transcript is ready.",
  "spoken.pasteErrorTitle": "Pasted transcript is not ready.",
  "spoken.audioMode": "Lecture audio",
  "spoken.chooseTranscript": "Choose or drop a transcript",
  "spoken.chooseTranscriptAria": "Choose transcript file",
  "spoken.chooseAudio": "Choose or drop lecture audio",
  "spoken.chooseAudioAria": "Choose lecture audio file",
  "spoken.audioFormats":
    "FLAC, MP3, MP4, MPEG, MPGA, M4A, OGG, WAV, or WebM · Up to {megabytes} MB",
  "spoken.replaceAudio": "Replace audio",
  "spoken.transcriptReadySuffix": "transcript ready",
  "spoken.signatureCheckingSuffix": "checking file signature",
  "spoken.awaitingTranscriptionSuffix": "awaiting transcription",
  "spoken.cloudTitle": "Explicit cloud transcription",
  "spoken.cloudDisclosure":
    "When you press transcribe, raw audio passes through the LectureWeaver server to OpenAI and uses the active API credential—your temporary OpenAI key when entered, otherwise the deployment key. LectureWeaver neither stores nor logs the recording or transcript.",
  "spoken.unconfigured":
    "OpenAI audio is not available yet. Enter a valid temporary OpenAI key below, configure a deployment key, use a transcript TXT file, or Try demo.",
  "spoken.errorTitle": "Transcription did not finish.",
  "spoken.timestampReady": "Timestamped transcript ready",
  "spoken.segmentCountOne": "{count} segment",
  "spoken.segmentCountOther": "{count} segments",
  "spoken.previewTranscript": "Preview transcript",
  "spoken.copyTranscript": "Copy transcript",
  "spoken.downloadTranscript": "Download .txt",
  "spoken.transcribing": "Transcribing with OpenAI…",
  "spoken.checkingAudio": "Checking audio…",
  "spoken.audioUnavailable": "OpenAI audio unavailable",
  "spoken.transcribeAgain": "Transcribe again",
  "spoken.replaceInvalid": "Replace invalid audio",
  "spoken.checkConfiguration": "Check OpenAI configuration",
  "spoken.retry": "Retry transcription",
  "spoken.send": "Send to OpenAI & transcribe",
  "spoken.progressTranscribing": "Audio transcription is in progress.",
  "spoken.progressValidating": "Audio validation is in progress.",
  "spoken.progressReady": "Timestamped transcript is ready.",
  "spoken.unsupportedFallback":
    "Choose a supported audio recording within the upload limit.",
  "spoken.failedFallback": "The audio transcription could not be completed.",

  "provider.legend": "Optional live analysis",
  "provider.providerLabel": "AI provider",
  "provider.modelLabel": "AI model",
  "provider.noneConfigured": "No provider configured",
  "provider.noModel": "No model available",
  "provider.notConfiguredSuffix": "deployment key not configured",
  "provider.noSettings": "This deployment has no live provider settings.",
  "provider.serverKeyConfigured": "Server key configured",
  "provider.localOnly": "Local source map only",
  "provider.temporaryActive": "Temporary key active",
  "provider.temporaryTitle": "Use a temporary key in this tab",
  "provider.temporaryDescription":
    "Enter separate OpenAI, DeepSeek, or Kimi credentials. A valid temporary key takes priority over that provider's deployment key and disappears when you clear, reset, close, or reload this page.",
  "provider.temporaryKeyLabel": "Temporary {provider} API key",
  "provider.temporaryKeyPlaceholder": "Paste key for this tab only",
  "provider.temporaryReady": "Ready for this tab",
  "provider.temporaryInvalid": "Enter a valid 8–512 character API key.",
  "provider.temporaryEmpty": "Not entered",
  "provider.clearKey": "Clear {provider} key",
  "provider.clearAll": "Clear all temporary keys",
  "provider.kimiRegionLabel": "Kimi API region",
  "provider.kimiRegionPlaceholder": "Choose a Kimi API region",
  "provider.kimiRegionCn": "China · api.moonshot.cn",
  "provider.kimiRegionGlobal": "Global · api.moonshot.ai",
  "provider.temporaryTrust":
    "LectureWeaver keeps these keys only in this page's memory. It does not save them to browser storage, cookies, URLs, logs, or a database.",
  "provider.temporaryVisibility":
    "For a live request, the selected key crosses this site's HTTPS Vercel function and is forwarded only to the selected provider. Your browser, developer tools, extensions, and the provider can still see it; use a trusted device.",
  "provider.keyGuidanceTitle": "Where do API keys go?",
  "provider.keyGuidance":
    "For durable setup, configure keys in Vercel Project Settings → Environment Variables or .env.local. You may instead use the temporary masked fields above for this tab only.",
  "provider.keyNames":
    "Supported server variables: OPENAI_API_KEY, DEEPSEEK_API_KEY, and KIMI_API_KEY.",
  "provider.reloadAfterConfig":
    "Redeploy after changing Vercel environment variables, then reload this page.",

  "analysis.chooseProvider": "Choose an AI provider and model.",
  "analysis.invalidKey":
    "The temporary {provider} key is invalid. Correct or clear it before analysis.",
  "analysis.kimiRegion": "Choose the Kimi API region before analysis.",
  "analysis.enterKey":
    "Enter a valid temporary {provider} key above, or configure its deployment key.",
  "analysis.sourcesReady": "Lecture, transcript, and notes are ready.",
  "analysis.missingLecture":
    "Add a lecture PDF/TXT or paste lecture text.",
  "analysis.preparingLecturePaste":
    "Wait for the pasted lecture text to validate, or validate it now.",
  "analysis.fixLecturePaste":
    "Fix the pasted lecture text, then validate it again.",
  "analysis.missingTranscript":
    "Add a transcript TXT, paste transcript text, or use lecture audio.",
  "analysis.preparingTranscriptPaste":
    "Wait for the pasted transcript to validate, or validate it now.",
  "analysis.fixTranscriptPaste":
    "Fix the pasted transcript, then validate it again.",
  "analysis.missingAudio": "Add a lecture audio file.",
  "analysis.transcribeAudio": "Transcribe the selected lecture audio.",
  "analysis.missingNotes":
    "Upload your existing Markdown notes as a .md or .markdown file.",
  "analysis.busy":
    "Wait for the current processing step to finish before starting analysis.",
  "analysis.ready":
    "{provider} is ready. Starting analysis will send the normalized source text.",

  "outputs.legend": "Study pack outputs",
  "outputs.languageLabel": "Output language",
  "outputs.followInterface": "Follow interface ({language})",
  "outputs.languageDescription":
    "Choose the language for the next live analysis. Existing results are not translated automatically.",
  "outputs.demoLanguageNote":
    "The deterministic included demo remains a fixed English sample.",
  "outputs.alwaysIncluded": "Always included",
  "outputs.optional": "Optional",
  "outputs.notesTitle": "Enhanced notes",
  "outputs.notesDescription":
    "Always rebuild a complete, logically ordered Markdown study guide.",
  "outputs.ankiTitle": "Create Anki cards",
  "outputs.ankiDescription":
    "Add evidence-grounded Basic cards that cover every core assessment.",
  "outputs.retention":
    "Output choices apply to the next analysis. An existing study pack stays available until you run it again or replace a source file.",

  "pipeline.live": "Live model analysis",
  "pipeline.demo": "No-key demo",
  "pipeline.local": "Local processing",
  "pipeline.validateFiles": "Validate files",
  "pipeline.auditConcepts": "Audit concepts",
  "pipeline.rebuildNotes": "Rebuild notes",
  "pipeline.createStudyTools": "Create study tools",
  "pipeline.extractNormalize": "Extract + normalize",
  "pipeline.verifyFixture": "Verify fixture",
  "pipeline.buildStudyPack": "Build study pack",
  "pipeline.buildSourceMap": "Build source map",
  "pipeline.hydrateEvidence": "Hydrate evidence",
  "pipeline.checkingSafety": "Checking file safety…",
  "pipeline.analyzing": "Analyzing normalized chunks with {provider} · {model}…",
  "pipeline.liveWaitHint":
    "Large source maps can take up to about 3 minutes. Keep this tab open while the selected provider finishes.",
  "pipeline.validatingAudioSources":
    "Validating the lecture source, notes, and timestamped transcript…",
  "pipeline.validatingTextSources": "Validating the three local sources…",
  "pipeline.extractingAudioSources":
    "Extracting lecture structure and hydrating validated transcription timestamps…",
  "pipeline.extractingTextSources":
    "Extracting lecture and paragraph structure…",
  "pipeline.finalizingSourceMap": "Finalizing the local source map…",
  "pipeline.loadingDemo": "Loading the included sample files…",
  "pipeline.verifyingDemo":
    "Verifying the sample fingerprint and hydrating evidence…",

  "sourceMap.eyebrow": "Freshly extracted",
  "sourceMap.title": "Trusted source map",
  "sourceMap.description":
    "Every locator below was rebuilt from parsed files or a validated timestamped transcription—not from the later analysis model.",
  "sourceMap.sampleVerified": "Sample fingerprint verified",
  "sourceMap.localReady": "Local source map ready",
  "sourceMap.chunkCountOne": "{count} chunk",
  "sourceMap.chunkCountOther": "{count} chunks",
  "sourceMap.total": "{characters} normalized characters · {chunks} chunks total",

  "error.processingFallback":
    "LectureWeaver could not process those files. Please try again.",
  "error.liveFallback": "The selected model did not return a usable analysis.",
  "error.demoFallback": "The included demo could not be loaded. Please retry.",
  "error.liveTitle": "Live analysis did not finish.",
  "error.demoTitle": "The included demo did not load.",
  "error.processingTitle": "We could not process those sources.",
  "error.retry": "Retry live analysis",
  "error.retryDemo": "Retry demo",
  "error.tryDemo": "Use included demo",
  "error.useLectureText": "Use lecture text instead",
  "error.replaceAndRetry":
    "Replace the affected file and retry, or load the included demo.",
  "error.demoRecovery":
    "Retry the same checked-in sample. No live model request will be made.",
  "error.liveRetryRecovery":
    "Your local source map is preserved. Retry, select another ready model, or use the included demo.",
  "error.liveTimeoutRecovery":
    "Your local source map is preserved. Retry once. If it times out again, choose DeepSeek V4 Flash, turn off optional Anki cards, or select another credential-ready provider.",
  "error.liveConfigRecovery":
    "Your local source map is preserved. Check the temporary or deployment credential, select another model, or use the included demo.",

  "empty.title": "Your local source map is ready.",
  "empty.unconfigured":
    "No deployment key or valid temporary key is ready for the selected provider, so no normalized chunks were sent.",
  "empty.notSent":
    "Nothing has been sent to {provider} yet. Start live analysis when you are ready to transmit the normalized chunks.",
  "empty.analyzeCurrent": "Analyze current source map with {provider}",

  "score.coverage": "Coverage score",
  "score.strong": "Strong coverage",
  "score.gaps": "Important gaps found",
  "score.needsPass": "Needs a careful pass",
  "score.demoOrigin": "Simulated demo analysis · real evidence",
  "score.liveOrigin": "Live analysis · {provider} · {model}",
  "score.covered": "Covered",
  "score.partial": "Partial",
  "score.missing": "Missing",
  "score.contradictions": "Contradictions",
  "score.conceptsAudited": "{count} concepts audited",
  "score.explanation":
    "Score calculated in app code: covered + half of partial.",

  "review.eyebrow": "Review queue",
  "review.title": "Close the important gaps.",
  "review.description":
    "Core findings rise first. Open a card to compare the claim against fresh source excerpts.",
  "review.filterAria": "Filter review issues",
  "review.all": "All issues",
  "review.missing": "Missing",
  "review.partial": "Partial",
  "review.contradictions": "Contradictions",
  "review.missingExplanation": "Missing explanation",
  "review.partiallyCovered": "Partially covered",
  "review.possibleContradiction": "Possible contradiction",
  "review.core": "core",
  "review.supporting": "supporting",
  "review.none": "No findings in this category.",
  "review.inspectEvidence": "Inspect evidence",

  "workspace.aria": "Study pack workspace",
  "workspace.chooseViewAria": "Choose a study pack view",
  "workspace.notesTab": "Enhanced notes",
  "workspace.auditTab": "Audit trail",
  "workspace.changesTab": "Changes only",
  "workspace.ankiTab": "Anki cards · {count}",
  "workspace.audioTab": "Audio guide",

  "notes.eyebrow": "Complete learning guide",
  "notes.title": "Enhanced notes",
  "notes.description":
    "Accurate material is preserved, thin explanations are expanded, missing ideas are added, and contradictions are corrected in a teachable order. Your original file is never overwritten.",
  "notes.copy": "Copy full notes",
  "notes.export": "Export Markdown",
  "notes.contents": "Table of contents",
  "notes.contentsAria": "Enhanced notes table of contents",
  "notes.sectionCount": "{count} logically ordered sections",
  "notes.learningObjective": "Learning objective",
  "notes.inspectSources": "Inspect section sources",
  "notes.viewMarkdown": "View generated Markdown",
  "notes.preserved": "Preserved",
  "notes.expanded": "Expanded",
  "notes.corrected": "Corrected",
  "notes.new": "New",

  "anki.notRequestedTitle": "Anki cards were not requested.",
  "anki.notRequestedDescription":
    "Turn on Create Anki cards before running the analysis to add evidence-grounded Basic cards to the study pack.",
  "anki.eyebrow": "Active recall deck",
  "anki.readyCount": "{count} Anki-ready cards",
  "anki.description":
    "Import the UTF-8 text file into Anki using a Basic note type. Front, back, tags, and trusted source locators are generated deterministically.",
  "anki.copy": "Copy Anki text",
  "anki.download": "Download Anki .txt",
  "anki.basicCard": "Basic card",
  "anki.front": "Front",
  "anki.reveal": "Reveal answer",
  "anki.inspectSource": "Inspect card source",

  "audio.eyebrow": "Listen anywhere",
  "audio.title": "Audio study guide",
  "audio.description":
    "Turn validated enhanced notes into an optional spoken review. The narration is derived in application code and never silently truncated.",
  "audio.chooseNarration": "Choose what to narrate",
  "audio.requestLimit":
    "The speech request limit is {limit} characters. Oversized full guides remain intact and are unavailable; choose a section instead.",
  "audio.narrationSection": "Narration section",
  "audio.charactersShort": "{count} chars",
  "audio.tooLongShort": "too long",
  "audio.fullGuide": "Full study guide",
  "audio.sectionLabel": "Section {number} · {heading}",
  "audio.voice": "Voice",
  "audio.format": "Format",
  "audio.characterCount": "{count} / {limit} characters",
  "audio.tooLong":
    "This selection is too long for one speech request. Choose a shorter section.",
  "audio.aiDisclosure": "AI-generated voice",
  "audio.disclosureDetail":
    "Disclosure: this voice is generated by artificial intelligence and is not a human recording.",
  "audio.transmissionDisclosure":
    "The selected narration text is sent to OpenAI using the active API credential—your temporary OpenAI key when entered, otherwise the deployment key. LectureWeaver does not persist the generated audio or script.",
  "audio.unconfiguredSpeech":
    "Enter a valid temporary OpenAI key or configure a deployment key to generate speech. Enhanced notes remain available for copy and Markdown export.",
  "audio.playback": "Playback",
  "audio.emptyInstructions":
    "Select a section, voice, and format, then generate a downloadable study guide.",
  "audio.generatedMeta": "{voice} voice · {format} · AI-generated speech",
  "audio.unsupportedPlayback": "Your browser does not support audio playback.",
  "audio.generate": "Generate audio guide",
  "audio.regenerate": "Regenerate audio",
  "audio.generating": "Generating audio…",
  "audio.unavailable": "OpenAI audio unavailable",
  "audio.retry": "Retry audio generation",
  "audio.failedTitle": "Audio generation did not finish.",
  "audio.failedFallback": "The audio study guide could not be generated.",
  "audio.placeholder": "Your review audio will appear here.",
  "audio.download": "Download",
  "audio.playerAria": "Audio study guide: {label}",

  "changes.emptyTitle": "No changes are needed.",
  "changes.emptyDescription":
    "The audit found no partial, missing, or contradictory concepts, so there is no changes-only file to export.",
  "changes.eyebrow": "Ready to merge",
  "changes.title": "Suggested additions",
  "changes.description":
    "Generated deterministically from actionable findings, with evidence locators included.",
  "changes.copy": "Copy Markdown",
  "changes.fileName": "lectureweaver-additions.md",

  "export.copied": "Copied",
  "export.copyFailed": "Copy failed",
  "export.copiedAnnouncement": "{label} copied to clipboard.",
  "export.clipboardUnavailable": "Could not access the clipboard.",

  "evidence.closeAria": "Close evidence panel",
  "evidence.auditEyebrow": "Audit evidence",
  "evidence.notesEyebrow": "Enhanced-note sources",
  "evidence.ankiEyebrow": "Anki card source",
  "evidence.whyItMatters": "Why it matters:",
  "evidence.more": "+{count} more",
  "evidence.trust":
    "Names, locators, headings, and excerpts come from parsed files or validated transcription—not from the later analysis model.",

  "how.aria": "How the demo works",
  "how.extractTitle": "Extract",
  "how.extractText": "PDF pages and numbered paragraphs",
  "how.analyzeTitle": "Analyze",
  "how.analyzeText": "No-key demo or an explicitly keyed live model",
  "how.buildTitle": "Build",
  "how.buildText": "Enhanced notes, trusted evidence, and study cards",
} as const;

export type UiMessageKey = keyof typeof ENGLISH_UI_MESSAGES;

export type UiMessageValues = Readonly<Record<string, string | number>>;

type UiMessageCatalog = Readonly<Record<UiMessageKey, string>>;

const SIMPLIFIED_CHINESE_UI_MESSAGES = {
  "language.label": "语言",
  "language.switchAria": "选择界面语言",

  "app.homeAria": "LectureWeaver 首页",
  "app.localDemoBadge": "本地演示 · 可选实时 AI",
  "app.tryDemo": "体验演示",
  "app.reset": "重置",
  "app.footerTagline": "基于证据的学习资料包",
  "app.footerPrivacy":
    "演示模式只使用内置样例，无需 API 密钥。可选实时 AI 可使用部署密钥或当前标签页临时密钥来转写课堂录音、重组笔记、制作 Anki 卡片，并生成明确标注为 AI 语音的学习音频。",

  "hero.eyebrow": "基于证据的学习资料包",
  "hero.headlinePrefix": "把课堂内容变成真正能用来",
  "hero.headlineAccent": "学习的笔记。",
  "hero.description":
    "LectureWeaver 会检查遗漏内容，把原笔记重组为更清晰的学习指南，并可生成 Anki 卡片；每项结果都能追溯到支持它的原始证据。",
  "hero.sampleEyebrow": "评审即开即用",
  "hero.sampleTitle": "一键生成完整学习资料包。",
  "hero.featureParsing": "在本地真实解析 PDF、TXT 和 Markdown",
  "hero.featureNotes": "按可信证据重组笔记",
  "hero.featureAnki": "无需 API 密钥即可生成 Anki 卡片",
  "hero.demoLoading": "正在整合资料…",
  "hero.sampleCta": "体验示例课程",
  "hero.sampleMeta": "无需 API 密钥 · 不调用模型 · 约 3 秒",

  "upload.eyebrow": "你的材料",
  "upload.title": "建立可信来源地图。",
  "upload.description":
    "上传 PDF 或 TXT 讲义，也可以直接粘贴讲义文本；然后添加 Markdown 笔记，以及 TXT 讲稿、粘贴讲稿或课堂录音。文本会在当前标签页中解析；只有明确要求转写时才会发送音频。",
  "upload.privacy":
    "PDF、TXT、Markdown 和粘贴文本保留在本地 · 仅在明确转写时向 OpenAI 发送音频 · 仅在你明确启动实时分析后发送规范化文本块 · 绝不静默截断",
  "upload.buildLocal": "建立本地来源地图",
  "upload.analyzeWith": "提取并使用 {provider} 分析",

  "source.slidesEyebrow": "01 / 课堂来源",
  "source.slidesTitle": "讲义",
  "source.slidesDetail": "PDF、TXT 或粘贴文本",
  "source.slidesLimit": "PDF 10 MiB · 文本 1 MiB",
  "source.transcriptEyebrow": "02 / 讲授内容",
  "source.transcriptTitle": "讲稿",
  "source.transcriptDetail": "UTF-8 纯文本",
  "source.transcriptLimit": "最大 1 MiB",
  "source.notesEyebrow": "03 / 你的基础笔记",
  "source.notesTitle": "现有笔记",
  "source.notesShortName": "笔记",
  "source.notesDetail": "Markdown",
  "source.notesLimit": "最大 1 MiB",
  "source.readyLocally": "已在本地就绪",
  "source.replaceFile": "替换文件",
  "source.chooseOrDropFile": "选择或拖放文件",
  "source.chooseFileAria": "选择{source}文件",

  "lecture.title": "讲义内容",
  "lecture.modeAria": "选择讲义来源类型",
  "lecture.pdfMode": "PDF",
  "lecture.textMode": "TXT 文件",
  "lecture.pasteMode": "粘贴讲义",
  "lecture.choosePdf": "选择或拖放 PDF",
  "lecture.chooseText": "选择或拖放 TXT 文件",
  "lecture.choosePdfAria": "选择讲义 PDF 文件",
  "lecture.chooseTextAria": "选择讲义 TXT 文件",
  "lecture.pdfDetail": "文本型 PDF · 最大 10 MiB",
  "lecture.textDetail": "UTF-8 纯文本 · 最大 1 MiB",
  "lecture.pasteLabel": "粘贴讲义文本",
  "lecture.pastePlaceholder": "在此粘贴讲义、课程提纲或幻灯片文本…",
  "lecture.pasteDescription":
    "粘贴后稍作停顿会自动验证；点击“立即验证讲义文本”可马上开始。验证后会进入与上传 TXT 相同的本地分块和证据流程。",
  "lecture.pasteUse": "立即验证讲义文本",
  "lecture.pasteReplace": "立即验证更新后的讲义文本",
  "lecture.pasteClear": "清除文本",
  "lecture.pasteEmptyError": "请先粘贴讲义文本再继续。",
  "lecture.pasteReadySuffix": "讲义文本已就绪",
  "lecture.pasteCharacters": "{count} 个字符",
  "lecture.pasteLoading": "正在验证讲义文本…",
  "lecture.pasteReadyAnnouncement": "粘贴的讲义文本已就绪。",
  "lecture.pasteErrorTitle": "讲义文本尚未就绪。",

  "spoken.title": "讲稿文件、粘贴文本或音频",
  "spoken.modeAria": "选择讲授内容来源类型",
  "spoken.transcriptMode": "TXT 讲稿",
  "spoken.pasteMode": "粘贴文本",
  "spoken.pasteLabel": "粘贴讲稿文本",
  "spoken.pastePlaceholder": "在此粘贴或输入课堂讲稿…",
  "spoken.pasteDescription":
    "粘贴后稍作停顿会自动验证；点击“立即验证讲稿”可马上开始，并使用与上传 TXT 相同的本地流程。",
  "spoken.pasteUse": "立即验证讲稿",
  "spoken.pasteReplace": "立即验证更新后的讲稿",
  "spoken.pasteClear": "清除粘贴文本",
  "spoken.pasteEmptyError": "请先粘贴讲稿文本再继续。",
  "spoken.pasteReadySuffix": "粘贴文本已就绪",
  "spoken.pasteCharacters": "{count} 个字符",
  "spoken.pasteLoading": "正在验证粘贴的讲稿…",
  "spoken.pasteReadyAnnouncement": "粘贴的讲稿已就绪。",
  "spoken.pasteErrorTitle": "粘贴的讲稿尚未就绪。",
  "spoken.audioMode": "课堂音频",
  "spoken.chooseTranscript": "选择或拖放讲稿",
  "spoken.chooseTranscriptAria": "选择讲稿文件",
  "spoken.chooseAudio": "选择或拖放课堂音频",
  "spoken.chooseAudioAria": "选择课堂音频文件",
  "spoken.audioFormats":
    "FLAC、MP3、MP4、MPEG、MPGA、M4A、OGG、WAV 或 WebM · 最大 {megabytes} MB",
  "spoken.replaceAudio": "替换音频",
  "spoken.transcriptReadySuffix": "讲稿已就绪",
  "spoken.signatureCheckingSuffix": "正在检查文件签名",
  "spoken.awaitingTranscriptionSuffix": "等待转写",
  "spoken.cloudTitle": "明确发起云端转写",
  "spoken.cloudDisclosure":
    "点击转写后，原始音频会经 LectureWeaver 服务器发送到 OpenAI，并使用当前有效凭据：已输入时使用你的临时 OpenAI 密钥，否则使用部署密钥。LectureWeaver 不存储也不记录录音或转写文本。",
  "spoken.unconfigured":
    "OpenAI 音频尚不可用。请在下方输入有效的临时 OpenAI 密钥、配置部署密钥，或改用 TXT 讲稿与体验演示。",
  "spoken.errorTitle": "转写未完成。",
  "spoken.timestampReady": "带时间戳的讲稿已就绪",
  "spoken.segmentCountOne": "{count} 个片段",
  "spoken.segmentCountOther": "{count} 个片段",
  "spoken.previewTranscript": "预览讲稿",
  "spoken.copyTranscript": "复制讲稿",
  "spoken.downloadTranscript": "下载 .txt",
  "spoken.transcribing": "正在使用 OpenAI 转写…",
  "spoken.checkingAudio": "正在检查音频…",
  "spoken.audioUnavailable": "OpenAI 音频不可用",
  "spoken.transcribeAgain": "重新转写",
  "spoken.replaceInvalid": "替换无效音频",
  "spoken.checkConfiguration": "检查 OpenAI 配置",
  "spoken.retry": "重试转写",
  "spoken.send": "发送到 OpenAI 并转写",
  "spoken.progressTranscribing": "正在转写音频。",
  "spoken.progressValidating": "正在验证音频。",
  "spoken.progressReady": "带时间戳的讲稿已就绪。",
  "spoken.unsupportedFallback": "请选择上传限制内的受支持音频文件。",
  "spoken.failedFallback": "无法完成音频转写。",

  "provider.legend": "可选实时分析",
  "provider.providerLabel": "AI 服务商",
  "provider.modelLabel": "AI 模型",
  "provider.noneConfigured": "未配置服务商",
  "provider.noModel": "没有可用模型",
  "provider.notConfiguredSuffix": "未配置部署密钥",
  "provider.noSettings": "此部署没有实时 AI 服务配置。",
  "provider.serverKeyConfigured": "服务端密钥已配置",
  "provider.localOnly": "仅建立本地来源地图",
  "provider.temporaryActive": "临时密钥已启用",
  "provider.temporaryTitle": "在当前标签页使用临时密钥",
  "provider.temporaryDescription":
    "可分别输入 OpenAI、DeepSeek 或 Kimi 密钥。有效的临时密钥会优先于该服务商的部署密钥，并在清除、重置、关闭或刷新页面后消失。",
  "provider.temporaryKeyLabel": "临时 {provider} API 密钥",
  "provider.temporaryKeyPlaceholder": "粘贴密钥，仅用于当前标签页",
  "provider.temporaryReady": "当前标签页已就绪",
  "provider.temporaryInvalid": "请输入 8–512 个字符的有效 API 密钥。",
  "provider.temporaryEmpty": "尚未输入",
  "provider.clearKey": "清除 {provider} 密钥",
  "provider.clearAll": "清除全部临时密钥",
  "provider.kimiRegionLabel": "Kimi API 区域",
  "provider.kimiRegionPlaceholder": "请选择 Kimi API 区域",
  "provider.kimiRegionCn": "中国 · api.moonshot.cn",
  "provider.kimiRegionGlobal": "全球 · api.moonshot.ai",
  "provider.temporaryTrust":
    "LectureWeaver 只会把这些密钥保留在当前页面内存中，不会写入浏览器存储、Cookie、网址、日志或数据库。",
  "provider.temporaryVisibility":
    "发起实时请求时，所选密钥会通过本站的 HTTPS Vercel 函数，并只转发给所选服务商。你的浏览器、开发者工具、扩展程序和服务商仍可能看到它；请使用可信设备。",
  "provider.keyGuidanceTitle": "API 密钥应填在哪里？",
  "provider.keyGuidance":
    "长期使用建议在 Vercel 项目设置 → 环境变量或 .env.local 中配置。也可以使用上方遮罩输入框，仅在当前标签页临时使用。",
  "provider.keyNames":
    "支持的服务端变量：OPENAI_API_KEY、DEEPSEEK_API_KEY 和 KIMI_API_KEY。",
  "provider.reloadAfterConfig":
    "修改 Vercel 环境变量后请重新部署，再刷新本页面。",

  "analysis.chooseProvider": "请选择 AI 服务商和模型。",
  "analysis.invalidKey":
    "临时 {provider} 密钥无效；请更正或清除后再分析。",
  "analysis.kimiRegion": "请先选择 Kimi API 区域。",
  "analysis.enterKey":
    "请在上方输入有效的临时 {provider} 密钥，或为该服务商配置部署密钥。",
  "analysis.sourcesReady": "讲义、讲稿和笔记均已就绪。",
  "analysis.missingLecture": "添加讲义 PDF/TXT，或粘贴讲义文本。",
  "analysis.preparingLecturePaste":
    "请等待粘贴的讲义文本完成验证，或立即验证。",
  "analysis.fixLecturePaste":
    "请修正粘贴的讲义文本，然后重新验证。",
  "analysis.missingTranscript":
    "添加讲稿 TXT、粘贴讲稿文本，或使用课堂音频。",
  "analysis.preparingTranscriptPaste":
    "请等待粘贴的讲稿完成验证，或立即验证。",
  "analysis.fixTranscriptPaste": "请修正粘贴的讲稿，然后重新验证。",
  "analysis.missingAudio": "添加课堂音频文件。",
  "analysis.transcribeAudio": "转录已选择的课堂音频。",
  "analysis.missingNotes": "请将现有笔记作为 .md 或 .markdown 文件上传。",
  "analysis.busy": "请等待当前处理步骤完成后再开始分析。",
  "analysis.ready":
    "{provider} 已就绪；开始分析会发送规范化后的来源文本。",

  "outputs.legend": "学习资料包输出",
  "outputs.languageLabel": "输出语言",
  "outputs.followInterface": "跟随界面（{language}）",
  "outputs.languageDescription":
    "选择下一次实时分析的生成语言；已有结果不会自动翻译。",
  "outputs.demoLanguageNote": "内置确定性演示仍使用固定英文样例。",
  "outputs.alwaysIncluded": "始终包含",
  "outputs.optional": "可选",
  "outputs.notesTitle": "增强笔记",
  "outputs.notesDescription": "始终重建一份完整、逻辑清晰的 Markdown 学习指南。",
  "outputs.ankiTitle": "生成 Anki 卡片",
  "outputs.ankiDescription": "添加有证据支持的 Basic 卡片，并覆盖所有核心评估项。",
  "outputs.retention":
    "输出选项会应用于下一次分析；现有学习资料包会保留，直到你重新运行分析或替换来源文件。",

  "pipeline.live": "实时模型分析",
  "pipeline.demo": "无密钥演示",
  "pipeline.local": "本地处理",
  "pipeline.validateFiles": "验证文件",
  "pipeline.auditConcepts": "审查概念",
  "pipeline.rebuildNotes": "重建笔记",
  "pipeline.createStudyTools": "生成学习工具",
  "pipeline.extractNormalize": "提取并规范化",
  "pipeline.verifyFixture": "验证演示夹具",
  "pipeline.buildStudyPack": "生成学习资料包",
  "pipeline.buildSourceMap": "建立来源地图",
  "pipeline.hydrateEvidence": "关联可信证据",
  "pipeline.checkingSafety": "正在检查文件安全性…",
  "pipeline.analyzing": "正在使用 {provider} · {model} 分析规范化文本块…",
  "pipeline.liveWaitHint":
    "较大的来源地图可能需要约 3 分钟。请保持当前标签页打开，等待所选服务商完成。",
  "pipeline.validatingAudioSources": "正在验证讲义来源、笔记和带时间戳的讲稿…",
  "pipeline.validatingTextSources": "正在验证三个本地来源…",
  "pipeline.extractingAudioSources": "正在提取讲义结构并关联已验证的转写时间戳…",
  "pipeline.extractingTextSources": "正在提取讲义和段落结构…",
  "pipeline.finalizingSourceMap": "正在完成本地来源地图…",
  "pipeline.loadingDemo": "正在加载内置示例文件…",
  "pipeline.verifyingDemo": "正在验证示例指纹并关联证据…",

  "sourceMap.eyebrow": "刚刚完成提取",
  "sourceMap.title": "可信来源地图",
  "sourceMap.description":
    "下方所有定位信息均来自重新解析的文件或已验证的带时间戳转写，而不是后续分析模型。",
  "sourceMap.sampleVerified": "示例指纹已验证",
  "sourceMap.localReady": "本地来源地图已就绪",
  "sourceMap.chunkCountOne": "{count} 个文本块",
  "sourceMap.chunkCountOther": "{count} 个文本块",
  "sourceMap.total": "{characters} 个规范化字符 · 共 {chunks} 个文本块",

  "error.processingFallback": "LectureWeaver 无法处理这些文件，请重试。",
  "error.liveFallback": "所选模型未返回可用的分析结果。",
  "error.demoFallback": "无法加载内置演示，请重试。",
  "error.liveTitle": "实时分析未完成。",
  "error.demoTitle": "内置演示未能加载。",
  "error.processingTitle": "无法处理这些来源。",
  "error.retry": "重试实时分析",
  "error.retryDemo": "重试演示",
  "error.tryDemo": "使用内置演示",
  "error.useLectureText": "改用讲义文本",
  "error.replaceAndRetry": "替换有问题的文件后重试，或加载内置演示。",
  "error.demoRecovery": "请对同一套内置样例重试；不会发起实时模型请求。",
  "error.liveRetryRecovery":
    "本地来源地图已保留。请重试、选择其他已就绪模型，或使用内置演示。",
  "error.liveTimeoutRecovery":
    "本地来源地图已保留。请先重试一次；若再次超时，可选择 DeepSeek V4 Flash、关闭可选 Anki 卡片，或改用其他已配置有效密钥的服务商。",
  "error.liveConfigRecovery":
    "本地来源地图已保留。请检查临时密钥或部署密钥、选择其他模型，或使用内置演示。",

  "empty.title": "本地来源地图已就绪。",
  "empty.unconfigured": "所选服务商既没有部署密钥，也没有有效临时密钥，因此没有发送任何规范化文本块。",
  "empty.notSent": "尚未向 {provider} 发送任何内容。准备好传输规范化文本块后再开始实时分析。",
  "empty.analyzeCurrent": "使用 {provider} 分析当前来源地图",

  "score.coverage": "覆盖率",
  "score.strong": "覆盖充分",
  "score.gaps": "发现重要缺口",
  "score.needsPass": "需要仔细复查",
  "score.demoOrigin": "模拟演示分析 · 真实证据",
  "score.liveOrigin": "实时分析 · {provider} · {model}",
  "score.covered": "已覆盖",
  "score.partial": "部分覆盖",
  "score.missing": "缺失",
  "score.contradictions": "矛盾",
  "score.conceptsAudited": "已审查 {count} 个概念",
  "score.explanation": "分数由应用代码计算：已覆盖项 + 部分覆盖项的一半。",

  "review.eyebrow": "复查队列",
  "review.title": "补齐重要缺口。",
  "review.description": "核心发现优先显示。打开卡片，将结论与最新提取的来源片段对照。",
  "review.filterAria": "筛选复查问题",
  "review.all": "全部问题",
  "review.missing": "缺失",
  "review.partial": "部分覆盖",
  "review.contradictions": "矛盾",
  "review.missingExplanation": "缺少解释",
  "review.partiallyCovered": "仅部分覆盖",
  "review.possibleContradiction": "可能存在矛盾",
  "review.core": "核心",
  "review.supporting": "辅助",
  "review.none": "此类别中没有发现。",
  "review.inspectEvidence": "查看证据",

  "workspace.aria": "学习资料包工作区",
  "workspace.chooseViewAria": "选择学习资料包视图",
  "workspace.notesTab": "增强笔记",
  "workspace.auditTab": "审查记录",
  "workspace.changesTab": "仅看改动",
  "workspace.ankiTab": "Anki 卡片 · {count}",
  "workspace.audioTab": "音频指南",

  "notes.eyebrow": "完整学习指南",
  "notes.title": "增强笔记",
  "notes.description":
    "保留准确内容、扩充薄弱解释、补充缺失概念，并按便于学习的顺序纠正矛盾。原始文件绝不会被覆盖。",
  "notes.copy": "复制完整笔记",
  "notes.export": "导出 Markdown",
  "notes.contents": "目录",
  "notes.contentsAria": "增强笔记目录",
  "notes.sectionCount": "{count} 个按逻辑排序的章节",
  "notes.learningObjective": "学习目标",
  "notes.inspectSources": "查看章节来源",
  "notes.viewMarkdown": "查看生成的 Markdown",
  "notes.preserved": "保留",
  "notes.expanded": "扩充",
  "notes.corrected": "纠正",
  "notes.new": "新增",

  "anki.notRequestedTitle": "未要求生成 Anki 卡片。",
  "anki.notRequestedDescription":
    "运行分析前开启“生成 Anki 卡片”，即可在学习资料包中加入有证据支持的 Basic 卡片。",
  "anki.eyebrow": "主动回忆卡组",
  "anki.readyCount": "{count} 张 Anki 就绪卡片",
  "anki.description":
    "使用 Basic 笔记类型将 UTF-8 文本文件导入 Anki。正面、背面、标签和可信来源定位均由应用确定性生成。",
  "anki.copy": "复制 Anki 文本",
  "anki.download": "下载 Anki .txt",
  "anki.basicCard": "Basic 卡片",
  "anki.front": "正面",
  "anki.reveal": "显示答案",
  "anki.inspectSource": "查看卡片来源",

  "audio.eyebrow": "随时随地收听",
  "audio.title": "音频学习指南",
  "audio.description":
    "把已验证的增强笔记转换为可选的语音复习材料。朗读文本由应用代码生成，绝不会静默截断。",
  "audio.chooseNarration": "选择朗读内容",
  "audio.requestLimit":
    "单次语音请求最多 {limit} 个字符。过长的完整指南会保持原样且不可提交，请改选较短章节。",
  "audio.narrationSection": "朗读章节",
  "audio.charactersShort": "{count} 个字符",
  "audio.tooLongShort": "内容过长",
  "audio.fullGuide": "完整学习指南",
  "audio.sectionLabel": "第 {number} 节 · {heading}",
  "audio.voice": "声音",
  "audio.format": "格式",
  "audio.characterCount": "{count} / {limit} 个字符",
  "audio.tooLong": "所选内容超出单次语音请求限制，请选择较短章节。",
  "audio.aiDisclosure": "AI 生成语音",
  "audio.disclosureDetail": "说明：此语音由人工智能生成，并非真人录音。",
  "audio.transmissionDisclosure":
    "所选朗读文本会发送到 OpenAI，并使用当前有效凭据：已输入时使用你的临时 OpenAI 密钥，否则使用部署密钥。LectureWeaver 不会持久化生成的音频或脚本。",
  "audio.unconfiguredSpeech":
    "请输入有效的临时 OpenAI 密钥或配置部署密钥以生成语音。增强笔记仍可复制和导出为 Markdown。",
  "audio.playback": "播放",
  "audio.emptyInstructions": "选择章节、声音和格式后，即可生成可下载的学习音频。",
  "audio.generatedMeta": "{voice} 声音 · {format} · AI 生成语音",
  "audio.unsupportedPlayback": "你的浏览器不支持音频播放。",
  "audio.generate": "生成音频指南",
  "audio.regenerate": "重新生成音频",
  "audio.generating": "正在生成音频…",
  "audio.unavailable": "OpenAI 音频不可用",
  "audio.retry": "重试生成音频",
  "audio.failedTitle": "音频生成未完成。",
  "audio.failedFallback": "无法生成音频学习指南。",
  "audio.placeholder": "复习音频将在这里显示。",
  "audio.download": "下载",
  "audio.playerAria": "音频学习指南：{label}",

  "changes.emptyTitle": "无需改动。",
  "changes.emptyDescription": "审查未发现部分覆盖、缺失或矛盾概念，因此没有仅含改动的文件可导出。",
  "changes.eyebrow": "可合并内容",
  "changes.title": "建议补充",
  "changes.description": "根据可操作的发现确定性生成，并包含证据定位。",
  "changes.copy": "复制 Markdown",
  "changes.fileName": "lectureweaver-additions.md",

  "export.copied": "已复制",
  "export.copyFailed": "复制失败",
  "export.copiedAnnouncement": "已将{label}复制到剪贴板。",
  "export.clipboardUnavailable": "无法访问剪贴板。",

  "evidence.closeAria": "关闭证据面板",
  "evidence.auditEyebrow": "审查证据",
  "evidence.notesEyebrow": "增强笔记来源",
  "evidence.ankiEyebrow": "Anki 卡片来源",
  "evidence.whyItMatters": "为什么重要：",
  "evidence.more": "另有 {count} 条",
  "evidence.trust":
    "名称、定位、标题路径和摘录均来自已解析文件或已验证转写，而不是后续分析模型。",

  "how.aria": "演示工作原理",
  "how.extractTitle": "提取",
  "how.extractText": "PDF 页面和编号段落",
  "how.analyzeTitle": "分析",
  "how.analyzeText": "无密钥演示或明确提供密钥的实时模型",
  "how.buildTitle": "生成",
  "how.buildText": "增强笔记、可信证据和学习卡片",
} as const satisfies UiMessageCatalog;

const JAPANESE_UI_MESSAGES = {
  "language.label": "言語",
  "language.switchAria": "表示言語を選択",

  "app.homeAria": "LectureWeaver ホーム",
  "app.localDemoBadge": "ローカルデモ · ライブ AI は任意",
  "app.tryDemo": "デモを試す",
  "app.reset": "リセット",
  "app.footerTagline": "根拠に基づく学習パック",
  "app.footerPrivacy":
    "デモは内蔵サンプルのみを使用し、API キーは不要です。任意のライブ AI は、デプロイキーまたは現在のタブの一時キーを使って、録音の文字起こし、ノートの再構成、Anki カードの作成、AI 音声学習ガイドの生成ができます。",

  "hero.eyebrow": "根拠に基づく学習パック",
  "hero.headlinePrefix": "講義を、本当に",
  "hero.headlineAccent": "学べるノートへ。",
  "hero.description":
    "LectureWeaver は不足内容を監査し、ノートを分かりやすい学習ガイドに再構成して、任意で Anki カードを作成します。すべての結果を根拠となる出典まで追跡できます。",
  "hero.sampleEyebrow": "審査ですぐに試せるサンプル",
  "hero.sampleTitle": "ワンクリックで完全な学習パックを作成。",
  "hero.featureParsing": "PDF、TXT、Markdown を実際にローカル解析",
  "hero.featureNotes": "信頼できる根拠に基づくノート再構成",
  "hero.featureAnki": "API キー不要の Anki カード",
  "hero.demoLoading": "資料を統合しています…",
  "hero.sampleCta": "サンプル講義を試す",
  "hero.sampleMeta": "API キー不要 · モデル呼び出しなし · 約 3 秒",

  "upload.eyebrow": "教材",
  "upload.title": "信頼できるソースマップを作成。",
  "upload.description":
    "講義 PDF または TXT をアップロードするか講義テキストを貼り付け、Markdown ノートと、TXT 文字起こし、貼り付けた文字起こし、または講義録音を追加してください。テキストはこのタブ内で解析され、音声は明示的に文字起こしを実行した場合にのみ送信されます。",
  "upload.privacy":
    "PDF、TXT、Markdown、貼り付けテキストはローカルに保持 · 音声は明示的な文字起こし時のみ OpenAI へ送信 · 正規化済みチャンクはライブ分析を明示的に開始した後のみ送信 · 無断の切り捨てなし",
  "upload.buildLocal": "ローカルソースマップを作成",
  "upload.analyzeWith": "抽出して {provider} で分析",

  "source.slidesEyebrow": "01 / 講義資料",
  "source.slidesTitle": "講義資料",
  "source.slidesDetail": "PDF、TXT、または貼り付けテキスト",
  "source.slidesLimit": "PDF 10 MiB · テキスト 1 MiB",
  "source.transcriptEyebrow": "02 / 講義内容",
  "source.transcriptTitle": "文字起こし",
  "source.transcriptDetail": "UTF-8 プレーンテキスト",
  "source.transcriptLimit": "最大 1 MiB",
  "source.notesEyebrow": "03 / 元のノート",
  "source.notesTitle": "既存ノート",
  "source.notesShortName": "ノート",
  "source.notesDetail": "Markdown",
  "source.notesLimit": "最大 1 MiB",
  "source.readyLocally": "ローカルで準備完了",
  "source.replaceFile": "ファイルを差し替える",
  "source.chooseOrDropFile": "ファイルを選択またはドロップ",
  "source.chooseFileAria": "{source}ファイルを選択",

  "lecture.title": "講義資料",
  "lecture.modeAria": "講義資料の種類を選択",
  "lecture.pdfMode": "PDF",
  "lecture.textMode": "TXT ファイル",
  "lecture.pasteMode": "講義テキスト",
  "lecture.choosePdf": "PDF を選択またはドロップ",
  "lecture.chooseText": "TXT ファイルを選択またはドロップ",
  "lecture.choosePdfAria": "講義 PDF ファイルを選択",
  "lecture.chooseTextAria": "講義 TXT ファイルを選択",
  "lecture.pdfDetail": "テキストベース PDF · 最大 10 MiB",
  "lecture.textDetail": "UTF-8 プレーンテキスト · 最大 1 MiB",
  "lecture.pasteLabel": "講義テキストを貼り付け",
  "lecture.pastePlaceholder": "講義資料、アウトライン、またはスライドのテキストをここに貼り付けてください…",
  "lecture.pasteDescription":
    "貼り付け後、少し待つと自動で検証されます。「講義テキストを今すぐ検証」を選ぶと、すぐに開始できます。検証後は TXT アップロードと同じローカルのチャンク化・根拠パイプラインに入ります。",
  "lecture.pasteUse": "講義テキストを今すぐ検証",
  "lecture.pasteReplace": "更新した講義テキストを今すぐ検証",
  "lecture.pasteClear": "テキストを消去",
  "lecture.pasteEmptyError": "続行する前に講義テキストを貼り付けてください。",
  "lecture.pasteReadySuffix": "講義テキストの準備完了",
  "lecture.pasteCharacters": "{count} 文字",
  "lecture.pasteLoading": "講義テキストを検証しています…",
  "lecture.pasteReadyAnnouncement": "貼り付けた講義テキストの準備ができました。",
  "lecture.pasteErrorTitle": "講義テキストはまだ準備できていません。",

  "spoken.title": "文字起こしファイル、貼り付けテキスト、または音声",
  "spoken.modeAria": "講義音声の入力方法を選択",
  "spoken.transcriptMode": "TXT 文字起こし",
  "spoken.pasteMode": "テキストを貼り付け",
  "spoken.pasteLabel": "文字起こしテキストを貼り付け",
  "spoken.pastePlaceholder": "講義の文字起こしをここに貼り付けるか入力してください…",
  "spoken.pasteDescription":
    "貼り付け後、少し待つと自動で検証されます。「文字起こしを今すぐ検証」を選ぶと、すぐに開始でき、TXT アップロードと同じローカル処理を使用します。",
  "spoken.pasteUse": "文字起こしを今すぐ検証",
  "spoken.pasteReplace": "更新した文字起こしを今すぐ検証",
  "spoken.pasteClear": "貼り付けたテキストを消去",
  "spoken.pasteEmptyError": "続行する前に文字起こしテキストを貼り付けてください。",
  "spoken.pasteReadySuffix": "貼り付けテキストの準備完了",
  "spoken.pasteCharacters": "{count} 文字",
  "spoken.pasteLoading": "貼り付けた文字起こしを検証しています…",
  "spoken.pasteReadyAnnouncement": "貼り付けた文字起こしの準備ができました。",
  "spoken.pasteErrorTitle": "貼り付けた文字起こしはまだ準備できていません。",
  "spoken.audioMode": "講義音声",
  "spoken.chooseTranscript": "文字起こしを選択またはドロップ",
  "spoken.chooseTranscriptAria": "文字起こしファイルを選択",
  "spoken.chooseAudio": "講義音声を選択またはドロップ",
  "spoken.chooseAudioAria": "講義音声ファイルを選択",
  "spoken.audioFormats":
    "FLAC、MP3、MP4、MPEG、MPGA、M4A、OGG、WAV、WebM · 最大 {megabytes} MB",
  "spoken.replaceAudio": "音声を差し替える",
  "spoken.transcriptReadySuffix": "文字起こしの準備完了",
  "spoken.signatureCheckingSuffix": "ファイル署名を確認中",
  "spoken.awaitingTranscriptionSuffix": "文字起こし待ち",
  "spoken.cloudTitle": "明示的なクラウド文字起こし",
  "spoken.cloudDisclosure":
    "文字起こしを実行すると、元の音声は LectureWeaver サーバーを経由して OpenAI に送信され、現在有効な認証情報（入力済みなら一時 OpenAI キー、それ以外はデプロイキー）を使用します。LectureWeaver は録音や文字起こしを保存・記録しません。",
  "spoken.unconfigured":
    "OpenAI 音声はまだ利用できません。下で有効な一時 OpenAI キーを入力するかデプロイキーを設定し、または TXT 文字起こし／デモを利用してください。",
  "spoken.errorTitle": "文字起こしを完了できませんでした。",
  "spoken.timestampReady": "タイムスタンプ付き文字起こしの準備完了",
  "spoken.segmentCountOne": "{count} セグメント",
  "spoken.segmentCountOther": "{count} セグメント",
  "spoken.previewTranscript": "文字起こしをプレビュー",
  "spoken.copyTranscript": "文字起こしをコピー",
  "spoken.downloadTranscript": ".txt をダウンロード",
  "spoken.transcribing": "OpenAI で文字起こし中…",
  "spoken.checkingAudio": "音声を確認中…",
  "spoken.audioUnavailable": "OpenAI 音声は利用できません",
  "spoken.transcribeAgain": "もう一度文字起こし",
  "spoken.replaceInvalid": "無効な音声を差し替える",
  "spoken.checkConfiguration": "OpenAI の設定を確認",
  "spoken.retry": "文字起こしを再試行",
  "spoken.send": "OpenAI に送信して文字起こし",
  "spoken.progressTranscribing": "音声を文字起こししています。",
  "spoken.progressValidating": "音声を検証しています。",
  "spoken.progressReady": "タイムスタンプ付き文字起こしの準備ができました。",
  "spoken.unsupportedFallback": "アップロード上限内の対応音声ファイルを選択してください。",
  "spoken.failedFallback": "音声の文字起こしを完了できませんでした。",

  "provider.legend": "任意のライブ分析",
  "provider.providerLabel": "AI プロバイダー",
  "provider.modelLabel": "AI モデル",
  "provider.noneConfigured": "プロバイダー未設定",
  "provider.noModel": "利用可能なモデルなし",
  "provider.notConfiguredSuffix": "デプロイキー未設定",
  "provider.noSettings": "このデプロイにはライブプロバイダー設定がありません。",
  "provider.serverKeyConfigured": "サーバーキー設定済み",
  "provider.localOnly": "ローカルソースマップのみ",
  "provider.temporaryActive": "一時キーを使用中",
  "provider.temporaryTitle": "このタブで一時キーを使用",
  "provider.temporaryDescription":
    "OpenAI、DeepSeek、Kimi のキーを個別に入力できます。有効な一時キーはそのプロバイダーのデプロイキーより優先され、消去、リセット、ページを閉じる、または再読み込みすると消えます。",
  "provider.temporaryKeyLabel": "一時 {provider} API キー",
  "provider.temporaryKeyPlaceholder": "このタブ専用のキーを貼り付け",
  "provider.temporaryReady": "このタブで利用可能",
  "provider.temporaryInvalid": "8〜512 文字の有効な API キーを入力してください。",
  "provider.temporaryEmpty": "未入力",
  "provider.clearKey": "{provider} キーを消去",
  "provider.clearAll": "すべての一時キーを消去",
  "provider.kimiRegionLabel": "Kimi API リージョン",
  "provider.kimiRegionPlaceholder": "Kimi API リージョンを選択",
  "provider.kimiRegionCn": "中国 · api.moonshot.cn",
  "provider.kimiRegionGlobal": "グローバル · api.moonshot.ai",
  "provider.temporaryTrust":
    "LectureWeaver はこれらのキーをこのページのメモリにのみ保持し、ブラウザストレージ、Cookie、URL、ログ、データベースには保存しません。",
  "provider.temporaryVisibility":
    "ライブリクエスト時、選択したキーはこのサイトの HTTPS Vercel Function を通り、選択したプロバイダーだけに転送されます。ブラウザ、開発者ツール、拡張機能、プロバイダーからは見える可能性があるため、信頼できる端末を使用してください。",
  "provider.keyGuidanceTitle": "API キーはどこに設定しますか？",
  "provider.keyGuidance":
    "継続利用には Vercel のプロジェクト設定 → 環境変数、または .env.local への設定を推奨します。上のマスク入力欄で、このタブだけ一時的に使用することもできます。",
  "provider.keyNames":
    "対応するサーバー変数：OPENAI_API_KEY、DEEPSEEK_API_KEY、KIMI_API_KEY。",
  "provider.reloadAfterConfig":
    "Vercel の環境変数を変更した後は再デプロイし、このページを再読み込みしてください。",

  "analysis.chooseProvider": "AI プロバイダーとモデルを選択してください。",
  "analysis.invalidKey":
    "一時 {provider} キーが無効です。分析前に修正するか消去してください。",
  "analysis.kimiRegion": "分析前に Kimi API リージョンを選択してください。",
  "analysis.enterKey":
    "上で有効な一時 {provider} キーを入力するか、デプロイキーを設定してください。",
  "analysis.sourcesReady":
    "講義資料、文字起こし、ノートの準備ができました。",
  "analysis.missingLecture":
    "講義 PDF/TXT を追加するか、講義テキストを貼り付けてください。",
  "analysis.preparingLecturePaste":
    "貼り付けた講義テキストの検証を待つか、今すぐ検証してください。",
  "analysis.fixLecturePaste":
    "貼り付けた講義テキストを修正して、再度検証してください。",
  "analysis.missingTranscript":
    "文字起こし TXT を追加するか、テキストを貼り付けるか、講義音声を使用してください。",
  "analysis.preparingTranscriptPaste":
    "貼り付けた文字起こしの検証を待つか、今すぐ検証してください。",
  "analysis.fixTranscriptPaste":
    "貼り付けた文字起こしを修正して、再度検証してください。",
  "analysis.missingAudio": "講義音声ファイルを追加してください。",
  "analysis.transcribeAudio":
    "選択した講義音声を文字起こししてください。",
  "analysis.missingNotes":
    "既存ノートを .md または .markdown ファイルとしてアップロードしてください。",
  "analysis.busy":
    "現在の処理が完了してから分析を開始してください。",
  "analysis.ready":
    "{provider} の準備ができました。分析を開始すると正規化済みソーステキストが送信されます。",

  "outputs.legend": "学習パックの出力",
  "outputs.languageLabel": "出力言語",
  "outputs.followInterface": "表示言語に合わせる（{language}）",
  "outputs.languageDescription":
    "次回のライブ分析で生成する言語を選択します。既存の結果は自動翻訳されません。",
  "outputs.demoLanguageNote":
    "内蔵の決定的デモは固定の英語サンプルです。",
  "outputs.alwaysIncluded": "常に含む",
  "outputs.optional": "任意",
  "outputs.notesTitle": "拡張ノート",
  "outputs.notesDescription": "完全で論理的に整理された Markdown 学習ガイドを毎回再構成します。",
  "outputs.ankiTitle": "Anki カードを作成",
  "outputs.ankiDescription": "すべての重要な評価項目を網羅した、根拠付き Basic カードを追加します。",
  "outputs.retention":
    "出力オプションは次の分析に適用されます。既存の学習パックは、再実行または資料の差し替えまで保持されます。",

  "pipeline.live": "ライブモデル分析",
  "pipeline.demo": "キー不要デモ",
  "pipeline.local": "ローカル処理",
  "pipeline.validateFiles": "ファイルを検証",
  "pipeline.auditConcepts": "概念を監査",
  "pipeline.rebuildNotes": "ノートを再構成",
  "pipeline.createStudyTools": "学習ツールを作成",
  "pipeline.extractNormalize": "抽出して正規化",
  "pipeline.verifyFixture": "デモデータを検証",
  "pipeline.buildStudyPack": "学習パックを作成",
  "pipeline.buildSourceMap": "ソースマップを作成",
  "pipeline.hydrateEvidence": "根拠を関連付け",
  "pipeline.checkingSafety": "ファイルの安全性を確認中…",
  "pipeline.analyzing": "{provider} · {model} で正規化済みチャンクを分析中…",
  "pipeline.liveWaitHint":
    "大きなソースマップでは約 3 分かかる場合があります。選択したプロバイダーが完了するまで、このタブを開いたままにしてください。",
  "pipeline.validatingAudioSources": "講義資料、ノート、タイムスタンプ付き文字起こしを検証中…",
  "pipeline.validatingTextSources": "3 つのローカル資料を検証中…",
  "pipeline.extractingAudioSources": "講義構造を抽出し、検証済み文字起こしのタイムスタンプを関連付け中…",
  "pipeline.extractingTextSources": "講義と段落構造を抽出中…",
  "pipeline.finalizingSourceMap": "ローカルソースマップを仕上げています…",
  "pipeline.loadingDemo": "内蔵サンプルファイルを読み込み中…",
  "pipeline.verifyingDemo": "サンプルのフィンガープリントを検証し、根拠を関連付け中…",

  "sourceMap.eyebrow": "抽出直後",
  "sourceMap.title": "信頼できるソースマップ",
  "sourceMap.description":
    "以下のすべての位置情報は、後続の分析モデルではなく、解析したファイルまたは検証済みのタイムスタンプ付き文字起こしから再構築されています。",
  "sourceMap.sampleVerified": "サンプルのフィンガープリントを検証済み",
  "sourceMap.localReady": "ローカルソースマップの準備完了",
  "sourceMap.chunkCountOne": "{count} チャンク",
  "sourceMap.chunkCountOther": "{count} チャンク",
  "sourceMap.total": "正規化済み {characters} 文字 · 合計 {chunks} チャンク",

  "error.processingFallback": "これらのファイルを処理できませんでした。もう一度お試しください。",
  "error.liveFallback": "選択したモデルから使用可能な分析結果が返されませんでした。",
  "error.demoFallback": "内蔵デモを読み込めませんでした。再試行してください。",
  "error.liveTitle": "ライブ分析を完了できませんでした。",
  "error.demoTitle": "内蔵デモを読み込めませんでした。",
  "error.processingTitle": "これらの資料を処理できませんでした。",
  "error.retry": "ライブ分析を再試行",
  "error.retryDemo": "デモを再試行",
  "error.tryDemo": "内蔵デモを使用",
  "error.useLectureText": "代わりに講義テキストを使用",
  "error.replaceAndRetry": "該当ファイルを差し替えて再試行するか、内蔵デモを読み込んでください。",
  "error.demoRecovery": "同じ内蔵サンプルで再試行してください。ライブモデルへのリクエストは行われません。",
  "error.liveRetryRecovery":
    "ローカルソースマップは保持されています。再試行するか、別の利用可能なモデルまたは内蔵デモを選択してください。",
  "error.liveTimeoutRecovery":
    "ローカルソースマップは保持されています。まず一度再試行し、再度タイムアウトする場合は DeepSeek V4 Flash を選ぶか、任意の Anki カードをオフにするか、有効な認証情報がある別のプロバイダーを選んでください。",
  "error.liveConfigRecovery":
    "ローカルソースマップは保持されています。一時キーまたはデプロイキーを確認し、別のモデルまたは内蔵デモを選択してください。",

  "empty.title": "ローカルソースマップの準備ができました。",
  "empty.unconfigured": "選択したプロバイダーにデプロイキーも有効な一時キーもないため、正規化済みチャンクは送信されていません。",
  "empty.notSent": "まだ {provider} には何も送信されていません。準備ができたら正規化済みチャンクのライブ分析を開始してください。",
  "empty.analyzeCurrent": "現在のソースマップを {provider} で分析",

  "score.coverage": "カバレッジスコア",
  "score.strong": "十分に網羅",
  "score.gaps": "重要な不足を検出",
  "score.needsPass": "丁寧な見直しが必要",
  "score.demoOrigin": "シミュレーション分析 · 実際の根拠",
  "score.liveOrigin": "ライブ分析 · {provider} · {model}",
  "score.covered": "網羅済み",
  "score.partial": "一部網羅",
  "score.missing": "不足",
  "score.contradictions": "矛盾",
  "score.conceptsAudited": "{count} 件の概念を監査",
  "score.explanation": "スコアはアプリ内で計算：網羅済み + 一部網羅の半分。",

  "review.eyebrow": "レビュー項目",
  "review.title": "重要な不足を補いましょう。",
  "review.description": "重要な指摘を優先表示します。カードを開き、主張と新しく抽出した出典を比較できます。",
  "review.filterAria": "レビュー項目を絞り込む",
  "review.all": "すべて",
  "review.missing": "不足",
  "review.partial": "一部網羅",
  "review.contradictions": "矛盾",
  "review.missingExplanation": "説明が不足",
  "review.partiallyCovered": "一部のみ網羅",
  "review.possibleContradiction": "矛盾の可能性",
  "review.core": "重要",
  "review.supporting": "補足",
  "review.none": "このカテゴリには指摘がありません。",
  "review.inspectEvidence": "根拠を確認",

  "workspace.aria": "学習パックのワークスペース",
  "workspace.chooseViewAria": "学習パックの表示を選択",
  "workspace.notesTab": "拡張ノート",
  "workspace.auditTab": "監査記録",
  "workspace.changesTab": "変更点のみ",
  "workspace.ankiTab": "Anki カード · {count}",
  "workspace.audioTab": "音声ガイド",

  "notes.eyebrow": "完全な学習ガイド",
  "notes.title": "拡張ノート",
  "notes.description":
    "正確な内容を残し、説明が薄い部分を拡充し、不足情報を追加し、矛盾を学びやすい順序で修正します。元のファイルは上書きしません。",
  "notes.copy": "ノート全文をコピー",
  "notes.export": "Markdown を書き出す",
  "notes.contents": "目次",
  "notes.contentsAria": "拡張ノートの目次",
  "notes.sectionCount": "論理的に整理された {count} セクション",
  "notes.learningObjective": "学習目標",
  "notes.inspectSources": "セクションの出典を確認",
  "notes.viewMarkdown": "生成された Markdown を表示",
  "notes.preserved": "保持",
  "notes.expanded": "拡充",
  "notes.corrected": "修正",
  "notes.new": "新規",

  "anki.notRequestedTitle": "Anki カードは選択されていません。",
  "anki.notRequestedDescription":
    "分析を実行する前に「Anki カードを作成」をオンにすると、根拠付き Basic カードを学習パックに追加できます。",
  "anki.eyebrow": "アクティブリコール用デッキ",
  "anki.readyCount": "Anki 対応カード {count} 枚",
  "anki.description":
    "UTF-8 テキストファイルを Basic ノートタイプで Anki に取り込めます。表面、裏面、タグ、信頼できる出典位置は決定論的に生成されます。",
  "anki.copy": "Anki テキストをコピー",
  "anki.download": "Anki .txt をダウンロード",
  "anki.basicCard": "Basic カード",
  "anki.front": "表面",
  "anki.reveal": "答えを表示",
  "anki.inspectSource": "カードの出典を確認",

  "audio.eyebrow": "どこでも聴ける",
  "audio.title": "音声学習ガイド",
  "audio.description":
    "検証済みの拡張ノートを、任意の音声復習教材に変換します。読み上げ原稿はアプリ内で作成され、無断で切り捨てられることはありません。",
  "audio.chooseNarration": "読み上げる内容を選択",
  "audio.requestLimit":
    "音声リクエストの上限は {limit} 文字です。上限を超える完全版ガイドはそのまま保持され送信できません。代わりにセクションを選択してください。",
  "audio.narrationSection": "読み上げセクション",
  "audio.charactersShort": "{count} 文字",
  "audio.tooLongShort": "長すぎます",
  "audio.fullGuide": "学習ガイド全文",
  "audio.sectionLabel": "セクション {number} · {heading}",
  "audio.voice": "音声",
  "audio.format": "形式",
  "audio.characterCount": "{count} / {limit} 文字",
  "audio.tooLong": "この内容は 1 回の音声リクエストには長すぎます。短いセクションを選択してください。",
  "audio.aiDisclosure": "AI 生成音声",
  "audio.disclosureDetail": "この音声は人工知能によって生成されたもので、人間の録音ではありません。",
  "audio.transmissionDisclosure":
    "選択した読み上げテキストは、現在有効な認証情報（入力済みなら一時 OpenAI キー、それ以外はデプロイキー）を使用して OpenAI に送信されます。LectureWeaver は生成音声や原稿を保存しません。",
  "audio.unconfiguredSpeech":
    "音声を生成するには、有効な一時 OpenAI キーを入力するかデプロイキーを設定してください。拡張ノートは引き続きコピーや Markdown 書き出しができます。",
  "audio.playback": "再生",
  "audio.emptyInstructions": "セクション、音声、形式を選択して、ダウンロード可能な学習ガイドを生成してください。",
  "audio.generatedMeta": "{voice} 音声 · {format} · AI 生成音声",
  "audio.unsupportedPlayback": "お使いのブラウザは音声再生に対応していません。",
  "audio.generate": "音声ガイドを生成",
  "audio.regenerate": "音声を再生成",
  "audio.generating": "音声を生成中…",
  "audio.unavailable": "OpenAI 音声は利用できません",
  "audio.retry": "音声生成を再試行",
  "audio.failedTitle": "音声生成を完了できませんでした。",
  "audio.failedFallback": "音声学習ガイドを生成できませんでした。",
  "audio.placeholder": "復習用音声はここに表示されます。",
  "audio.download": "ダウンロード",
  "audio.playerAria": "音声学習ガイド：{label}",

  "changes.emptyTitle": "変更は必要ありません。",
  "changes.emptyDescription": "監査で一部網羅、不足、矛盾のある概念が見つからなかったため、変更点のみのファイルはありません。",
  "changes.eyebrow": "統合の準備完了",
  "changes.title": "追加候補",
  "changes.description": "対応が必要な指摘から決定論的に生成され、根拠の位置情報も含まれます。",
  "changes.copy": "Markdown をコピー",
  "changes.fileName": "lectureweaver-additions.md",

  "export.copied": "コピーしました",
  "export.copyFailed": "コピーに失敗しました",
  "export.copiedAnnouncement": "{label}をクリップボードにコピーしました。",
  "export.clipboardUnavailable": "クリップボードにアクセスできませんでした。",

  "evidence.closeAria": "根拠パネルを閉じる",
  "evidence.auditEyebrow": "監査の根拠",
  "evidence.notesEyebrow": "拡張ノートの出典",
  "evidence.ankiEyebrow": "Anki カードの出典",
  "evidence.whyItMatters": "重要な理由：",
  "evidence.more": "ほか {count} 件",
  "evidence.trust":
    "名前、位置、見出し、抜粋は、後続の分析モデルではなく、解析したファイルまたは検証済み文字起こしから取得しています。",

  "how.aria": "デモの仕組み",
  "how.extractTitle": "抽出",
  "how.extractText": "PDF ページと番号付き段落",
  "how.analyzeTitle": "分析",
  "how.analyzeText": "キー不要デモまたは明示的にキーを指定したライブモデル",
  "how.buildTitle": "作成",
  "how.buildText": "拡張ノート、信頼できる根拠、学習カード",
} as const satisfies UiMessageCatalog;

const KOREAN_UI_MESSAGES = {
  "language.label": "언어",
  "language.switchAria": "인터페이스 언어 선택",

  "app.homeAria": "LectureWeaver 홈",
  "app.localDemoBadge": "로컬 데모 · 선택형 라이브 AI",
  "app.tryDemo": "데모 체험",
  "app.reset": "초기화",
  "app.footerTagline": "근거 기반 학습 자료",
  "app.footerPrivacy":
    "데모는 내장 샘플만 사용하며 API 키가 필요하지 않습니다. 선택형 라이브 AI는 배포 키 또는 현재 탭의 임시 키로 녹음 전사, 노트 재구성, Anki 카드 제작과 AI 음성 학습 오디오 생성을 할 수 있습니다.",

  "hero.eyebrow": "근거 기반 학습 자료",
  "hero.headlinePrefix": "강의를 실제로",
  "hero.headlineAccent": "공부할 수 있는 노트로.",
  "hero.description":
    "LectureWeaver는 빠진 내용을 점검하고, 노트를 더 명확한 학습 가이드로 재구성하며, 선택적으로 Anki 카드를 만듭니다. 모든 결과는 이를 뒷받침하는 원본 근거로 추적할 수 있습니다.",
  "hero.sampleEyebrow": "심사용 즉시 실행 샘플",
  "hero.sampleTitle": "한 번의 클릭으로 완전한 학습 자료를 만드세요.",
  "hero.featureParsing": "PDF, TXT, Markdown을 실제로 로컬 분석",
  "hero.featureNotes": "신뢰할 수 있는 근거로 노트 재구성",
  "hero.featureAnki": "API 키 없이 만드는 Anki 카드",
  "hero.demoLoading": "자료를 엮는 중…",
  "hero.sampleCta": "샘플 강의 체험",
  "hero.sampleMeta": "API 키 불필요 · 모델 요청 없음 · 약 3초",

  "upload.eyebrow": "학습 자료",
  "upload.title": "신뢰할 수 있는 소스 맵을 만드세요.",
  "upload.description":
    "강의 PDF 또는 TXT를 업로드하거나 강의 텍스트를 붙여넣은 다음, Markdown 노트와 TXT 전사문, 붙여넣은 전사문 또는 강의 녹음을 추가하세요. 텍스트는 이 탭에서 분석되며, 오디오는 사용자가 명시적으로 전사를 요청할 때만 전송됩니다.",
  "upload.privacy":
    "PDF, TXT, Markdown과 붙여넣은 텍스트는 로컬에 유지 · 오디오는 명시적 전사 시에만 OpenAI로 전송 · 정규화된 청크는 라이브 분석을 명시적으로 시작한 뒤에만 전송 · 자동 잘라내기 없음",
  "upload.buildLocal": "로컬 소스 맵 만들기",
  "upload.analyzeWith": "추출 후 {provider}(으)로 분석",

  "source.slidesEyebrow": "01 / 강의 자료",
  "source.slidesTitle": "강의 자료",
  "source.slidesDetail": "PDF, TXT 또는 붙여넣은 텍스트",
  "source.slidesLimit": "PDF 10 MiB · 텍스트 1 MiB",
  "source.transcriptEyebrow": "02 / 강의 내용",
  "source.transcriptTitle": "전사문",
  "source.transcriptDetail": "UTF-8 일반 텍스트",
  "source.transcriptLimit": "최대 1 MiB",
  "source.notesEyebrow": "03 / 기존 학습 기반",
  "source.notesTitle": "기존 노트",
  "source.notesShortName": "노트",
  "source.notesDetail": "Markdown",
  "source.notesLimit": "최대 1 MiB",
  "source.readyLocally": "로컬 준비 완료",
  "source.replaceFile": "파일 바꾸기",
  "source.chooseOrDropFile": "파일 선택 또는 놓기",
  "source.chooseFileAria": "{source} 파일 선택",

  "lecture.title": "강의 자료",
  "lecture.modeAria": "강의 자료 유형 선택",
  "lecture.pdfMode": "PDF",
  "lecture.textMode": "TXT 파일",
  "lecture.pasteMode": "강의 텍스트",
  "lecture.choosePdf": "PDF 선택 또는 놓기",
  "lecture.chooseText": "TXT 파일 선택 또는 놓기",
  "lecture.choosePdfAria": "강의 PDF 파일 선택",
  "lecture.chooseTextAria": "강의 TXT 파일 선택",
  "lecture.pdfDetail": "텍스트 기반 PDF · 최대 10 MiB",
  "lecture.textDetail": "UTF-8 일반 텍스트 · 최대 1 MiB",
  "lecture.pasteLabel": "강의 텍스트 붙여넣기",
  "lecture.pastePlaceholder": "강의 자료, 개요 또는 슬라이드 텍스트를 여기에 붙여넣으세요…",
  "lecture.pasteDescription":
    "붙여넣은 뒤 잠시 기다리면 자동으로 검증됩니다. ‘강의 텍스트 지금 검증’을 선택하면 바로 시작되며, 검증 후 TXT 업로드와 동일한 로컬 청크 분할 및 근거 파이프라인을 거칩니다.",
  "lecture.pasteUse": "강의 텍스트 지금 검증",
  "lecture.pasteReplace": "업데이트한 강의 텍스트 지금 검증",
  "lecture.pasteClear": "텍스트 지우기",
  "lecture.pasteEmptyError": "계속하기 전에 강의 텍스트를 붙여넣으세요.",
  "lecture.pasteReadySuffix": "강의 텍스트 준비 완료",
  "lecture.pasteCharacters": "{count}자",
  "lecture.pasteLoading": "강의 텍스트 검증 중…",
  "lecture.pasteReadyAnnouncement": "붙여넣은 강의 텍스트가 준비되었습니다.",
  "lecture.pasteErrorTitle": "강의 텍스트가 아직 준비되지 않았습니다.",

  "spoken.title": "전사문 파일, 붙여넣은 텍스트 또는 오디오",
  "spoken.modeAria": "강의 음성 자료 유형 선택",
  "spoken.transcriptMode": "TXT 전사문",
  "spoken.pasteMode": "텍스트 붙여넣기",
  "spoken.pasteLabel": "전사문 텍스트 붙여넣기",
  "spoken.pastePlaceholder": "강의 전사문을 여기에 붙여넣거나 입력하세요…",
  "spoken.pasteDescription":
    "붙여넣은 뒤 잠시 기다리면 자동으로 검증됩니다. ‘전사문 지금 검증’을 선택하면 바로 시작되며, TXT 업로드와 동일한 로컬 파이프라인을 사용합니다.",
  "spoken.pasteUse": "전사문 지금 검증",
  "spoken.pasteReplace": "업데이트한 전사문 지금 검증",
  "spoken.pasteClear": "붙여넣은 텍스트 지우기",
  "spoken.pasteEmptyError": "계속하기 전에 전사문 텍스트를 붙여넣으세요.",
  "spoken.pasteReadySuffix": "붙여넣은 텍스트 준비 완료",
  "spoken.pasteCharacters": "{count}자",
  "spoken.pasteLoading": "붙여넣은 전사문 검증 중…",
  "spoken.pasteReadyAnnouncement": "붙여넣은 전사문이 준비되었습니다.",
  "spoken.pasteErrorTitle": "붙여넣은 전사문이 아직 준비되지 않았습니다.",
  "spoken.audioMode": "강의 오디오",
  "spoken.chooseTranscript": "전사문 선택 또는 놓기",
  "spoken.chooseTranscriptAria": "전사문 파일 선택",
  "spoken.chooseAudio": "강의 오디오 선택 또는 놓기",
  "spoken.chooseAudioAria": "강의 오디오 파일 선택",
  "spoken.audioFormats":
    "FLAC, MP3, MP4, MPEG, MPGA, M4A, OGG, WAV 또는 WebM · 최대 {megabytes} MB",
  "spoken.replaceAudio": "오디오 바꾸기",
  "spoken.transcriptReadySuffix": "전사문 준비 완료",
  "spoken.signatureCheckingSuffix": "파일 서명 확인 중",
  "spoken.awaitingTranscriptionSuffix": "전사 대기 중",
  "spoken.cloudTitle": "명시적 클라우드 전사",
  "spoken.cloudDisclosure":
    "전사를 누르면 원본 오디오는 LectureWeaver 서버를 거쳐 OpenAI로 전송되며 현재 활성 자격 증명(입력한 경우 임시 OpenAI 키, 아니면 배포 키)을 사용합니다. LectureWeaver는 녹음이나 전사문을 저장하거나 기록하지 않습니다.",
  "spoken.unconfigured":
    "OpenAI 오디오를 아직 사용할 수 없습니다. 아래에 유효한 임시 OpenAI 키를 입력하거나 배포 키를 설정하고, 또는 TXT 전사문이나 데모를 사용하세요.",
  "spoken.errorTitle": "전사가 완료되지 않았습니다.",
  "spoken.timestampReady": "타임스탬프 전사문 준비 완료",
  "spoken.segmentCountOne": "{count}개 구간",
  "spoken.segmentCountOther": "{count}개 구간",
  "spoken.previewTranscript": "전사문 미리보기",
  "spoken.copyTranscript": "전사문 복사",
  "spoken.downloadTranscript": ".txt 다운로드",
  "spoken.transcribing": "OpenAI로 전사 중…",
  "spoken.checkingAudio": "오디오 확인 중…",
  "spoken.audioUnavailable": "OpenAI 오디오를 사용할 수 없음",
  "spoken.transcribeAgain": "다시 전사",
  "spoken.replaceInvalid": "유효하지 않은 오디오 바꾸기",
  "spoken.checkConfiguration": "OpenAI 설정 확인",
  "spoken.retry": "전사 다시 시도",
  "spoken.send": "OpenAI로 전송하고 전사",
  "spoken.progressTranscribing": "오디오를 전사하고 있습니다.",
  "spoken.progressValidating": "오디오를 검증하고 있습니다.",
  "spoken.progressReady": "타임스탬프 전사문이 준비되었습니다.",
  "spoken.unsupportedFallback": "업로드 한도 이내의 지원되는 오디오 파일을 선택하세요.",
  "spoken.failedFallback": "오디오 전사를 완료할 수 없습니다.",

  "provider.legend": "선택형 라이브 분석",
  "provider.providerLabel": "AI 제공업체",
  "provider.modelLabel": "AI 모델",
  "provider.noneConfigured": "설정된 제공업체 없음",
  "provider.noModel": "사용 가능한 모델 없음",
  "provider.notConfiguredSuffix": "배포 키 미설정",
  "provider.noSettings": "이 배포에는 라이브 제공업체 설정이 없습니다.",
  "provider.serverKeyConfigured": "서버 키 설정됨",
  "provider.localOnly": "로컬 소스 맵만 만들기",
  "provider.temporaryActive": "임시 키 사용 중",
  "provider.temporaryTitle": "현재 탭에서 임시 키 사용",
  "provider.temporaryDescription":
    "OpenAI, DeepSeek, Kimi 키를 각각 입력할 수 있습니다. 유효한 임시 키는 해당 제공업체의 배포 키보다 우선하며, 지우기·초기화·페이지 닫기 또는 새로고침 시 사라집니다.",
  "provider.temporaryKeyLabel": "임시 {provider} API 키",
  "provider.temporaryKeyPlaceholder": "현재 탭에서만 사용할 키 붙여넣기",
  "provider.temporaryReady": "현재 탭에서 사용 가능",
  "provider.temporaryInvalid": "8~512자의 유효한 API 키를 입력하세요.",
  "provider.temporaryEmpty": "입력하지 않음",
  "provider.clearKey": "{provider} 키 지우기",
  "provider.clearAll": "모든 임시 키 지우기",
  "provider.kimiRegionLabel": "Kimi API 리전",
  "provider.kimiRegionPlaceholder": "Kimi API 리전 선택",
  "provider.kimiRegionCn": "중국 · api.moonshot.cn",
  "provider.kimiRegionGlobal": "글로벌 · api.moonshot.ai",
  "provider.temporaryTrust":
    "LectureWeaver는 이 키를 현재 페이지 메모리에만 보관하며 브라우저 저장소, 쿠키, URL, 로그 또는 데이터베이스에 저장하지 않습니다.",
  "provider.temporaryVisibility":
    "라이브 요청 시 선택한 키는 이 사이트의 HTTPS Vercel 함수를 거쳐 선택한 제공업체에만 전달됩니다. 브라우저, 개발자 도구, 확장 프로그램 및 제공업체에서는 볼 수 있으므로 신뢰할 수 있는 기기를 사용하세요.",
  "provider.keyGuidanceTitle": "API 키는 어디에 설정하나요?",
  "provider.keyGuidance":
    "계속 사용할 키는 Vercel 프로젝트 설정 → 환경 변수 또는 .env.local에 설정하는 것을 권장합니다. 위의 마스킹 입력란을 사용해 현재 탭에서만 임시로 사용할 수도 있습니다.",
  "provider.keyNames":
    "지원되는 서버 변수: OPENAI_API_KEY, DEEPSEEK_API_KEY, KIMI_API_KEY.",
  "provider.reloadAfterConfig":
    "Vercel 환경 변수를 변경한 뒤 다시 배포하고 이 페이지를 새로고침하세요.",

  "analysis.chooseProvider": "AI 제공업체와 모델을 선택하세요.",
  "analysis.invalidKey":
    "임시 {provider} 키가 올바르지 않습니다. 분석 전에 수정하거나 지우세요.",
  "analysis.kimiRegion": "분석 전에 Kimi API 리전을 선택하세요.",
  "analysis.enterKey":
    "위에 유효한 임시 {provider} 키를 입력하거나 배포 키를 설정하세요.",
  "analysis.sourcesReady": "강의 자료, 전사문, 노트가 준비되었습니다.",
  "analysis.missingLecture":
    "강의 PDF/TXT를 추가하거나 강의 텍스트를 붙여넣으세요.",
  "analysis.preparingLecturePaste":
    "붙여넣은 강의 텍스트의 검증을 기다리거나 지금 검증하세요.",
  "analysis.fixLecturePaste":
    "붙여넣은 강의 텍스트를 수정한 뒤 다시 검증하세요.",
  "analysis.missingTranscript":
    "전사문 TXT를 추가하거나 텍스트를 붙여넣거나 강의 오디오를 사용하세요.",
  "analysis.preparingTranscriptPaste":
    "붙여넣은 전사문의 검증을 기다리거나 지금 검증하세요.",
  "analysis.fixTranscriptPaste":
    "붙여넣은 전사문을 수정한 뒤 다시 검증하세요.",
  "analysis.missingAudio": "강의 오디오 파일을 추가하세요.",
  "analysis.transcribeAudio": "선택한 강의 오디오를 전사하세요.",
  "analysis.missingNotes":
    "기존 노트를 .md 또는 .markdown 파일로 업로드하세요.",
  "analysis.busy": "현재 처리가 끝난 뒤 분석을 시작하세요.",
  "analysis.ready":
    "{provider} 준비가 완료되었습니다. 분석을 시작하면 정규화된 소스 텍스트가 전송됩니다.",

  "outputs.legend": "학습 자료 출력",
  "outputs.languageLabel": "출력 언어",
  "outputs.followInterface": "인터페이스 언어 따르기({language})",
  "outputs.languageDescription":
    "다음 라이브 분석에서 생성할 언어를 선택합니다. 기존 결과는 자동 번역되지 않습니다.",
  "outputs.demoLanguageNote":
    "내장된 결정적 데모는 고정된 영어 샘플입니다.",
  "outputs.alwaysIncluded": "항상 포함",
  "outputs.optional": "선택 사항",
  "outputs.notesTitle": "보강 노트",
  "outputs.notesDescription": "완전하고 논리적으로 정리된 Markdown 학습 가이드를 항상 다시 만듭니다.",
  "outputs.ankiTitle": "Anki 카드 만들기",
  "outputs.ankiDescription": "모든 핵심 평가 항목을 다루는 근거 기반 Basic 카드를 추가합니다.",
  "outputs.retention":
    "출력 선택은 다음 분석에 적용됩니다. 기존 학습 자료는 다시 실행하거나 자료 파일을 바꿀 때까지 유지됩니다.",

  "pipeline.live": "라이브 모델 분석",
  "pipeline.demo": "키 없는 데모",
  "pipeline.local": "로컬 처리",
  "pipeline.validateFiles": "파일 검증",
  "pipeline.auditConcepts": "개념 점검",
  "pipeline.rebuildNotes": "노트 재구성",
  "pipeline.createStudyTools": "학습 도구 만들기",
  "pipeline.extractNormalize": "추출 및 정규화",
  "pipeline.verifyFixture": "데모 데이터 검증",
  "pipeline.buildStudyPack": "학습 자료 만들기",
  "pipeline.buildSourceMap": "소스 맵 만들기",
  "pipeline.hydrateEvidence": "근거 연결",
  "pipeline.checkingSafety": "파일 안전성 확인 중…",
  "pipeline.analyzing": "{provider} · {model}(으)로 정규화 청크 분석 중…",
  "pipeline.liveWaitHint":
    "큰 소스 맵은 약 3분까지 걸릴 수 있습니다. 선택한 제공업체가 완료할 때까지 이 탭을 열어 두세요.",
  "pipeline.validatingAudioSources": "강의 자료, 노트, 타임스탬프 전사문 검증 중…",
  "pipeline.validatingTextSources": "로컬 자료 3개 검증 중…",
  "pipeline.extractingAudioSources": "강의 구조를 추출하고 검증된 전사 타임스탬프 연결 중…",
  "pipeline.extractingTextSources": "강의와 단락 구조 추출 중…",
  "pipeline.finalizingSourceMap": "로컬 소스 맵 마무리 중…",
  "pipeline.loadingDemo": "내장 샘플 파일 불러오는 중…",
  "pipeline.verifyingDemo": "샘플 지문을 확인하고 근거 연결 중…",

  "sourceMap.eyebrow": "방금 추출됨",
  "sourceMap.title": "신뢰할 수 있는 소스 맵",
  "sourceMap.description":
    "아래 모든 위치 정보는 이후 분석 모델이 아니라 분석한 파일 또는 검증된 타임스탬프 전사문에서 다시 만들어졌습니다.",
  "sourceMap.sampleVerified": "샘플 지문 검증 완료",
  "sourceMap.localReady": "로컬 소스 맵 준비 완료",
  "sourceMap.chunkCountOne": "{count}개 청크",
  "sourceMap.chunkCountOther": "{count}개 청크",
  "sourceMap.total": "정규화된 문자 {characters}개 · 총 청크 {chunks}개",

  "error.processingFallback": "해당 파일을 처리할 수 없습니다. 다시 시도하세요.",
  "error.liveFallback": "선택한 모델이 사용할 수 있는 분석을 반환하지 않았습니다.",
  "error.demoFallback": "내장 데모를 불러오지 못했습니다. 다시 시도하세요.",
  "error.liveTitle": "라이브 분석이 완료되지 않았습니다.",
  "error.demoTitle": "내장 데모를 불러오지 못했습니다.",
  "error.processingTitle": "해당 자료를 처리할 수 없습니다.",
  "error.retry": "라이브 분석 다시 시도",
  "error.retryDemo": "데모 다시 시도",
  "error.tryDemo": "내장 데모 사용",
  "error.useLectureText": "대신 강의 텍스트 사용",
  "error.replaceAndRetry": "문제가 있는 파일을 바꾸고 다시 시도하거나 내장 데모를 불러오세요.",
  "error.demoRecovery": "동일한 내장 샘플로 다시 시도하세요. 라이브 모델 요청은 전송되지 않습니다.",
  "error.liveRetryRecovery":
    "로컬 소스 맵은 유지됩니다. 다시 시도하거나 다른 준비된 모델 또는 내장 데모를 선택하세요.",
  "error.liveTimeoutRecovery":
    "로컬 소스 맵은 유지됩니다. 먼저 한 번 다시 시도하고, 다시 시간 초과가 발생하면 DeepSeek V4 Flash를 선택하거나 선택 사항인 Anki 카드를 끄거나 유효한 인증 정보가 있는 다른 제공업체를 선택하세요.",
  "error.liveConfigRecovery":
    "로컬 소스 맵은 유지됩니다. 임시 키 또는 배포 키를 확인하고 다른 모델 또는 내장 데모를 선택하세요.",

  "empty.title": "로컬 소스 맵이 준비되었습니다.",
  "empty.unconfigured": "선택한 제공업체에 배포 키나 유효한 임시 키가 없어 정규화된 청크가 전송되지 않았습니다.",
  "empty.notSent": "아직 {provider}에 아무 내용도 보내지 않았습니다. 준비되면 정규화된 청크의 라이브 분석을 시작하세요.",
  "empty.analyzeCurrent": "현재 소스 맵을 {provider}(으)로 분석",

  "score.coverage": "포함률 점수",
  "score.strong": "충분히 포함됨",
  "score.gaps": "중요한 누락 발견",
  "score.needsPass": "세심한 검토 필요",
  "score.demoOrigin": "시뮬레이션 데모 분석 · 실제 근거",
  "score.liveOrigin": "라이브 분석 · {provider} · {model}",
  "score.covered": "포함됨",
  "score.partial": "일부 포함",
  "score.missing": "누락",
  "score.contradictions": "모순",
  "score.conceptsAudited": "개념 {count}개 점검",
  "score.explanation": "점수는 앱 코드로 계산: 포함됨 + 일부 포함의 절반.",

  "review.eyebrow": "검토 목록",
  "review.title": "중요한 누락을 보완하세요.",
  "review.description": "핵심 결과가 먼저 표시됩니다. 카드를 열어 주장과 새로 추출한 원본을 비교하세요.",
  "review.filterAria": "검토 항목 필터",
  "review.all": "전체 항목",
  "review.missing": "누락",
  "review.partial": "일부 포함",
  "review.contradictions": "모순",
  "review.missingExplanation": "설명 누락",
  "review.partiallyCovered": "일부만 포함",
  "review.possibleContradiction": "모순 가능성",
  "review.core": "핵심",
  "review.supporting": "보조",
  "review.none": "이 범주에는 결과가 없습니다.",
  "review.inspectEvidence": "근거 확인",

  "workspace.aria": "학습 자료 작업 공간",
  "workspace.chooseViewAria": "학습 자료 보기 선택",
  "workspace.notesTab": "보강 노트",
  "workspace.auditTab": "점검 기록",
  "workspace.changesTab": "변경 사항만",
  "workspace.ankiTab": "Anki 카드 · {count}",
  "workspace.audioTab": "오디오 가이드",

  "notes.eyebrow": "완전한 학습 가이드",
  "notes.title": "보강 노트",
  "notes.description":
    "정확한 내용은 유지하고, 부족한 설명은 확장하며, 빠진 개념을 추가하고, 모순은 학습하기 좋은 순서로 수정합니다. 원본 파일은 절대 덮어쓰지 않습니다.",
  "notes.copy": "전체 노트 복사",
  "notes.export": "Markdown 내보내기",
  "notes.contents": "목차",
  "notes.contentsAria": "보강 노트 목차",
  "notes.sectionCount": "논리적으로 정렬된 섹션 {count}개",
  "notes.learningObjective": "학습 목표",
  "notes.inspectSources": "섹션 출처 확인",
  "notes.viewMarkdown": "생성된 Markdown 보기",
  "notes.preserved": "유지",
  "notes.expanded": "확장",
  "notes.corrected": "수정",
  "notes.new": "신규",

  "anki.notRequestedTitle": "Anki 카드를 요청하지 않았습니다.",
  "anki.notRequestedDescription":
    "분석을 실행하기 전에 ‘Anki 카드 만들기’를 켜면 근거 기반 Basic 카드를 학습 자료에 추가할 수 있습니다.",
  "anki.eyebrow": "능동 회상 카드 덱",
  "anki.readyCount": "Anki 준비 카드 {count}개",
  "anki.description":
    "UTF-8 텍스트 파일을 Basic 노트 유형으로 Anki에 가져오세요. 앞면, 뒷면, 태그와 신뢰할 수 있는 출처 위치는 결정론적으로 생성됩니다.",
  "anki.copy": "Anki 텍스트 복사",
  "anki.download": "Anki .txt 다운로드",
  "anki.basicCard": "Basic 카드",
  "anki.front": "앞면",
  "anki.reveal": "정답 보기",
  "anki.inspectSource": "카드 출처 확인",

  "audio.eyebrow": "어디서나 듣기",
  "audio.title": "오디오 학습 가이드",
  "audio.description":
    "검증된 보강 노트를 선택형 음성 복습 자료로 바꿉니다. 내레이션은 앱 코드에서 생성되며 자동으로 잘리지 않습니다.",
  "audio.chooseNarration": "읽을 내용 선택",
  "audio.requestLimit":
    "음성 요청 한도는 {limit}자입니다. 한도를 넘는 전체 가이드는 그대로 유지되며 요청할 수 없으니 대신 섹션을 선택하세요.",
  "audio.narrationSection": "내레이션 섹션",
  "audio.charactersShort": "{count}자",
  "audio.tooLongShort": "너무 김",
  "audio.fullGuide": "전체 학습 가이드",
  "audio.sectionLabel": "섹션 {number} · {heading}",
  "audio.voice": "음성",
  "audio.format": "형식",
  "audio.characterCount": "{count} / {limit}자",
  "audio.tooLong": "선택한 내용은 한 번의 음성 요청에 너무 깁니다. 더 짧은 섹션을 선택하세요.",
  "audio.aiDisclosure": "AI 생성 음성",
  "audio.disclosureDetail": "안내: 이 음성은 인공지능이 생성했으며 사람의 녹음이 아닙니다.",
  "audio.transmissionDisclosure":
    "선택한 내레이션 텍스트는 현재 활성 자격 증명(입력한 경우 임시 OpenAI 키, 아니면 배포 키)을 사용해 OpenAI로 전송됩니다. LectureWeaver는 생성된 오디오나 원고를 저장하지 않습니다.",
  "audio.unconfiguredSpeech":
    "음성을 생성하려면 유효한 임시 OpenAI 키를 입력하거나 배포 키를 설정하세요. 보강 노트는 계속 복사하거나 Markdown으로 내보낼 수 있습니다.",
  "audio.playback": "재생",
  "audio.emptyInstructions": "섹션, 음성, 형식을 선택한 뒤 다운로드 가능한 학습 가이드를 생성하세요.",
  "audio.generatedMeta": "{voice} 음성 · {format} · AI 생성 음성",
  "audio.unsupportedPlayback": "브라우저가 오디오 재생을 지원하지 않습니다.",
  "audio.generate": "오디오 가이드 생성",
  "audio.regenerate": "오디오 다시 생성",
  "audio.generating": "오디오 생성 중…",
  "audio.unavailable": "OpenAI 오디오를 사용할 수 없음",
  "audio.retry": "오디오 생성 다시 시도",
  "audio.failedTitle": "오디오 생성이 완료되지 않았습니다.",
  "audio.failedFallback": "오디오 학습 가이드를 생성할 수 없습니다.",
  "audio.placeholder": "복습 오디오가 여기에 표시됩니다.",
  "audio.download": "다운로드",
  "audio.playerAria": "오디오 학습 가이드: {label}",

  "changes.emptyTitle": "변경할 내용이 없습니다.",
  "changes.emptyDescription": "점검에서 일부 포함, 누락 또는 모순된 개념을 찾지 못해 변경 사항 전용 파일이 없습니다.",
  "changes.eyebrow": "병합 준비 완료",
  "changes.title": "제안된 추가 내용",
  "changes.description": "조치 가능한 결과에서 결정론적으로 생성되며 근거 위치가 포함됩니다.",
  "changes.copy": "Markdown 복사",
  "changes.fileName": "lectureweaver-additions.md",

  "export.copied": "복사됨",
  "export.copyFailed": "복사 실패",
  "export.copiedAnnouncement": "{label}을(를) 클립보드에 복사했습니다.",
  "export.clipboardUnavailable": "클립보드에 접근할 수 없습니다.",

  "evidence.closeAria": "근거 패널 닫기",
  "evidence.auditEyebrow": "점검 근거",
  "evidence.notesEyebrow": "보강 노트 출처",
  "evidence.ankiEyebrow": "Anki 카드 출처",
  "evidence.whyItMatters": "중요한 이유:",
  "evidence.more": "외 {count}개",
  "evidence.trust":
    "이름, 위치, 제목 경로, 발췌문은 이후 분석 모델이 아니라 분석한 파일 또는 검증된 전사문에서 가져옵니다.",

  "how.aria": "데모 작동 방식",
  "how.extractTitle": "추출",
  "how.extractText": "PDF 페이지와 번호가 지정된 단락",
  "how.analyzeTitle": "분석",
  "how.analyzeText": "키 없는 데모 또는 명시적으로 키를 제공한 라이브 모델",
  "how.buildTitle": "제작",
  "how.buildText": "보강 노트, 신뢰할 수 있는 근거와 학습 카드",
} as const satisfies UiMessageCatalog;

export const UI_MESSAGE_CATALOGS: Readonly<
  Record<UiLocale, UiMessageCatalog>
> = {
  en: ENGLISH_UI_MESSAGES,
  "zh-CN": SIMPLIFIED_CHINESE_UI_MESSAGES,
  ja: JAPANESE_UI_MESSAGES,
  ko: KOREAN_UI_MESSAGES,
};

export function resolveUiLocale(locale: string | null | undefined): UiLocale {
  if (locale === null || locale === undefined) return DEFAULT_UI_LOCALE;

  const normalized = locale.trim().replaceAll("_", "-").toLowerCase();
  if (normalized === "zh" || normalized.startsWith("zh-")) return "zh-CN";
  if (normalized === "ja" || normalized.startsWith("ja-")) return "ja";
  if (normalized === "ko" || normalized.startsWith("ko-")) return "ko";
  if (normalized === "en" || normalized.startsWith("en-")) return "en";
  return DEFAULT_UI_LOCALE;
}

function interpolateUiMessage(
  template: string,
  values: UiMessageValues,
): string {
  return template.replace(/\{([A-Za-z][A-Za-z0-9_]*)\}/g, (placeholder, name: string) => {
    if (!Object.prototype.hasOwnProperty.call(values, name)) return placeholder;
    const value = values[name];
    return value === undefined ? placeholder : String(value);
  });
}

export function translateUi(
  locale: UiLocale | string | null | undefined,
  key: UiMessageKey,
  values: UiMessageValues = {},
): string {
  const resolvedLocale = resolveUiLocale(locale);
  const selected = UI_MESSAGE_CATALOGS[resolvedLocale];
  const template = selected[key] || UI_MESSAGE_CATALOGS[DEFAULT_UI_LOCALE][key];
  return interpolateUiMessage(template, values);
}

export type UiPluralMessageKeys = Readonly<{
  one?: UiMessageKey;
  other: UiMessageKey;
}>;

export function translateUiPlural(
  locale: UiLocale | string | null | undefined,
  count: number,
  keys: UiPluralMessageKeys,
  values: UiMessageValues = {},
): string {
  const resolvedLocale = resolveUiLocale(locale);
  const category = new Intl.PluralRules(resolvedLocale).select(count);
  const key = category === "one" && keys.one !== undefined ? keys.one : keys.other;
  return translateUi(resolvedLocale, key, { ...values, count });
}

export type UiTranslator = (
  key: UiMessageKey,
  values?: UiMessageValues,
) => string;

export function createUiTranslator(
  locale: UiLocale | string | null | undefined,
): UiTranslator {
  const resolvedLocale = resolveUiLocale(locale);
  return (key, values) => translateUi(resolvedLocale, key, values);
}
