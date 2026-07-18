import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { ApiSetupGuide } from "@/components/api-setup-guide";

describe("ApiSetupGuide", () => {
  it("explains the English server-only setup and every supported variable", async () => {
    const user = userEvent.setup();
    const { container } = render(<ApiSetupGuide locale="en" />);

    expect(
      screen.getByRole("heading", { name: "Connect an AI provider" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(
      screen.getByText(/There is no API-key field in the browser/),
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
    expect(screen.getByText(/页面不会提供 API 密钥输入框/)).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();

    await user.click(screen.getByText("API 密钥应该填在哪里？"));

    expect(screen.getByText(/仓库根目录创建不纳入 Git 的/)).toBeVisible();
    expect(screen.getByText(/Vercel 项目/)).toBeVisible();
    expect(screen.getByText(/ChatGPT 和 Codex 订阅/)).toBeVisible();
    expect(screen.getByText(/身份或访问控制、限流、配额/)).toBeVisible();
    expect(screen.getByText(/音频转写和语音生成/)).toBeVisible();
  });
});
