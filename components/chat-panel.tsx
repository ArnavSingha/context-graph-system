"use client";

import { useState, useTransition } from "react";
import type { ChatTurn } from "@/lib/graph-types";

type ChatPanelProps = {
  messages: ChatTurn[];
  onMessagesChange: React.Dispatch<React.SetStateAction<ChatTurn[]>>;
  onHighlightChange: (nodeIds: string[]) => void;
};

type ChatApiResponse = {
  answer: string;
  referenced_node_ids: string[];
  sql_queries: string[];
  error?: string;
};

export function ChatPanel({ messages, onMessagesChange, onHighlightChange }: ChatPanelProps) {
  const [input, setInput] = useState("");
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmed = input.trim();
    if (!trimmed) {
      return;
    }

    const userMessage: ChatTurn = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmed,
    };

    onMessagesChange((current) => [...current, userMessage]);
    setInput("");

    startTransition(async () => {
      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messages: [...messages, userMessage].map((message) => ({
              role: message.role,
              content: message.content,
            })),
          }),
        });

        const payload = (await response.json()) as ChatApiResponse;
        if (!response.ok || payload.error) {
          throw new Error(payload.error ?? "Chat request failed.");
        }

        const assistantMessage: ChatTurn = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: payload.answer,
          referencedNodeIds: payload.referenced_node_ids,
          sql: payload.sql_queries,
        };

        onMessagesChange((current) => [...current, assistantMessage]);
        onHighlightChange(payload.referenced_node_ids);
      } catch (error) {
        const assistantMessage: ChatTurn = {
          id: `assistant-error-${Date.now()}`,
          role: "assistant",
          content: error instanceof Error ? error.message : "Chat request failed.",
          referencedNodeIds: [],
        };

        onMessagesChange((current) => [...current, assistantMessage]);
        onHighlightChange([]);
      }
    });
  }

  return (
    <div className="flex h-[70vh] flex-col">
      <div className="border-b border-[var(--border)] px-5 py-4">
        <p className="text-xs uppercase tracking-[0.35em] text-[var(--muted)]">LLM Query Interface</p>
        <h2 className="font-serif text-2xl text-[var(--text)]">Dataset Chat</h2>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
        {messages.map((message) => (
          <article
            key={message.id}
            className={`rounded-3xl border px-4 py-3 ${
              message.role === "user"
                ? "ml-8 border-transparent bg-[var(--accent)] text-white"
                : "mr-8 border-[var(--border)] bg-white/70 text-[var(--text)]"
            }`}
          >
            <p className="text-xs uppercase tracking-[0.2em] opacity-70">{message.role}</p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{message.content}</p>
            {message.referencedNodeIds && message.referencedNodeIds.length > 0 ? (
              <p className="mt-3 text-xs text-[var(--muted)]">
                Highlighted: {message.referencedNodeIds.join(", ")}
              </p>
            ) : null}
            {message.sql && message.sql.length > 0 ? (
              <details className="mt-3 text-xs text-[var(--muted)]">
                <summary className="cursor-pointer">SQL used</summary>
                <pre className="mt-2 overflow-x-auto rounded-2xl bg-stone-950/90 p-3 text-stone-100">
                  {message.sql.join("\n\n")}
                </pre>
              </details>
            ) : null}
          </article>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="border-t border-[var(--border)] p-4">
        <div className="rounded-[26px] border border-[var(--border)] bg-white/70 p-2 shadow-inner">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask about a customer, sales order, delivery, billing document, or payment flow…"
            className="min-h-28 w-full resize-none rounded-[20px] bg-transparent px-3 py-3 text-sm outline-none placeholder:text-[var(--muted)]"
          />
          <div className="flex items-center justify-between px-2 pb-1 pt-2">
            <p className="text-xs text-[var(--muted)]">The assistant only answers dataset-grounded O2C questions.</p>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-full bg-[var(--accent-2)] px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? "Thinking…" : "Send"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
