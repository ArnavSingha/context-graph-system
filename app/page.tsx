"use client";

import { useState } from "react";
import { ChatSidebar } from "@/components/ChatSidebar";
import { GraphView } from "@/components/GraphView";

export default function HomePage() {
  const [highlightedNodes, setHighlightedNodes] = useState<string[]>([]);

  return (
    <main className="min-h-screen w-full bg-[#f7f7f5] text-[#161616]">
      <header className="flex h-14 items-center border-b border-neutral-200 bg-[#f7f7f5] px-4">
        <div className="mr-3 flex h-7 w-7 items-center justify-center rounded-md border border-neutral-300 bg-white text-neutral-700">
          <span className="text-xs">◧</span>
        </div>
        <div className="text-sm text-neutral-400">
          <span>Mapping</span>
          <span className="px-2">/</span>
          <span className="font-semibold text-neutral-800">Order to Cash</span>
        </div>
      </header>

      <div className="h-[calc(100vh-56px)] p-3">
        <div className="grid h-full grid-cols-1 gap-3 lg:grid-cols-[1fr_310px]">
          <section className="min-h-[55vh] overflow-hidden rounded-sm border border-neutral-200 bg-white">
            <GraphView highlightedNodes={highlightedNodes} />
          </section>
          <aside className="min-h-[35vh] overflow-hidden rounded-sm border border-neutral-200 bg-white">
            <ChatSidebar setHighlightedNodes={setHighlightedNodes} />
          </aside>
        </div>
      </div>
    </main>
  );
}
