"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useRef, useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Mic, MicOff, User, Bot, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

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
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (input.trim() && status === "ready") {
            sendMessage({ text: input });
            setInput("");
        }
    };

    // 音声録音を開始
    const startRecording = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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
                // ストリームを停止
                stream.getTracks().forEach((track) => track.stop());

                // 音声データをBlobに変換
                const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });

                // 文字起こしを実行
                await transcribeAudio(audioBlob);
            };

            mediaRecorderRef.current = mediaRecorder;
            mediaRecorder.start();
            setIsRecording(true);
        } catch (error) {
            console.error("マイクへのアクセスに失敗しました:", error);
            alert("マイクへのアクセスが許可されていません。ブラウザの設定を確認してください。");
        }
    }, []);

    // 音声録音を停止
    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    }, [isRecording]);

    // 音声データを文字起こし
    const transcribeAudio = async (audioBlob: Blob) => {
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
                // 文字起こし結果を入力欄に追加
                setInput((prev) =>
                    prev ? `${prev} ${result.transcription}` : result.transcription
                );
            } else if (!result.success) {
                console.error("文字起こしエラー:", result.error, result.details);
                alert(`音声認識に失敗しました: ${result.error || "不明なエラー"}`);
            }
        } catch (error) {
            console.error("文字起こしリクエストエラー:", error);
            alert("音声認識のリクエストに失敗しました。");
        } finally {
            setIsTranscribing(false);
            // 文字起こし完了後に入力欄をフォーカス
            textareaRef.current?.focus();
        }
    };

    // マイクボタンのクリックハンドラー
    const handleMicClick = useCallback(() => {
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    }, [isRecording, stopRecording, startRecording]);

    // グローバルキーイベント: 入力欄がアクティブでない場合にスペースキーで音声入力をトグル
    useEffect(() => {
        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            // 入力欄がフォーカスされている場合は無視
            if (document.activeElement === textareaRef.current) {
                return;
            }
            // 他の入力要素（input, textarea等）がフォーカスされている場合は無視
            const activeElement = document.activeElement;
            if (activeElement && (activeElement.tagName === "INPUT" || activeElement.tagName === "TEXTAREA" || (activeElement as HTMLElement).isContentEditable)) {
                return;
            }
            // スペースキーで音声入力をトグル（文字起こし中でなければ）
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
                                まずは挨拶から始めてみましょう。
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
                <form onSubmit={handleSubmit} className="max-w-4xl mx-auto px-4 py-4">
                    <div className="flex gap-3 items-center">
                        <div className="flex-1 relative flex items-center">
                            <textarea
                                ref={textareaRef}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="服薬指導のメッセージを入力..."
                                rows={1}
                                className="w-full resize-none rounded-xl border border-slate-600 bg-slate-700/50 px-4 py-3 pr-10 text-white placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                                        e.preventDefault();
                                        handleSubmit(e);
                                    }
                                    // Shift+Spaceで入力内容を削除
                                    if (e.key === " " && e.shiftKey) {
                                        e.preventDefault();
                                        setInput("");
                                    }
                                }}
                                disabled={status !== "ready"}
                            />
                            {/* 削除ボタン */}
                            {input && (
                                <button
                                    type="button"
                                    onClick={() => setInput("")}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                                    aria-label="入力を削除"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            )}
                        </div>

                        <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className={cn(
                                "h-12 w-12 rounded-xl border-slate-600 transition-all",
                                isRecording
                                    ? "bg-red-500 border-red-500 text-white hover:bg-red-600 hover:border-red-600 animate-pulse"
                                    : isTranscribing
                                        ? "bg-amber-500 border-amber-500 text-white"
                                        : "bg-slate-700/50 text-slate-300 hover:bg-slate-600 hover:text-white"
                            )}
                            onClick={handleMicClick}
                            disabled={isTranscribing || status !== "ready"}
                        >
                            {isTranscribing ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                            ) : isRecording ? (
                                <MicOff className="h-5 w-5" />
                            ) : (
                                <Mic className="h-5 w-5" />
                            )}
                        </Button>

                        <Button
                            type="submit"
                            disabled={status !== "ready" || !input.trim()}
                            className="h-12 w-12 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white shadow-lg shadow-emerald-500/25 disabled:opacity-50 disabled:shadow-none transition-all"
                        >
                            <Send className="h-5 w-5" />
                        </Button>
                    </div>

                    <p className="text-xs text-slate-500 mt-2 text-center">
                        Enter で送信 / Shift + Enter で改行 / マイクボタンで音声入力(スペースキーでも可)
                    </p>
                </form>
            </div>
        </div>
    );
}
