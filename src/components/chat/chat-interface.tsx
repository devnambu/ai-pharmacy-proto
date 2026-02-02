"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Mic, User, Bot } from "lucide-react";
import { cn } from "@/lib/utils";

export function ChatInterface() {
    const { messages, sendMessage, status } = useChat({
        transport: new DefaultChatTransport({
            api: "/api/chat",
        }),
    });

    const [input, setInput] = useState("");
    const scrollRef = useRef<HTMLDivElement>(null);

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
                    <div className="flex gap-3 items-end">
                        <div className="flex-1 relative">
                            <textarea
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="服薬指導のメッセージを入力..."
                                rows={1}
                                className="w-full resize-none rounded-xl border border-slate-600 bg-slate-700/50 px-4 py-3 text-white placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                                        e.preventDefault();
                                        handleSubmit(e);
                                    }
                                }}
                                disabled={status !== "ready"}
                            />
                        </div>

                        <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-12 w-12 rounded-xl border-slate-600 bg-slate-700/50 text-slate-300 hover:bg-slate-600 hover:text-white transition-all"
                            onClick={() => {
                                alert("音声入力機能は今後実装予定です");
                            }}
                        >
                            <Mic className="h-5 w-5" />
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
                        Enter で送信 / Shift + Enter で改行
                    </p>
                </form>
            </div>
        </div>
    );
}
