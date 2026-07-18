import { describe, expect, it } from "vitest";

import {
  createUiTranslator,
  DEFAULT_UI_LOCALE,
  resolveUiLocale,
  translateUi,
  translateUiPlural,
  UI_LOCALE_OPTIONS,
  UI_LOCALES,
  UI_MESSAGE_CATALOGS,
} from "@/lib/i18n/ui";

describe("static UI localization", () => {
  it("keeps every supported locale complete and nonblank", () => {
    const englishKeys = Object.keys(UI_MESSAGE_CATALOGS.en).sort();
    const placeholders = (message: string) =>
      [...message.matchAll(/\{([A-Za-z][A-Za-z0-9_]*)\}/g)]
        .map((match) => match[1])
        .sort();

    expect(UI_LOCALES).toEqual(["en", "zh-CN", "ja", "ko"]);
    expect(UI_LOCALE_OPTIONS.map((option) => option.value)).toEqual(UI_LOCALES);
    expect(UI_LOCALE_OPTIONS.map((option) => option.label)).toEqual([
      "English",
      "简体中文",
      "日本語",
      "한국어",
    ]);

    for (const locale of UI_LOCALES) {
      expect(Object.keys(UI_MESSAGE_CATALOGS[locale]).sort()).toEqual(
        englishKeys,
      );
      expect(
        Object.values(UI_MESSAGE_CATALOGS[locale]).every(
          (message) => message.trim().length > 0,
        ),
      ).toBe(true);
      for (const key of englishKeys) {
        const messageKey = key as keyof typeof UI_MESSAGE_CATALOGS.en;
        expect(placeholders(UI_MESSAGE_CATALOGS[locale][messageKey])).toEqual(
          placeholders(UI_MESSAGE_CATALOGS.en[messageKey]),
        );
      }
    }
  });

  it("resolves browser locale variants and falls back to English", () => {
    expect(resolveUiLocale("zh-CN")).toBe("zh-CN");
    expect(resolveUiLocale("zh_Hans_CN")).toBe("zh-CN");
    expect(resolveUiLocale("ja-JP")).toBe("ja");
    expect(resolveUiLocale("ja_Jpan_JP")).toBe("ja");
    expect(resolveUiLocale("ko-KR")).toBe("ko");
    expect(resolveUiLocale("ko_Kore_KR")).toBe("ko");
    expect(resolveUiLocale("en-GB")).toBe("en");
    expect(resolveUiLocale("fr-FR")).toBe(DEFAULT_UI_LOCALE);
    expect(resolveUiLocale(undefined)).toBe(DEFAULT_UI_LOCALE);
    expect(translateUi("unsupported", "hero.sampleCta")).toBe(
      "Try the sample lecture",
    );
  });

  it("interpolates named scalar values without interpreting their contents", () => {
    expect(
      translateUi("zh-CN", "upload.analyzeWith", {
        provider: "OpenAI <script>",
      }),
    ).toBe("提取并使用 OpenAI <script> 分析");
    expect(translateUi("en", "upload.analyzeWith")).toBe(
      "Extract and analyze with {provider}",
    );
    expect(
      translateUi("en", "pipeline.analyzing", {
        provider: "OpenAI",
        model: "gpt-5.6",
        ignored: "not rendered",
      }),
    ).toBe("Analyzing normalized chunks with OpenAI · gpt-5.6…");
  });

  it("uses locale-aware singular and plural message selection", () => {
    const forms = {
      one: "spoken.segmentCountOne",
      other: "spoken.segmentCountOther",
    } as const;

    expect(translateUiPlural("en", 1, forms)).toBe("1 segment");
    expect(translateUiPlural("en", 2, forms)).toBe("2 segments");
    expect(translateUiPlural("zh-CN", 1, forms)).toBe("1 个片段");
    expect(translateUiPlural("zh-CN", 8, forms)).toBe("8 个片段");
    expect(translateUiPlural("ja", 1, forms)).toBe("1 セグメント");
    expect(translateUiPlural("ja", 8, forms)).toBe("8 セグメント");
    expect(translateUiPlural("ko", 1, forms)).toBe("1개 구간");
    expect(translateUiPlural("ko", 8, forms)).toBe("8개 구간");
  });

  it("creates a locale-bound typed translator", () => {
    const t = createUiTranslator("zh-CN");

    expect(t("provider.keyGuidanceTitle")).toBe("API 密钥应填在哪里？");
    expect(t("workspace.ankiTab", { count: 12 })).toBe(
      "Anki 卡片 · 12",
    );

    expect(createUiTranslator("ja")("provider.keyGuidanceTitle")).toBe(
      "API キーはどこに設定しますか？",
    );
    expect(createUiTranslator("ko")("workspace.audioTab")).toBe(
      "오디오 가이드",
    );
  });
});
