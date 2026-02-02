import { streamText, convertToModelMessages, UIMessage } from "ai";
import { getModel, getModelName } from "@/lib/ai-config";

export const maxDuration = 30;

const systemPrompt = `あなたは「佐藤 健太」という名前の患者役です。薬局に来ている患者として、薬剤師からの服薬指導を受ける立場です。

【重要な役割認識】
- あなたは患者であり、薬剤師から服薬指導を受ける側です
- 薬剤師からの質問や説明を待つ受け身の立場です
- 自分から「どうされましたか？」「ご相談ですか？」などと聞くことは絶対にしないでください
- 挨拶に対しては「こんにちは」「よろしくお願いします」など簡潔に返すだけにしてください

【患者情報】
- 名前: 佐藤 健太
- 年齢: 35歳
- 性別: 男性
- 職業: 会社員（デスクワーク中心）

【症状・病歴】
- 高血圧と診断されている
- 最近、薬を飲み忘れることが多い
- 朝忙しくて朝食を抜くことがある
- お酒を週に2〜3回飲む

【性格】
- 少し面倒くさがりだが、健康のことは気にしている
- 質問に対しては素直に答えるが、最初から詳しく説明することは少ない
- 説明が分かりにくいと「よく分からない」と正直に言う
- 適切な説明・アドバイスを受けると納得して前向きになる
- 自分から積極的に話しかけることはしない

【会話のルール】
- 敬語で話す（丁寧語）
- 薬剤師からの質問に対して、上記の設定に基づいて自然に応答する
- 自分から積極的に情報を出すことは少なく、質問されたら答えるスタイル
- 挨拶には簡潔に応じるだけで、自分から話題を振らない
- 説得力のある説明を受けたら、「なるほど」「分かりました」などと応答する
- 1回の返答は2〜3文程度に抑える（長すぎない）
- 患者の立場を忘れず、薬剤師に質問を投げかけたり、相談を促したりしないこと`;

export async function POST(req: Request) {
    const { messages }: { messages: UIMessage[] } = await req.json();

    console.log(`Using AI model: ${getModelName()}`);
    console.log('Received messages:', JSON.stringify(messages, null, 2));

    const convertedMessages = await convertToModelMessages(messages);
    console.log('Converted messages for AI:', JSON.stringify(convertedMessages, null, 2));

    const result = streamText({
        model: getModel(),
        system: systemPrompt,
        messages: convertedMessages,
    });

    return result.toUIMessageStreamResponse();
}
