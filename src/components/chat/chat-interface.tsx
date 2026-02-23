"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useRef, useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Mic, MicOff, User, Bot, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// 無音検出の設定
const SILENCE_THRESHOLD = 10;   // 音声レベルの閾値（0-255）
const SILENCE_DURATION = 1000;  // 無音と判定するまでの時間（ミリ秒）
const VOICE_THRESHOLD = 12;     // 発話開始と判定する閾値

export function ChatInterface() {
    const { messages, sendMessage, status } = useChat({
        transport: new DefaultChatTransport({
            api: "/api/chat",
        }),
    });

    const [input, setInput] = useState("");
    const scrollRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // マイクの状態
    const [isMicActive, setIsMicActive] = useState(false);     // マイクストリーム自体がアクティブか
    const [isListening, setIsListening] = useState(false);      // VADがアクティブに発話検出中か
    const [isCapturing, setIsCapturing] = useState(false);      // 現在発話をキャプチャ中か
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [hasStartedOnce, setHasStartedOnce] = useState(false);

    // マイクストリーム（常時ON）
    const streamRef = useRef<MediaStream | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);

    // 録音用（発話区間のみ）
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    // VAD制御
    const animationFrameRef = useRef<number | null>(null);
    const silenceStartRef = useRef<number | null>(null);
    const hasVoiceDetectedRef = useRef<boolean>(false);
    const isProcessingRef = useRef<boolean>(false);  // 文字起こし→送信中フラグ

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    // ==== マイクストリームの管理 ====

    // マイクストリームを取得（1回のみ）
    const acquireMicStream = useCallback(async () => {
        if (streamRef.current) return streamRef.current;

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;

        // AudioContextとAnalyserをセットアップ
        const audioContext = new AudioContext();
        audioContextRef.current = audioContext;
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        analyserRef.current = analyser;

        return stream;
    }, []);

    // マイクストリームを解放
    const releaseMicStream = useCallback(() => {
        // VADを停止
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }
        // 録音中なら停止
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
            mediaRecorderRef.current.stop();
        }
        mediaRecorderRef.current = null;
        // AudioContextを閉じる
        if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }
        analyserRef.current = null;
        // ストリームを停止
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
        }
        // stateリセット
        silenceStartRef.current = null;
        hasVoiceDetectedRef.current = false;
        isProcessingRef.current = false;
        setIsMicActive(false);
        setIsListening(false);
        setIsCapturing(false);
    }, []);

    // ==== 発話区間のキャプチャ ====

    // 発話区間の録音を開始
    const startCapture = useCallback(() => {
        if (!streamRef.current || isProcessingRef.current) return;

        const mediaRecorder = new MediaRecorder(streamRef.current, {
            mimeType: "audio/webm;codecs=opus",
        });
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                audioChunksRef.current.push(event.data);
            }
        };

        mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
            // 最小サイズチェック
            if (audioBlob.size > 1000) {
                await transcribeAndSend(audioBlob);
            } else {
                // 小さすぎるデータは無視して再開
                isProcessingRef.current = false;
            }
        };

        mediaRecorderRef.current = mediaRecorder;
        mediaRecorder.start(100);
        setIsCapturing(true);
    }, []);

    // 発話区間の録音を停止
    const stopCapture = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
            isProcessingRef.current = true;
            mediaRecorderRef.current.stop();
        }
        mediaRecorderRef.current = null;
        setIsCapturing(false);
        // VADフラグリセット（次の発話区間のために）
        hasVoiceDetectedRef.current = false;
        silenceStartRef.current = null;
    }, []);

    // ==== 文字起こし・送信 ====

    const transcribeAndSend = useCallback(async (audioBlob: Blob) => {
        setIsTranscribing(true);

        try {
            const arrayBuffer = await audioBlob.arrayBuffer();
            const base64Audio = btoa(
                new Uint8Array(arrayBuffer).reduce(
                    (data, byte) => data + String.fromCharCode(byte),
                    ""
                )
            );

            const response = await fetch("/api/transcribe", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    audioData: base64Audio,
                    encoding: "WEBM_OPUS",
                    sampleRateHertz: 48000,
                }),
            });

            const result = await response.json();

            if (result.success && result.transcription) {
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
            isProcessingRef.current = false;
        }
    }, [sendMessage]);

    // ==== VAD（Voice Activity Detection） ====

    const startVAD = useCallback(() => {
        if (!analyserRef.current) return;

        const analyser = analyserRef.current;
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        setIsListening(true);

        const checkLevel = () => {
            if (!analyserRef.current) return;
            // 処理中はVADを一時停止
            if (isProcessingRef.current) {
                animationFrameRef.current = requestAnimationFrame(checkLevel);
                return;
            }

            analyser.getByteFrequencyData(dataArray);
            const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;

            if (average >= VOICE_THRESHOLD) {
                // 音声検出
                if (!hasVoiceDetectedRef.current) {
                    // 発話開始 → キャプチャ開始
                    hasVoiceDetectedRef.current = true;
                    startCapture();
                }
                // 無音タイマーリセット
                silenceStartRef.current = null;
            } else if (average < SILENCE_THRESHOLD && hasVoiceDetectedRef.current) {
                // 発話後の無音
                if (silenceStartRef.current === null) {
                    silenceStartRef.current = Date.now();
                } else if (Date.now() - silenceStartRef.current >= SILENCE_DURATION) {
                    // 無音が続いた → キャプチャ停止・送信
                    console.log("無音検出: 発話区間を送信します");
                    stopCapture();
                    animationFrameRef.current = requestAnimationFrame(checkLevel);
                    return;
                }
            }

            animationFrameRef.current = requestAnimationFrame(checkLevel);
        };

        checkLevel();
    }, [startCapture, stopCapture]);

    const stopVAD = useCallback(() => {
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }
        setIsListening(false);
    }, []);

    // ==== マイクのON/OFF ====

    const activateMic = useCallback(async () => {
        try {
            await acquireMicStream();
            setIsMicActive(true);
            setHasStartedOnce(true);
            startVAD();
        } catch (error) {
            console.error("マイクへのアクセスに失敗しました:", error);
            alert("マイクへのアクセスが許可されていません。ブラウザの設定を確認してください。");
        }
    }, [acquireMicStream, startVAD]);

    const deactivateMic = useCallback(() => {
        stopVAD();
        releaseMicStream();
    }, [stopVAD, releaseMicStream]);

    const handleMicClick = useCallback(() => {
        if (isMicActive) {
            deactivateMic();
        } else {
            activateMic();
        }
    }, [isMicActive, activateMic, deactivateMic]);

    // ==== AI応答完了後にVADを再開 ====

    useEffect(() => {
        if (!hasStartedOnce) return;
        if (!isMicActive) return;
        if (isTranscribing) return;

        // AI応答が完了したらVADを再開（マイクはそのまま）
        if (status === "ready" && !isListening && !isProcessingRef.current) {
            const timer = setTimeout(() => {
                startVAD();
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [status, hasStartedOnce, isMicActive, isTranscribing, isListening, startVAD]);

    // AI応答開始時にVADを一時停止
    useEffect(() => {
        if (status === "streaming" || status === "submitted") {
            stopVAD();
            // キャプチャ中なら停止（送信しない）
            if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
                mediaRecorderRef.current.stop();
                mediaRecorderRef.current = null;
                setIsCapturing(false);
                hasVoiceDetectedRef.current = false;
                silenceStartRef.current = null;
            }
        }
    }, [status, stopVAD]);

    // ==== グローバルキーイベント ====

    useEffect(() => {
        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            if (document.activeElement === textareaRef.current) return;
            const ae = document.activeElement;
            if (ae && (ae.tagName === "INPUT" || ae.tagName === "TEXTAREA" || (ae as HTMLElement).isContentEditable)) return;

            if (e.key === " " && !e.shiftKey && !isTranscribing) {
                e.preventDefault();
                handleMicClick();
            }
        };

        window.addEventListener("keydown", handleGlobalKeyDown);
        return () => window.removeEventListener("keydown", handleGlobalKeyDown);
    }, [handleMicClick, isTranscribing]);

    // コンポーネントアンマウント時にクリーンアップ
    useEffect(() => {
        return () => {
            releaseMicStream();
        };
    }, [releaseMicStream]);

    const isLoading = status === "streaming" || status === "submitted";

    // ステータスメッセージ
    const getStatusMessage = () => {
        if (!isMicActive) return "マイクボタンを押して会話を開始（スペースキーでも可）";
        if (isTranscribing) return "音声を認識中...";
        if (isLoading) return "患者が応答中...";
        if (isCapturing) return "🔴 発話中...";
        if (isListening) return "🎧 聴いています — 話しかけてください";
        return "待機中...";
    };

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

                    <div className="flex gap-3 items-center justify-center">
                        {/* マイクボタン */}
                        <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className={cn(
                                "h-20 w-20 rounded-full border-2 transition-all",
                                isCapturing
                                    ? "bg-red-500 border-red-500 text-white hover:bg-red-600 hover:border-red-600 animate-pulse scale-110"
                                    : isTranscribing
                                        ? "bg-amber-500 border-amber-500 text-white"
                                        : isListening
                                            ? "bg-emerald-500 border-emerald-400 text-white animate-pulse"
                                            : isLoading
                                                ? "bg-slate-600 border-slate-600 text-slate-400"
                                                : isMicActive
                                                    ? "bg-emerald-600 border-emerald-500 text-white"
                                                    : "bg-gradient-to-r from-emerald-500 to-cyan-500 border-emerald-500 text-white hover:from-emerald-600 hover:to-cyan-600 hover:scale-105"
                            )}
                            onClick={handleMicClick}
                            disabled={isTranscribing}
                        >
                            {isTranscribing ? (
                                <Loader2 className="h-8 w-8 animate-spin" />
                            ) : isMicActive ? (
                                <MicOff className="h-8 w-8" />
                            ) : (
                                <Mic className="h-8 w-8" />
                            )}
                        </Button>
                    </div>

                    <p className="text-xs text-slate-500 mt-3 text-center">
                        {getStatusMessage()}
                    </p>
                </div>
            </div>
        </div>
    );
}
