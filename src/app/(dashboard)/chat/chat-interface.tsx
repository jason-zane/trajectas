"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Bot, User, Loader2, RotateCcw, StopCircle, Database, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { randomId } from "@/lib/ids";
import { cancellableFetch, isAbortError } from "@/lib/net/cancellable-fetch";
import { ModelPickerCombobox } from "../settings/models/model-picker-combobox";
import { EntityLinksBlockView } from "@/components/chat/entity-links-block";
import { ChatScoreCard } from "@/components/chat/chat-score-card";
import { CampaignSummaryCard } from "@/components/chat/campaign-summary-card";
import { TimelineCard } from "@/components/chat/timeline-card";
import { ComparisonCard } from "@/components/chat/comparison-card";
import { readChatFrames } from "@/lib/chat/stream-client";
import type { ChatBlock } from "@/lib/chat/envelope";
import type { OpenRouterModel } from "@/types/generation";

type ChatMode = "general" | "data";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** Structured payloads rendered as cards, never as prose. */
  blocks?: ChatBlock[];
  /** Transient progress label while tools run. */
  status?: string | null;
}

interface ChatInterfaceProps {
  defaultModel: string;
  /** Data mode is configured separately so a tool-capable model can be pinned. */
  defaultDataModel: string;
  models: OpenRouterModel[];
}

export function ChatInterface({
  defaultModel,
  defaultDataModel,
  models,
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  // One model per mode. Sending the general-chat model in data mode would
  // override the separately configured chat_data model on every request —
  // making that setting inert, and 400-ing whenever the general model cannot
  // call tools.
  const [modelByMode, setModelByMode] = useState<Record<ChatMode, string>>({
    general: defaultModel,
    data: defaultDataModel,
  });
  const [mode, setMode] = useState<ChatMode>("general");
  const selectedModel = modelByMode[mode];
  const setSelectedModel = useCallback(
    (model: string) => setModelByMode((prev) => ({ ...prev, [mode]: model })),
    [mode]
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const selectedModelName =
    models.find((m) => m.id === selectedModel)?.name ?? selectedModel;
  const isConfigured = Boolean(selectedModel);

  async function handleSubmit() {
    const trimmed = input.trim();
    if (!trimmed || isStreaming || !isConfigured) return;

    const userMsg: Message = {
      id: randomId(),
      role: "user",
      content: trimmed,
    };

    const assistantMsg: Message = {
      id: randomId(),
      role: "assistant",
      content: "",
    };

    const updatedMessages = [...messages, userMsg];
    setMessages([...updatedMessages, assistantMsg]);
    setInput("");
    setIsStreaming(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await cancellableFetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updatedMessages.map((m) => ({
            role: m.role,
            content: m.content,
            // Replay the cards the user saw so follow-ups like "the second
            // one" can still resolve to a real id.
            ...(m.blocks?.length ? { blocks: m.blocks } : {}),
          })),
          model: selectedModel,
          mode,
        }),
        controller,
      });

      if (!response.ok) {
        const errorText = await response.text();
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id
              ? { ...m, content: `Error: ${errorText || response.statusText}` }
              : m
          )
        );
        setIsStreaming(false);
        return;
      }

      if (!response.body) {
        setIsStreaming(false);
        return;
      }

      if (mode === "data") {
        let accumulated = "";
        const blocks: ChatBlock[] = [];
        for await (const frame of readChatFrames(response.body)) {
          if (frame.type === "text") {
            accumulated += frame.delta;
          } else if (frame.type === "block") {
            blocks.push(frame.block);
          } else if (frame.type === "error") {
            accumulated += `\n\n[Error: ${frame.message}]`;
          }
          const content = accumulated;
          const currentBlocks = [...blocks];
          const status = frame.type === "status" ? frame.label : null;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsg.id
                ? {
                    ...m,
                    content,
                    blocks: currentBlocks,
                    status: content ? null : status ?? m.status,
                  }
                : m
            )
          );
        }
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantMsg.id ? { ...m, status: null } : m))
        );
      } else {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          accumulated += decoder.decode(value, { stream: true });
          const current = accumulated;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsg.id ? { ...m, content: current } : m
            )
          );
        }
      }
    } catch (error) {
      if (isAbortError(error)) {
        // User clicked Stop. Preserve whatever streamed so far; append a
        // small note so the cancellation is visible in the transcript.
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id
              ? { ...m, content: m.content + (m.content ? "\n\n[stopped]" : "[stopped]") }
              : m
          )
        );
      } else {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id
              ? {
                  ...m,
                  content: `Error: ${error instanceof Error ? error.message : "Failed to connect"}`,
                }
              : m
          )
        );
      }
    } finally {
      abortControllerRef.current = null;
      setIsStreaming(false);
    }
  }

  function handleStop() {
    abortControllerRef.current?.abort();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  function handleClear() {
    setMessages([]);
  }

  return (
    <div className="flex flex-col h-full rounded-xl border border-border bg-card overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-2.5">
        <div
          role="group"
          aria-label="Chat mode"
          className="flex shrink-0 items-center rounded-lg border border-border p-0.5"
        >
          {([
            { value: "general", label: "General", Icon: MessageSquare },
            { value: "data", label: "Data", Icon: Database },
          ] as const).map(({ value, label, Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              disabled={isStreaming}
              aria-pressed={mode === value}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50",
                mode === value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="size-3.5" />
              {label}
            </button>
          ))}
        </div>
        <div className="flex-1 min-w-0 max-w-xs">
          <ModelPickerCombobox
            value={selectedModel}
            onChange={setSelectedModel}
            models={models}
            disabled={isStreaming}
          />
        </div>
        {messages.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            disabled={isStreaming}
            className="shrink-0 gap-1.5 text-muted-foreground"
          >
            <RotateCcw className="size-3.5" />
            Clear
          </Button>
        )}
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 mb-4">
              <Bot className="size-7 text-primary" />
            </div>
            <h3 className="text-lg font-semibold tracking-tight">
              {mode === "data" ? "Ask about your data" : "AI Chat"}
            </h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-md">
              {mode === "data"
                ? "Find people, campaigns and assessments in the platform. Answers come from the database and link back to the page that shows them."
                : "Ask about psychometrics, assessment design, competency frameworks, or anything else."}{" "}
              {isConfigured ? `Using ${selectedModelName}.` : "Configure a chat model in Settings before sending messages."}
            </p>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              "flex gap-3",
              message.role === "user"
                ? "ml-auto max-w-[85%] flex-row-reverse"
                : "max-w-[85%]"
            )}
          >
            <div
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-lg",
                message.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted"
              )}
            >
              {message.role === "user" ? (
                <User className="size-4" />
              ) : (
                <Bot className="size-4" />
              )}
            </div>
            <div className="flex min-w-0 flex-col gap-2">
              {message.blocks?.map((block, i) => {
                const key = `${message.id}-block-${i}`;
                if (block.kind === "entity_links") {
                  return (
                    <EntityLinksBlockView
                      key={key}
                      title={block.title}
                      links={block.links}
                    />
                  );
                }
                if (block.kind === "score_card") {
                  return <ChatScoreCard key={key} block={block} />;
                }
                if (block.kind === "campaign_summary") {
                  return <CampaignSummaryCard key={key} block={block} />;
                }
                if (block.kind === "timeline") {
                  return <TimelineCard key={key} block={block} />;
                }
                if (block.kind === "comparison") {
                  return <ComparisonCard key={key} block={block} />;
                }
                // Unknown block kind from a newer server: ignore rather than crash.
                return null;
              })}
              {(message.content || message.role === "user" || !message.blocks?.length) && (
                <div
                  className={cn(
                    "rounded-xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap",
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  )}
                >
                  {message.content || (
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" />
                      {message.status ? (
                        <span className="text-xs">{message.status}</span>
                      ) : null}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-border p-4">
        <div className="flex gap-2 items-end">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              !isConfigured
                ? "No chat model configured"
                : mode === "data"
                  ? "Ask about a person, campaign or assessment..."
                  : "Type a message..."
            }
            rows={1}
            className="min-h-[44px] max-h-[120px] resize-none"
            disabled={isStreaming || !isConfigured}
          />
          {isStreaming ? (
            <Button
              type="button"
              variant="outline"
              onClick={handleStop}
              size="icon"
              className="size-[44px] shrink-0"
              aria-label="Stop generating"
            >
              <StopCircle className="size-4" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={!input.trim() || !isConfigured}
              size="icon"
              className="size-[44px] shrink-0"
              aria-label="Send message"
            >
              <Send className="size-4" />
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
