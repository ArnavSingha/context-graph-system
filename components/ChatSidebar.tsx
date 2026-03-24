"use client";

import { DefaultChatTransport, type UIMessage } from "ai";
import { useChat } from "@ai-sdk/react";
import { useEffect, useMemo, useState } from "react";

type ChatSidebarProps = {
  setHighlightedNodes: React.Dispatch<React.SetStateAction<string[]>>;
};

const HIGHLIGHT_PATTERN = /\b(?:order|cust|delivery|billing)_[A-Za-z0-9_-]+\b/g;
const REFERENCES_BLOCK_PATTERN = /\[REFERENCES:\s*([^[\]]+)\]/i;

export function ChatSidebar({ setHighlightedNodes }: ChatSidebarProps) {
  const [input, setInput] = useState("");
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
      }),
    [],
  );
  const { messages, sendMessage, status } = useChat({
    transport,
  });

  const isLoading = status === "submitted" || status === "streaming";

  function handleInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    setInput(event.target.value);
  }

  async function handleSubmit(event?: { preventDefault?: () => void }) {
    event?.preventDefault?.();

    const trimmed = input.trim();
    if (!trimmed) {
      return;
    }

    await sendMessage({ text: trimmed });
    setInput("");
  }

  useEffect(() => {
    const latestAssistantMessage = [...messages].reverse().find((message) => message.role === "assistant");

    if (!latestAssistantMessage) {
      return;
    }

    const content = getMessageText(latestAssistantMessage);
    const references = extractReferences(content);

    if (references.length > 0) {
      setHighlightedNodes(references);
      return;
    }

    const matches = content.match(HIGHLIGHT_PATTERN) ?? [];
    setHighlightedNodes(Array.from(new Set(matches)));
  }, [messages, setHighlightedNodes]);

  return (
    <div className="flex h-full flex-col bg-[#fcfcfb]">
      <div className="border-b border-neutral-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-neutral-900">Chat with Graph</h2>
        <p className="mt-1 text-xs text-neutral-500">Order to Cash</p>
      </div>

      <div className="border-b border-neutral-200 px-4 py-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-950 text-sm font-semibold text-white">
            D
          </div>
          <div>
            <p className="text-base font-semibold text-neutral-900">Dodge AI</p>
            <p className="text-xs text-neutral-500">Graph Agent</p>
          </div>
        </div>
        <p className="mt-4 text-sm leading-6 text-neutral-800">
          Hi! I can help you analyze the Order to Cash process.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="space-y-4">
          {messages.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-neutral-200 bg-white px-4 py-5 text-sm text-neutral-500">
              Analyze anything
            </div>
          ) : null}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                  message.role === "user"
                    ? "bg-neutral-900 text-white"
                    : "bg-white text-neutral-800 ring-1 ring-neutral-200"
                }`}
              >
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.2em] opacity-60">
                  {message.role === "user" ? "You" : "Dodge AI"}
                </p>
                <p className="whitespace-pre-wrap leading-6">{getDisplayMessageText(message)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-neutral-200 p-4">
        <div className="rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm">
          <div className="mb-3 flex items-center gap-2 text-xs text-neutral-600">
            <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
            Dodge AI is awaiting instructions
          </div>

          <form onSubmit={handleSubmit}>
            <div className="space-y-3">
              <textarea
                name="prompt"
                value={input}
                onChange={(event) =>
                  handleInputChange(event as unknown as React.ChangeEvent<HTMLInputElement>)
                }
                placeholder="Analyze anything"
                className="min-h-28 w-full resize-none rounded-xl border border-transparent bg-transparent px-1 py-1 text-sm text-neutral-800 outline-none placeholder:text-neutral-400"
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isLoading || input.trim().length === 0}
                  className="rounded-xl bg-neutral-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isLoading ? "Thinking..." : "Send"}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function getMessageText(message: UIMessage) {
  return message.parts
    .filter((part): part is Extract<UIMessage["parts"][number], { type: "text" }> => part.type === "text")
    .map((part) => part.text)
    .join("");
}

function getDisplayMessageText(message: UIMessage) {
  return getMessageText(message).replace(REFERENCES_BLOCK_PATTERN, "").trim();
}

function extractReferences(messageText: string) {
  const match = messageText.match(REFERENCES_BLOCK_PATTERN);

  if (!match) {
    return extractContextualNodeIds(messageText);
  }

  const rawReferences = match[1]?.trim() ?? "";
  if (!rawReferences || rawReferences.toUpperCase() === "NONE") {
    return [];
  }

  const parsedReferences = rawReferences
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return Array.from(new Set(normalizeReferenceIds(parsedReferences, messageText)));
}

function normalizeReferenceIds(referenceIds: string[], messageText: string) {
  const contextualIds = extractContextualNodeIds(messageText);

  return referenceIds.flatMap((referenceId) => {
    if (HIGHLIGHT_PATTERN.test(referenceId)) {
      HIGHLIGHT_PATTERN.lastIndex = 0;
      return [referenceId];
    }

    HIGHLIGHT_PATTERN.lastIndex = 0;

    const matchingContextualIds = contextualIds.filter((candidate) => candidate.endsWith(`_${referenceId}`));
    if (matchingContextualIds.length > 0) {
      return matchingContextualIds;
    }

    return [];
  });
}

function extractContextualNodeIds(messageText: string) {
  const contextualIds = new Set<string>();

  collectMatches(messageText, /\bsales order\s+(\d+)\b/gi, (id) => contextualIds.add(`order_${id}`));
  collectMatches(messageText, /\bcustomer(?:\s+id)?\s*[:#]?\s*(\d+)\b/gi, (id) => contextualIds.add(`cust_${id}`));
  collectMatches(messageText, /\bdelivery(?:\s+id)?\s*[:#]?\s*(\d+)\b/gi, (id) => contextualIds.add(`delivery_${id}`));
  collectMatches(
    messageText,
    /\b(?:billing document|invoice)(?:\s+id)?\s*[:#]?\s*(\d+)\b/gi,
    (id) => contextualIds.add(`billing_${id}`),
  );

  return Array.from(contextualIds);
}

function collectMatches(
  messageText: string,
  pattern: RegExp,
  onMatch: (id: string) => void,
) {
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(messageText)) !== null) {
    if (match[1]) {
      onMatch(match[1]);
    }
  }
}
