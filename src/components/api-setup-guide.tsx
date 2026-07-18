import { useId } from "react";

import type { UiLocale } from "@/lib/i18n/ui";

type ApiSetupGuideLocale = UiLocale;

type ApiSetupGuideProps = {
  locale?: ApiSetupGuideLocale;
  className?: string;
};

type GuideCopy = {
  eyebrow: string;
  title: string;
  summary: string;
  noBrowserKey: string;
  localTitle: string;
  localSteps: readonly string[];
  vercelTitle: string;
  vercelSteps: readonly string[];
  variablesTitle: string;
  variablesLead: string;
  regionNote: string;
  billingTitle: string;
  billingBody: string;
  safetyTitle: string;
  safetyBody: string;
};

const ENVIRONMENT_EXAMPLE = `OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.6
OPENAI_TRANSCRIBE_MODEL=gpt-4o-transcribe-diarize
OPENAI_TTS_MODEL=gpt-4o-mini-tts

DEEPSEEK_API_KEY=
DEEPSEEK_MODEL=deepseek-v4-flash

KIMI_API_KEY=
KIMI_MODEL=kimi-k3
KIMI_REGION=cn`;

const COPY: Record<ApiSetupGuideLocale, GuideCopy> = {
  en: {
    eyebrow: "Server configuration",
    title: "Connect an AI provider",
    summary: "Where do I add an API key?",
    noBrowserKey:
      "There is no API-key field in the browser by design. Keys must stay on the server and must never use a NEXT_PUBLIC_ prefix.",
    localTitle: "Local development",
    localSteps: [
      "Create an untracked .env.local file in the repository root.",
      "Add the key for each provider you want to enable. Model variables are optional and use the defaults shown below.",
      "Restart npm run dev after changing environment variables.",
    ],
    vercelTitle: "Vercel deployment",
    vercelSteps: [
      "Open your Vercel project, then go to Settings → Environment Variables.",
      "Add the provider keys you need to the appropriate Production, Preview, or Development environments.",
      "Redeploy after saving the variables. Never paste a key into this website or commit it to Git.",
    ],
    variablesTitle: "Supported environment variables",
    variablesLead:
      "Blank key lines mean that provider is disabled. The model values below are the application defaults.",
    regionNote:
      "KIMI_REGION accepts cn (default) or global. Audio transcription and speech require OPENAI_API_KEY.",
    billingTitle: "API billing is separate",
    billingBody:
      "ChatGPT and Codex subscriptions do not include OpenAI Platform API credits. Provider requests use and bill the deployment owner's separate API account.",
    safetyTitle: "Before enabling keys on a public site",
    safetyBody:
      "Add authentication or access control, rate limits, quotas, provider budget alerts, monitoring, and an emergency disable path. Otherwise keep the deployment private or leave provider keys unset and use the no-key demo.",
  },
  "zh-CN": {
    eyebrow: "服务端配置",
    title: "连接 AI 服务商",
    summary: "API 密钥应该填在哪里？",
    noBrowserKey:
      "页面不会提供 API 密钥输入框，这是有意的安全设计。密钥只能保存在服务端，并且绝不能使用 NEXT_PUBLIC_ 前缀。",
    localTitle: "本地开发",
    localSteps: [
      "在仓库根目录创建不纳入 Git 的 .env.local 文件。",
      "只添加需要启用的服务商密钥；模型变量可以省略，省略时使用下方默认值。",
      "修改环境变量后，重新启动 npm run dev。",
    ],
    vercelTitle: "Vercel 部署",
    vercelSteps: [
      "打开 Vercel 项目，进入 Settings → Environment Variables。",
      "按需把服务商密钥添加到 Production、Preview 或 Development 环境。",
      "保存变量后重新部署。不要把密钥粘贴到本网页，也不要提交到 Git。",
    ],
    variablesTitle: "支持的环境变量",
    variablesLead:
      "密钥留空表示不启用该服务商；下面的模型值是应用默认值。",
    regionNote:
      "KIMI_REGION 可设为 cn（默认）或 global。音频转写和语音生成必须配置 OPENAI_API_KEY。",
    billingTitle: "API 计费彼此独立",
    billingBody:
      "ChatGPT 和 Codex 订阅不包含 OpenAI Platform API 额度。服务商请求会使用部署者单独的 API 账户并产生费用。",
    safetyTitle: "在公开网站启用密钥之前",
    safetyBody:
      "请先加入身份或访问控制、限流、配额、服务商预算提醒、监控和紧急停用措施。否则应保持私有部署，或不配置密钥并仅使用免密演示。",
  },
};

export function ApiSetupGuide({
  locale = "en",
  className = "",
}: ApiSetupGuideProps) {
  const copy = COPY[locale];
  const titleId = `api-setup-guide-title-${locale}-${useId().replaceAll(":", "")}`;

  return (
    <aside
      aria-labelledby={titleId}
      className={`overflow-hidden rounded-[1.5rem] border border-[#b9d6d1] bg-[#f3faf8] shadow-[0_16px_45px_rgb(20_33_61_/_7%)] ${className}`.trim()}
    >
      <div className="border-b border-[#cce0dc] px-5 py-5 sm:px-6">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#2f837c]">
          {copy.eyebrow}
        </p>
        <h2
          className="mt-1 font-serif text-2xl font-semibold tracking-[-0.025em] text-[#14213d]"
          id={titleId}
        >
          {copy.title}
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#53627b]">
          {copy.noBrowserKey}
        </p>
      </div>

      <details className="group px-5 py-4 sm:px-6">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-lg text-sm font-bold text-[#1f625e] marker:content-none">
          <span>{copy.summary}</span>
          <span
            aria-hidden="true"
            className="grid size-7 shrink-0 place-items-center rounded-full border border-[#9fc8c1] bg-white text-lg leading-none transition-transform group-open:rotate-45"
          >
            +
          </span>
        </summary>

        <div className="mt-5 grid gap-5 border-t border-[#cce0dc] pt-5 text-sm leading-6 text-[#465873] lg:grid-cols-2">
          <section aria-labelledby={`${titleId}-local`}>
            <h3 className="font-bold text-[#14213d]" id={`${titleId}-local`}>
              {copy.localTitle}
            </h3>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              {copy.localSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </section>

          <section aria-labelledby={`${titleId}-vercel`}>
            <h3 className="font-bold text-[#14213d]" id={`${titleId}-vercel`}>
              {copy.vercelTitle}
            </h3>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              {copy.vercelSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </section>

          <section
            aria-labelledby={`${titleId}-variables`}
            className="min-w-0 lg:col-span-2"
          >
            <h3 className="font-bold text-[#14213d]" id={`${titleId}-variables`}>
              {copy.variablesTitle}
            </h3>
            <p className="mt-1">{copy.variablesLead}</p>
            <pre className="mt-3 max-w-full overflow-x-auto rounded-xl bg-[#14213d] p-4 text-xs leading-6 text-[#f7f4ec]">
              <code>{ENVIRONMENT_EXAMPLE}</code>
            </pre>
            <p className="mt-2 text-xs leading-5 text-[#53627b]">
              {copy.regionNote}
            </p>
          </section>

          <section
            aria-labelledby={`${titleId}-billing`}
            className="rounded-xl border border-[#d7c685] bg-[#fff9e8] p-4"
          >
            <h3 className="font-bold text-[#6f5417]" id={`${titleId}-billing`}>
              {copy.billingTitle}
            </h3>
            <p className="mt-1 text-[#62562f]">{copy.billingBody}</p>
          </section>

          <section
            aria-labelledby={`${titleId}-safety`}
            className="rounded-xl border border-[#efbeb5] bg-[#fff3ef] p-4"
          >
            <h3 className="font-bold text-[#983c31]" id={`${titleId}-safety`}>
              {copy.safetyTitle}
            </h3>
            <p className="mt-1 text-[#704943]">{copy.safetyBody}</p>
          </section>
        </div>
      </details>
    </aside>
  );
}

export type { ApiSetupGuideLocale, ApiSetupGuideProps };
