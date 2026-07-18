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
      "For a quick personal run, use the masked temporary-key panel above; LectureWeaver keeps that value only for the current tab and does not save it. Server configuration remains the recommended deployment setup.",
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
      "Redeploy after saving the variables. Never commit a key to Git or use a NEXT_PUBLIC_ prefix.",
    ],
    variablesTitle: "Supported environment variables",
    variablesLead:
      "Blank key lines mean that provider is disabled. The model values below are the application defaults.",
    regionNote:
      "KIMI_REGION accepts cn (default) or global. Audio transcription and speech require either a temporary OpenAI key or deployment OPENAI_API_KEY.",
    billingTitle: "API billing is separate",
    billingBody:
      "ChatGPT and Codex subscriptions do not include API credits. A temporary key bills its owner; a server key bills the deployment owner.",
    safetyTitle: "Before enabling keys on a public site",
    safetyBody:
      "Add authentication or access control, rate limits, quotas, provider budget alerts, monitoring, and an emergency disable path. Otherwise keep the deployment private or leave provider keys unset and use the no-key demo.",
  },
  "zh-CN": {
    eyebrow: "服务端配置",
    title: "连接 AI 服务商",
    summary: "API 密钥应该填在哪里？",
    noBrowserKey:
      "个人临时使用可在上方的掩码输入框填写密钥；LectureWeaver 只在当前标签页内存中使用，不会保存。长期部署仍建议使用服务端配置。",
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
      "保存变量后重新部署。不要把密钥提交到 Git，也不要使用 NEXT_PUBLIC_ 前缀。",
    ],
    variablesTitle: "支持的环境变量",
    variablesLead:
      "密钥留空表示不启用该服务商；下面的模型值是应用默认值。",
    regionNote:
      "KIMI_REGION 可设为 cn（默认）或 global。音频转写和语音生成需要临时 OpenAI 密钥或部署端 OPENAI_API_KEY。",
    billingTitle: "API 计费彼此独立",
    billingBody:
      "ChatGPT 和 Codex 订阅不包含 API 额度。临时密钥由密钥持有人付费；服务端密钥由部署者付费。",
    safetyTitle: "在公开网站启用密钥之前",
    safetyBody:
      "请先加入身份或访问控制、限流、配额、服务商预算提醒、监控和紧急停用措施。否则应保持私有部署，或不配置密钥并仅使用免密演示。",
  },
  ja: {
    eyebrow: "サーバー設定",
    title: "AI プロバイダーを接続",
    summary: "API キーはどこに設定しますか？",
    noBrowserKey:
      "個人で一時的に使う場合は、上のマスクされた入力欄を利用できます。LectureWeaver はキーを現在のタブのメモリ内だけで使用し、保存しません。継続的な運用にはサーバー設定を推奨します。",
    localTitle: "ローカル開発",
    localSteps: [
      "リポジトリのルートに、Git の追跡対象外となる .env.local ファイルを作成します。",
      "有効にするプロバイダーのキーを追加します。モデル変数は任意で、省略時は以下の既定値が使われます。",
      "環境変数を変更したら npm run dev を再起動します。",
    ],
    vercelTitle: "Vercel デプロイ",
    vercelSteps: [
      "Vercel プロジェクトを開き、Settings → Environment Variables に移動します。",
      "必要なプロバイダーキーを Production、Preview、Development の適切な環境に追加します。",
      "変数を保存した後に再デプロイします。キーを Git にコミットしないでください。",
    ],
    variablesTitle: "対応する環境変数",
    variablesLead:
      "キーが空のプロバイダーは無効になります。以下のモデル値はアプリの既定値です。",
    regionNote:
      "KIMI_REGION は cn（既定）または global を指定できます。音声の文字起こしと生成には、一時 OpenAI キーまたはデプロイ側の OPENAI_API_KEY が必要です。",
    billingTitle: "API の課金は別です",
    billingBody:
      "ChatGPT と Codex のサブスクリプションに OpenAI Platform API クレジットは含まれません。プロバイダーへのリクエストは、デプロイ所有者または一時キー所有者の別の API アカウントに課金されます。",
    safetyTitle: "公開サイトでキーを有効にする前に",
    safetyBody:
      "認証またはアクセス制御、レート制限、クォータ、プロバイダーの予算通知、監視、緊急停止手段を追加してください。それができない場合はデプロイを非公開にするか、サーバーキーを設定せずキー不要デモを利用してください。",
  },
  ko: {
    eyebrow: "서버 설정",
    title: "AI 제공업체 연결",
    summary: "API 키는 어디에 설정하나요?",
    noBrowserKey:
      "개인적으로 잠시 사용할 때는 위의 마스킹된 입력란을 이용할 수 있습니다. LectureWeaver는 키를 현재 탭 메모리에서만 사용하며 저장하지 않습니다. 지속적인 운영에는 서버 설정을 권장합니다.",
    localTitle: "로컬 개발",
    localSteps: [
      "저장소 루트에 Git이 추적하지 않는 .env.local 파일을 만드세요.",
      "사용할 제공업체의 키를 추가하세요. 모델 변수는 선택 사항이며 생략하면 아래 기본값을 사용합니다.",
      "환경 변수를 바꾼 뒤 npm run dev를 다시 시작하세요.",
    ],
    vercelTitle: "Vercel 배포",
    vercelSteps: [
      "Vercel 프로젝트를 열고 Settings → Environment Variables로 이동하세요.",
      "필요한 제공업체 키를 적절한 Production, Preview 또는 Development 환경에 추가하세요.",
      "변수를 저장한 뒤 다시 배포하세요. 키를 Git에 커밋하지 마세요.",
    ],
    variablesTitle: "지원되는 환경 변수",
    variablesLead:
      "키가 비어 있는 제공업체는 비활성화됩니다. 아래 모델 값은 애플리케이션 기본값입니다.",
    regionNote:
      "KIMI_REGION은 cn(기본값) 또는 global을 사용할 수 있습니다. 오디오 전사와 음성 생성에는 임시 OpenAI 키 또는 배포 OPENAI_API_KEY가 필요합니다.",
    billingTitle: "API 요금은 별도입니다",
    billingBody:
      "ChatGPT와 Codex 구독에는 OpenAI Platform API 크레딧이 포함되지 않습니다. 제공업체 요청은 배포 소유자 또는 임시 키 소유자의 별도 API 계정에 청구됩니다.",
    safetyTitle: "공개 사이트에서 키를 활성화하기 전에",
    safetyBody:
      "인증 또는 접근 제어, 속도 제한, 할당량, 제공업체 예산 알림, 모니터링과 긴급 비활성화 수단을 추가하세요. 그렇지 않으면 배포를 비공개로 유지하거나 서버 키를 설정하지 않고 키 없는 데모를 사용하세요.",
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
