"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useRef, useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Mic, MicOff, User, Bot, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

// 無音検出の設定
const SILENCE_THRESHOLD = 10; // 音声レベルの閾値（0-255）
const SILENCE_DURATION = 2000; // 無音と判定するまでの時間（ミリ秒）

export function ChatInterface() {
    const { messages, sendMessage, status } = useChat({
        transport: new DefaultChatTransport({
            api: "/api/chat",
        }),
    });

    const [input, setInput] = useState("");
    const scrollRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // 音声録音関連のstate
    const [isRecording, setIsRecording] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [hasStartedOnce, setHasStartedOnce] = useState(false); // 初回手動開始フラグ
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const streamRef = useRef<MediaStream | null>(null);

    // 無音検出用
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const silenceStartRef = useRef<number | null>(null);
    const animationFrameRef = useRef<number | null>(null);

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    // 音声レベル監視を停止
    const stopAudioLevelMonitoring = useCallback(() => {
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }
        if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }
        analyserRef.current = null;
        silenceStartRef.current = null;
    }, []);

    // 録音停止（手動呼び出し）
    const stopRecordingInternal = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
            mediaRecorderRef.current.stop();
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
        }
        stopAudioLevelMonitoring();
        setIsRecording(false);
    }, [stopAudioLevelMonitoring]);

    // 音声データを文字起こしして送信
    const transcribeAndSend = useCallback(async (audioBlob: Blob) => {
        setIsTranscribing(true);

        try {
            // BlobをBase64に変換
            const arrayBuffer = await audioBlob.arrayBuffer();
            const base64Audio = btoa(
                new Uint8Array(arrayBuffer).reduce(
                    (data, byte) => data + String.fromCharCode(byte),
                    ""
                )
            );

            // APIに送信
            const response = await fetch("/api/transcribe", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    audioData: base64Audio,
                    encoding: "WEBM_OPUS",
                    sampleRateHertz: 48000,
                }),
            });

            const result = await response.json();

            if (result.success && result.transcription) {
                // 文字起こし結果を直接送信
                const transcribedText = result.transcription.trim();
                if (transcribedText) {
                    setInput(transcribedText);
                    sendMessage({ text: transcribedText });
                    setInput("");
                }
            } else if (!result.success) {
                console.error("文字起こしエラー:", result.error, result.details);
            }
        } catch (error) {
            console.error("文字起こしリクエストエラー:", error);
        } finally {
            setIsTranscribing(false);
        }
    }, [sendMessage]);

    // 音声レベル監視（無音検出）
    const monitorAudioLevel = useCallback((stopRecordingFn: () => void) => {
        if (!analyserRef.current) return;

        const analyser = analyserRef.current;
        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const checkLevel = () => {
            if (!analyserRef.current) return;

            analyser.getByteFrequencyData(dataArray);

            // 平均音量を計算
            const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;

            if (average < SILENCE_THRESHOLD) {
                // 無音状態
                if (silenceStartRef.current === null) {
                    silenceStartRef.current = Date.now();
                } else if (Date.now() - silenceStartRef.current >= SILENCE_DURATION) {
                    // 2秒間無音が続いた → 録音停止
                    console.log("無音検出: 録音を停止します");
                    stopRecordingFn();
                    return;
                }
            } else {
                // 音声あり → タイマーリセット
                silenceStartRef.current = null;
            }

            animationFrameRef.current = requestAnimationFrame(checkLevel);
        };

        checkLevel();
    }, []);

    // 音声録音を開始
    const startRecording = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;

            // AudioContextで音声レベル監視をセットアップ
            const audioContext = new AudioContext();
            audioContextRef.current = audioContext;

            const source = audioContext.createMediaStreamSource(stream);
            const analyser = audioContext.createAnalyser();
            analyser.fftSize = 256;
            source.connect(analyser);
            analyserRef.current = analyser;

            const mediaRecorder = new MediaRecorder(stream, {
                mimeType: "audio/webm;codecs=opus",
            });

            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = async () => {
                // 音声データをBlobに変換
                const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });

                // 最小サイズチェック（ほぼ空の録音を無視）
                if (audioBlob.size > 1000) {
                    await transcribeAndSend(audioBlob);
                }
            };

            mediaRecorderRef.current = mediaRecorder;
            mediaRecorder.start(100); // 100msごとにデータを取得
            setIsRecording(true);
            setHasStartedOnce(true);

            // 無音検出を開始
            monitorAudioLevel(stopRecordingInternal);

        } catch (error) {
            console.error("マイクへのアクセスに失敗しました:", error);
            alert("マイクへのアクセスが許可されていません。ブラウザの設定を確認してください。");
        }
    }, [monitorAudioLevel, stopRecordingInternal, transcribeAndSend]);

    // 手動で録音を停止
    const stopRecording = useCallback(() => {
        stopRecordingInternal();
    }, [stopRecordingInternal]);

    // マイクボタンのクリックハンドラー
    const handleMicClick = useCallback(() => {
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    }, [isRecording, stopRecording, startRecording]);

    // AI応答完了後に自動で録音を再開
    useEffect(() => {
        // 初回は手動開始が必要（ユーザーアクション）
        if (!hasStartedOnce) return;
        // 文字起こし中は待機
        if (isTranscribing) return;
        // すでに録音中なら何もしない
        if (isRecording) return;
        // AI応答が完了したら録音再開
        if (status === "ready" && messages.length > 0) {
            // 少し遅延を入れて自然な間を作る
            const timer = setTimeout(() => {
                startRecording();
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [status, hasStartedOnce, isTranscribing, isRecording, messages.length, startRecording]);

    // グローバルキーイベント: スペースキーで音声入力をトグル
    useEffect(() => {
        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            // 入力欄がフォーカスされている場合は無視
            if (document.activeElement === textareaRef.current) {
                return;
            }
            // 他の入力要素がフォーカスされている場合は無視
            const activeElement = document.activeElement;
            if (activeElement && (activeElement.tagName === "INPUT" || activeElement.tagName === "TEXTAREA" || (activeElement as HTMLElement).isContentEditable)) {
                return;
            }
            // スペースキーで音声入力をトグル
            if (e.key === " " && !e.shiftKey && !isTranscribing && status === "ready") {
                e.preventDefault();
                handleMicClick();
            }
        };

        window.addEventListener("keydown", handleGlobalKeyDown);
        return () => window.removeEventListener("keydown", handleGlobalKeyDown);
    }, [handleMicClick, isTranscribing, status]);

    const isLoading = status === "streaming" || status === "submitted";

    return (
        <div className="flex flex-col h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
            {/* Header */}
            <header className="flex-shrink-0 border-b border-slate-700/50 bg-slate-800/50 backdrop-blur-sm">
                <div className="max-w-4xl mx-auto px-4 py-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center">
                            <Bot className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg font-semibold text-white">
                                服薬指導ロールプレイ
                            </h1>
                            <p className="text-sm text-slate-400">
                                患者: 佐藤 健太（35歳・男性・高血圧）
                            </p>
                        </div>
                    </div>
                </div>
            </header>

            {/* Chat Messages */}
            <ScrollArea className="flex-1 px-4" ref={scrollRef}>
                <div className="max-w-4xl mx-auto py-6 space-y-4">
                    {messages.length === 0 && (
                        <div className="text-center py-12">
                            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-emerald-400/20 to-cyan-500/20 flex items-center justify-center">
                                <Bot className="w-8 h-8 text-emerald-400" />
                            </div>
                            <h2 className="text-xl font-semibold text-white mb-2">
                                服薬指導を始めましょう
                            </h2>
                            <p className="text-slate-400 max-w-md mx-auto">
                                あなたは薬剤師役です。患者の佐藤健太さんに服薬指導を行ってください。
                                <br />
                                マイクボタンを押して話しかけてください。
                            </p>
                        </div>
                    )}

                    {messages.map((message) => (
                        <div
                            key={message.id}
                            className={cn(
                                "flex gap-3",
                                message.role === "user" ? "justify-end" : "justify-start"
                            )}
                        >
                            {message.role === "assistant" && (
                                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center">
                                    <Bot className="w-4 h-4 text-white" />
                                </div>
                            )}

                            <div
                                className={cn(
                                    "max-w-[75%] rounded-2xl px-4 py-3 shadow-lg",
                                    message.role === "user"
                                        ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white"
                                        : "bg-slate-700/80 text-slate-100 backdrop-blur-sm"
                                )}
                            >
                                <div className="text-sm leading-relaxed whitespace-pre-wrap">
                                    {message.parts.map((part, index) =>
                                        part.type === "text" ? (
                                            <span key={index}>{part.text}</span>
                                        ) : null
                                    )}
                                </div>
                            </div>

                            {message.role === "user" && (
                                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-500 flex items-center justify-center">
                                    <User className="w-4 h-4 text-white" />
                                </div>
                            )}
                        </div>
                    ))}

                    {isLoading && (
                        <div className="flex gap-3 justify-start">
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center">
                                <Bot className="w-4 h-4 text-white" />
                            </div>
                            <div className="bg-slate-700/80 rounded-2xl px-4 py-3 backdrop-blur-sm">
                                <div className="flex gap-1">
                                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </ScrollArea>

            {/* Input Area */}
            <div className="flex-shrink-0 border-t border-slate-700/50 bg-slate-800/50 backdrop-blur-sm">
                <div className="max-w-4xl mx-auto px-4 py-4">
                    <div className="flex gap-3 items-center justify-center">
                        {/* テキスト入力欄（非表示だが残す） */}
                        <div className="hidden">
                            <textarea
                                ref={textareaRef}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="服薬指導のメッセージを入力..."
                                rows={1}
                                className="w-full resize-none rounded-xl border border-slate-600 bg-slate-700/50 px-4 py-3 pr-10 text-white placeholder-slate-400"
                                disabled={status !== "ready"}
                            />
                        </div>

                        {/* マイクボタン（大きく中央配置） */}
                        <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className={cn(
                                "h-20 w-20 rounded-full border-2 transition-all",
                                isRecording
                                    ? "bg-red-500 border-red-500 text-white hover:bg-red-600 hover:border-red-600 animate-pulse scale-110"
                                    : isTranscribing
                                        ? "bg-amber-500 border-amber-500 text-white"
                                        : isLoading
                                            ? "bg-slate-600 border-slate-600 text-slate-400"
                                            : "bg-gradient-to-r from-emerald-500 to-cyan-500 border-emerald-500 text-white hover:from-emerald-600 hover:to-cyan-600 hover:scale-105"
                            )}
                            onClick={handleMicClick}
                            disabled={isTranscribing || isLoading}
                        >
                            {isTranscribing ? (
                                <Loader2 className="h-8 w-8 animate-spin" />
                            ) : isRecording ? (
                                <MicOff className="h-8 w-8" />
                            ) : (
                                <Mic className="h-8 w-8" />
                            )}
                        </Button>
                    </div>

                    <p className="text-xs text-slate-500 mt-3 text-center">
                        {isRecording
                            ? "話し終わると自動で送信されます（2秒の無音で送信）"
                            : isTranscribing
                                ? "音声を認識中..."
                                : isLoading
                                    ? "患者が応答中..."
                                    : "マイクボタンを押して話しかけてください（スペースキーでも可）"
                        }
                    </p>
                </div>
            </div>
        </div>
    );
}
