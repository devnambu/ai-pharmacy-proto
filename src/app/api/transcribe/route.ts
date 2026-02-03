import { SpeechClient } from "@google-cloud/speech";
import { getSecret, useSecretManager } from "@/lib/secrets";

export const maxDuration = 30;

export async function POST(req: Request) {
    try {
        const { audioData, encoding, sampleRateHertz } = await req.json();

        if (!audioData) {
            return Response.json(
                { error: "音声データがありません" },
                { status: 400 }
            );
        }

        // Cloud Run環境ではデフォルトのサービスアカウント認証を使用
        // ローカル環境では動作しないことが期待される
        const client = new SpeechClient();

        const request = {
            audio: {
                content: audioData, // Base64エンコードされた音声データ
            },
            config: {
                encoding: encoding || "WEBM_OPUS",
                sampleRateHertz: sampleRateHertz || 48000,
                languageCode: "ja-JP",
                model: "default",
                enableAutomaticPunctuation: true,
            },
        };

        console.log("Sending audio to Speech-to-Text API...");

        const [response] = await client.recognize(request);

        const transcription = response.results
            ?.map((result) => result.alternatives?.[0]?.transcript)
            .filter(Boolean)
            .join("\n");

        console.log("Transcription result:", transcription);

        return Response.json({
            transcription: transcription || "",
            success: true,
        });
    } catch (error) {
        console.error("Speech-to-Text error:", error);

        // エラーの種類に応じたメッセージ
        const errorMessage =
            error instanceof Error ? error.message : "不明なエラーが発生しました";

        return Response.json(
            {
                error: "音声認識に失敗しました",
                details: errorMessage,
                success: false,
            },
            { status: 500 }
        );
    }
}
