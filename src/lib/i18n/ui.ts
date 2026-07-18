/**
 * Static application chrome only. User uploads, trusted excerpts, model output,
 * filenames, provider/model names, and generated study-pack content must be
 * rendered verbatim instead of being passed through this catalog.
 */

export const UI_LOCALES = ["en", "zh-CN"] as const;

export type UiLocale = (typeof UI_LOCALES)[number];

export const DEFAULT_UI_LOCALE: UiLocale = "en";

export const UI_LOCALE_OPTIONS = [
  { value: "en", label: "English", shortLabel: "EN" },
  { value: "zh-CN", label: "简体中文", shortLabel: "中文" },
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
    "Try demo remains fixture-only and needs no API key. Optional server-side AI can transcribe an uploaded recording, rebuild notes, create Anki cards, and generate a disclosed AI-voice study guide.",

  "hero.eyebrow": "Evidence-grounded study pack",
  "hero.headlinePrefix": "Turn lectures into notes you can",
  "hero.headlineAccent": "study.",
  "hero.description":
    "LectureWeaver audits what is missing, rebuilds your notes into a clearer learning guide, and creates optional Anki cards—each tied back to the source that supports it.",
  "hero.sampleEyebrow": "Judge-ready sample",
  "hero.sampleTitle": "Build a complete study pack in one click.",
  "hero.featureParsing": "Real local PDF and Markdown parsing",
  "hero.featureNotes": "Reorganized notes with trusted evidence",
  "hero.featureAnki": "Anki-ready cards with no API key needed",
  "hero.demoLoading": "Weaving the sources…",
  "hero.sampleCta": "Try the sample lecture",
  "hero.sampleMeta": "No API key · no model request · about 3 seconds",

  "upload.eyebrow": "Your materials",
  "upload.title": "Build a trusted source map.",
  "upload.description":
    "Choose PDF slides, Markdown notes, and either a transcript TXT file or a lecture recording. Text files are parsed in this tab; audio is sent only after you explicitly request transcription.",
  "upload.privacy":
    "PDF, TXT, and Markdown stay local · audio is sent to OpenAI only for explicit transcription · normalized chunks are sent only for configured live analysis · no silent truncation",
  "upload.buildLocal": "Build local source map",
  "upload.analyzeWith": "Extract and analyze with {provider}",

  "source.slidesEyebrow": "01 / Lecture source",
  "source.slidesTitle": "Slides",
  "source.slidesDetail": "Text-based PDF",
  "source.slidesLimit": "Up to 10 MiB",
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

  "spoken.title": "Transcript or audio",
  "spoken.modeAria": "Choose spoken source type",
  "spoken.transcriptMode": "Transcript TXT",
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
    "When you press transcribe, the raw audio bytes pass through the LectureWeaver server to OpenAI and use the deployment owner's separately billed API account. LectureWeaver neither stores nor logs the recording or transcript.",
  "spoken.unconfigured":
    "OpenAI audio is not configured on this deployment. You can still use a transcript TXT file or Try demo.",
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
  "provider.notConfiguredSuffix": "not configured",
  "provider.noSettings": "This deployment has no live provider settings.",
  "provider.serverKeyConfigured": "Server key configured",
  "provider.localOnly": "Local source map only",
  "provider.keyGuidanceTitle": "Where do API keys go?",
  "provider.keyGuidance":
    "Keys are configured by the deployment owner in Vercel Project Settings → Environment Variables, or in .env.local for local development. Never paste a key into this page.",
  "provider.keyNames":
    "Supported server variables: OPENAI_API_KEY, DEEPSEEK_API_KEY, and KIMI_API_KEY.",
  "provider.reloadAfterConfig":
    "Redeploy after changing Vercel environment variables, then reload this page.",

  "outputs.legend": "Study pack outputs",
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
  "pipeline.validatingAudioSources":
    "Validating slides, notes, and timestamped transcript…",
  "pipeline.validatingTextSources": "Validating three local files…",
  "pipeline.extractingAudioSources":
    "Extracting pages and hydrating validated transcription timestamps…",
  "pipeline.extractingTextSources":
    "Extracting pages and paragraph structure…",
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
  "error.replaceAndRetry":
    "Replace the affected file and retry, or load the included demo.",
  "error.demoRecovery":
    "Retry the same checked-in sample. No live model request will be made.",
  "error.liveRetryRecovery":
    "Your local source map is preserved. Retry, select another configured model, or use the included demo.",
  "error.liveConfigRecovery":
    "Your local source map is preserved. Check the provider configuration, select another model, or use the included demo.",

  "empty.title": "Your local source map is ready.",
  "empty.unconfigured":
    "No live model provider is configured on this deployment, so no normalized chunks were sent.",
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
    "The selected narration text is sent to OpenAI and uses the deployment owner's separately billed API account. LectureWeaver does not persist the generated audio or script.",
  "audio.unconfiguredSpeech":
    "Configure a server-side OpenAI API key to generate speech. The enhanced notes remain available for copy and Markdown export.",
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
  "how.analyzeText": "No-key demo or a configured live model",
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
    "演示模式只使用内置样例，无需 API 密钥。可选的服务端 AI 可以转写课堂录音、重组笔记、制作 Anki 卡片，并生成明确标注为 AI 语音的学习音频。",

  "hero.eyebrow": "基于证据的学习资料包",
  "hero.headlinePrefix": "把课堂内容变成真正能用来",
  "hero.headlineAccent": "学习的笔记。",
  "hero.description":
    "LectureWeaver 会检查遗漏内容，把原笔记重组为更清晰的学习指南，并可生成 Anki 卡片；每项结果都能追溯到支持它的原始证据。",
  "hero.sampleEyebrow": "评审即开即用",
  "hero.sampleTitle": "一键生成完整学习资料包。",
  "hero.featureParsing": "在本地真实解析 PDF 和 Markdown",
  "hero.featureNotes": "按可信证据重组笔记",
  "hero.featureAnki": "无需 API 密钥即可生成 Anki 卡片",
  "hero.demoLoading": "正在整合资料…",
  "hero.sampleCta": "体验示例课程",
  "hero.sampleMeta": "无需 API 密钥 · 不调用模型 · 约 3 秒",

  "upload.eyebrow": "你的材料",
  "upload.title": "建立可信来源地图。",
  "upload.description":
    "请选择 PDF 幻灯片、Markdown 笔记，以及 TXT 讲稿或课堂录音。文本文件会在当前浏览器标签页中解析；只有在你明确要求转写时才会发送音频。",
  "upload.privacy":
    "PDF、TXT 和 Markdown 保留在本地 · 仅在明确转写时向 OpenAI 发送音频 · 仅在已配置实时分析时发送规范化文本块 · 绝不静默截断",
  "upload.buildLocal": "建立本地来源地图",
  "upload.analyzeWith": "提取并使用 {provider} 分析",

  "source.slidesEyebrow": "01 / 课堂来源",
  "source.slidesTitle": "幻灯片",
  "source.slidesDetail": "文本型 PDF",
  "source.slidesLimit": "最大 10 MiB",
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

  "spoken.title": "讲稿或音频",
  "spoken.modeAria": "选择讲授内容来源类型",
  "spoken.transcriptMode": "TXT 讲稿",
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
    "点击转写后，原始音频字节会经 LectureWeaver 服务器发送到 OpenAI，并使用部署者单独计费的 API 账户。LectureWeaver 不存储也不记录录音或转写文本。",
  "spoken.unconfigured":
    "此部署尚未配置 OpenAI 音频功能。你仍可使用 TXT 讲稿或体验演示。",
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
  "provider.notConfiguredSuffix": "未配置",
  "provider.noSettings": "此部署没有实时 AI 服务配置。",
  "provider.serverKeyConfigured": "服务端密钥已配置",
  "provider.localOnly": "仅建立本地来源地图",
  "provider.keyGuidanceTitle": "API 密钥应填在哪里？",
  "provider.keyGuidance":
    "部署者应在 Vercel 的项目设置 → 环境变量中配置密钥；本地开发则写入 .env.local。不要在此页面粘贴密钥。",
  "provider.keyNames":
    "支持的服务端变量：OPENAI_API_KEY、DEEPSEEK_API_KEY 和 KIMI_API_KEY。",
  "provider.reloadAfterConfig":
    "修改 Vercel 环境变量后请重新部署，再刷新本页面。",

  "outputs.legend": "学习资料包输出",
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
  "pipeline.validatingAudioSources": "正在验证幻灯片、笔记和带时间戳的讲稿…",
  "pipeline.validatingTextSources": "正在验证三个本地文件…",
  "pipeline.extractingAudioSources": "正在提取页面并关联已验证的转写时间戳…",
  "pipeline.extractingTextSources": "正在提取页面和段落结构…",
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
  "error.replaceAndRetry": "替换有问题的文件后重试，或加载内置演示。",
  "error.demoRecovery": "请对同一套内置样例重试；不会发起实时模型请求。",
  "error.liveRetryRecovery":
    "本地来源地图已保留。请重试、选择其他已配置模型，或使用内置演示。",
  "error.liveConfigRecovery":
    "本地来源地图已保留。请检查服务商配置、选择其他模型，或使用内置演示。",

  "empty.title": "本地来源地图已就绪。",
  "empty.unconfigured": "此部署未配置实时模型服务，因此没有发送任何规范化文本块。",
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
    "所选朗读文本会发送到 OpenAI，并使用部署者单独计费的 API 账户。LectureWeaver 不会持久化生成的音频或脚本。",
  "audio.unconfiguredSpeech":
    "请配置服务端 OpenAI API 密钥以生成语音。增强笔记仍可复制和导出为 Markdown。",
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
  "how.analyzeText": "无密钥演示或已配置的实时模型",
  "how.buildTitle": "生成",
  "how.buildText": "增强笔记、可信证据和学习卡片",
} as const satisfies UiMessageCatalog;

export const UI_MESSAGE_CATALOGS: Readonly<
  Record<UiLocale, UiMessageCatalog>
> = {
  en: ENGLISH_UI_MESSAGES,
  "zh-CN": SIMPLIFIED_CHINESE_UI_MESSAGES,
};

export function resolveUiLocale(locale: string | null | undefined): UiLocale {
  if (locale === null || locale === undefined) return DEFAULT_UI_LOCALE;

  const normalized = locale.trim().replaceAll("_", "-").toLowerCase();
  if (normalized === "zh" || normalized.startsWith("zh-")) return "zh-CN";
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
