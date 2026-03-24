"use client";

import { useEffect, useState, useTransition } from "react";
import { ChatPanel } from "@/components/chat-panel";
import { GraphPanel } from "@/components/graph-panel";
import type { ChatTurn, GraphPayload } from "@/lib/graph-types";

const INITIAL_ASSISTANT_MESSAGE =
  "Ask about the order-to-cash dataset, like 'Trace sales order 740506' or 'Which billing documents exist for customer 320000082?'";

export function ContextGraphApp() {
  const [graph, setGraph] = useState<GraphPayload>({ nodes: [], links: [] });
  const [messages, setMessages] = useState<ChatTurn[]>([
    {
      id: "assistant-intro",
      role: "assistant",
      content: INITIAL_ASSISTANT_MESSAGE,
      referencedNodeIds: [],
    },
  ]);
  const [highlightedNodeIds, setHighlightedNodeIds] = useState<string[]>([]);
  const [graphError, setGraphError] = useState<string | null>(null);
  const [isLoadingGraph, startGraphLoad] = useTransition();

  useEffect(() => {
    startGraphLoad(async () => {
      try {
        const response = await fetch("/api/graph");
        const payload = (await response.json()) as GraphPayload | { error: string };
        if (!response.ok || "error" in payload) {
          throw new Error("error" in payload ? payload.error : "Failed to fetch graph.");
        }
        setGraph(payload);
      } catch (error) {
        setGraphError(error instanceof Error ? error.message : "Failed to fetch graph.");
      }
    });
  }, []);

  return (
    <main className="grain min-h-screen px-4 py-4 md:px-6 md:py-6">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-7xl flex-col gap-4 lg:grid lg:grid-cols-[1.45fr_0.95fr]">
        <section className="relative overflow-hidden rounded-[28px] border border-[var(--border)] bg-[var(--panel)] shadow-[0_30px_80px_rgba(47,38,29,0.12)] backdrop-blur">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-[var(--muted)]">Context Graph</p>
              <h1 className="font-serif text-2xl text-[var(--text)]">Order-to-Cash Network</h1>
            </div>
            <div className="rounded-full bg-[var(--bg-strong)] px-3 py-1 text-xs text-[var(--muted)]">
              {graph.nodes.length} nodes / {graph.links.length} links
            </div>
          </div>
          <GraphPanel
            graph={graph}
            highlightedNodeIds={highlightedNodeIds}
            isLoading={isLoadingGraph}
            error={graphError}
          />
        </section>

        <section className="overflow-hidden rounded-[28px] border border-[var(--border)] bg-[var(--panel-strong)] shadow-[0_30px_80px_rgba(47,38,29,0.12)] backdrop-blur">
          <ChatPanel
            messages={messages}
            onMessagesChange={setMessages}
            onHighlightChange={setHighlightedNodeIds}
          />
        </section>
      </div>
    </main>
  );
}
