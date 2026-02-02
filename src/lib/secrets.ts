import { SecretManagerServiceClient } from "@google-cloud/secret-manager";

// シークレットキャッシュ（サーバー起動中はメモリに保持）
const secretCache = new Map<string, string>();

/**
 * GCP Secret Managerを使用するかどうか
 */
export function useSecretManager(): boolean {
    return process.env.USE_SECRET_MANAGER === "true";
}

/**
 * GCP Secret Managerからシークレットを取得
 * @param secretName シークレット名（例: "OPENAI_API_KEY"）
 */
export async function getSecret(secretName: string): Promise<string | null> {
    // キャッシュにあればそれを返す
    if (secretCache.has(secretName)) {
        return secretCache.get(secretName)!;
    }

    // Secret Managerを使わない場合は環境変数から直接取得
    if (!useSecretManager()) {
        return process.env[secretName] || null;
    }

    const projectId = process.env.GCP_PROJECT_ID;
    if (!projectId) {
        console.warn("GCP_PROJECT_ID is not set, falling back to env vars");
        return process.env[secretName] || null;
    }

    try {
        const client = new SecretManagerServiceClient();
        const name = `projects/${projectId}/secrets/${secretName}/versions/latest`;

        const [version] = await client.accessSecretVersion({ name });
        const payload = version.payload?.data;

        if (payload) {
            const secret =
                typeof payload === "string"
                    ? payload
                    : new TextDecoder().decode(payload as Uint8Array);
            secretCache.set(secretName, secret);
            return secret;
        }
    } catch (error) {
        console.error(`Failed to get secret ${secretName}:`, error);
        // フォールバック: 環境変数から取得
        return process.env[secretName] || null;
    }

    return null;
}

/**
 * APIキーを取得（OpenAI用）
 */
export async function getOpenAIApiKey(): Promise<string | null> {
    return getSecret("OPENAI_API_KEY");
}

/**
 * APIキーを取得（Google/Gemini用）
 */
export async function getGoogleApiKey(): Promise<string | null> {
    return getSecret("GOOGLE_GENERATIVE_AI_API_KEY");
}
