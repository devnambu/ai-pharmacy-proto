import { openai } from "@ai-sdk/openai";
import { google } from "@ai-sdk/google";
import { LanguageModel } from "ai";

export type AIProvider = "openai" | "gemini";

/**
 * 環境変数から使用するAIプロバイダーを取得
 */
export function getAIProvider(): AIProvider {
    const provider = process.env.AI_PROVIDER?.toLowerCase();
    if (provider === "gemini" || provider === "google") {
        return "gemini";
    }
    return "openai"; // デフォルトはOpenAI
}

/**
 * 設定されたプロバイダーに応じたモデルインスタンスを返す
 */
export function getModel(): LanguageModel {
    const provider = getAIProvider();

    switch (provider) {
        case "gemini":
            // Gemini 1.5 Pro (最新の推奨モデル)
            return google("gemini-1.5-pro");
        case "openai":
        default:
            // GPT-4o
            return openai("gpt-4o");
    }
}

/**
 * 現在使用中のモデル名を返す（デバッグ・ログ用）
 */
export function getModelName(): string {
    const provider = getAIProvider();
    return provider === "gemini" ? "gemini-1.5-pro" : "gpt-4o";
}
