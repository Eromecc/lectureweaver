import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { ApiSetupGuide } from "@/components/api-setup-guide";

describe("ApiSetupGuide", () => {
  it("explains temporary and server setup plus every supported variable", async () => {
    const user = userEvent.setup();
    const { container } = render(<ApiSetupGuide locale="en" />);

    expect(
      screen.getByRole("heading", { name: "Connect an AI provider" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(
      screen.getByText(/masked temporary-key panel/),
    ).toBeInTheDocument();

    const disclosure = container.querySelector("details");
    expect(disclosure).not.toHaveAttribute("open");
    await user.click(
      screen.getByText("Where do I add an API key?"),
    );
    expect(disclosure).toHaveAttribute("open");

    expect(screen.getByText(/Create an untracked .env.local/)).toBeVisible();
    expect(
      screen.getByText(/Settings → Environment Variables/),
    ).toBeVisible();
    expect(screen.getByText(/ChatGPT and Codex subscriptions/)).toBeVisible();
    expect(screen.getByText(/rate limits, quotas/)).toBeVisible();

    const environmentBlock = container.querySelector("code");
    expect(environmentBlock).toHaveTextContent("OPENAI_API_KEY=");
    expect(environmentBlock).toHaveTextContent("OPENAI_MODEL=gpt-5.6");
    expect(environmentBlock).toHaveTextContent(
      "OPENAI_TRANSCRIBE_MODEL=gpt-4o-transcribe-diarize",
    );
    expect(environmentBlock).toHaveTextContent(
      "OPENAI_TTS_MODEL=gpt-4o-mini-tts",
    );
    expect(environmentBlock).toHaveTextContent("DEEPSEEK_API_KEY=");
    expect(environmentBlock).toHaveTextContent(
      "DEEPSEEK_MODEL=deepseek-v4-flash",
    );
    expect(environmentBlock).toHaveTextContent("KIMI_API_KEY=");
    expect(environmentBlock).toHaveTextContent("KIMI_MODEL=kimi-k3");
    expect(environmentBlock).toHaveTextContent("KIMI_REGION=cn");
  });

  it("renders the complete Chinese guidance", async () => {
    const user = userEvent.setup();
    render(<ApiSetupGuide locale="zh-CN" className="integration-slot" />);

    expect(
      screen.getByRole("heading", { name: "连接 AI 服务商" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/掩码输入框填写密钥/)).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();

    await user.click(screen.getByText("API 密钥应该填在哪里？"));

    expect(screen.getByText(/仓库根目录创建不纳入 Git 的/)).toBeVisible();
    expect(screen.getByText(/Vercel 项目/)).toBeVisible();
    expect(screen.getByText(/ChatGPT 和 Codex 订阅/)).toBeVisible();
    expect(screen.getByText(/身份或访问控制、限流、配额/)).toBeVisible();
    expect(screen.getByText(/音频转写和语音生成/)).toBeVisible();
  });

  it("renders complete Japanese guidance without translating variable names", async () => {
    const user = userEvent.setup();
    const { container } = render(<ApiSetupGuide locale="ja" />);

    expect(
      screen.getByRole("heading", { name: "AI プロバイダーを接続" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/サーバー設定を推奨/)).toBeInTheDocument();

    await user.click(screen.getByText("API キーはどこに設定しますか？"));

    expect(screen.getByText(/Git の追跡対象外/)).toBeVisible();
    expect(screen.getByText(/ChatGPT と Codex/)).toBeVisible();
    expect(screen.getByText(/認証またはアクセス制御/)).toBeVisible();
    expect(container.querySelector("code")).toHaveTextContent(
      "OPENAI_API_KEY=",
    );
  });

  it("renders complete Korean guidance without exposing a stored key field", async () => {
    const user = userEvent.setup();
    render(<ApiSetupGuide locale="ko" />);

    expect(
      screen.getByRole("heading", { name: "AI 제공업체 연결" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/서버 설정을 권장/)).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();

    await user.click(screen.getByText("API 키는 어디에 설정하나요?"));

    expect(screen.getByText(/Git이 추적하지 않는/)).toBeVisible();
    expect(screen.getByText(/ChatGPT와 Codex/)).toBeVisible();
    expect(screen.getByText(/인증 또는 접근 제어/)).toBeVisible();
    expect(screen.getByText(/오디오 전사와 음성 생성/)).toBeVisible();
  });
});
