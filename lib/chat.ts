import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { queryPostgresTool } from "@/lib/query-postgres-tool";
import { getSchemaDDL } from "@/lib/o2c-schema";

export type ChatRequestMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ChatResponsePayload = {
  answer: string;
  referenced_node_ids: string[];
  sql_queries: string[];
};

function getOpenRouterModel() {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is required.");
  }

  const provider = createOpenAI({
    apiKey,
    baseURL: "https://openrouter.ai/api/v1",
    headers: {
      "HTTP-Referer": process.env.OPENROUTER_SITE_URL ?? "http://localhost:3000",
      "X-Title": "Context Graph System",
    },
  });

  return provider(process.env.OPENROUTER_MODEL ?? "google/gemini-2.5-flash");
}

function buildSystemPrompt() {
  return `
You are the query assistant for a PostgreSQL-backed Order-to-Cash context graph system.

Hard guardrails:
- Answer only questions about the provided order-to-cash dataset and schema.
- If the user asks for general knowledge or anything outside this dataset, respond exactly with:
  "This system is designed to answer questions related to the provided dataset only."
- Never fabricate facts that are not grounded in database results.
- Use the queryPostgresTool whenever database inspection is needed.
- Only generate read-only SQL.

Node ID conventions for referenced_node_ids:
- customers:<customer_id>
- products:<product_id>
- sales_orders:<sales_order_id>
- deliveries:<delivery_id>
- billing_documents:<billing_document_id>
- journal_entries:<company_code>:<fiscal_year>:<accounting_document_id>:<accounting_document_item_id>

When you answer, return JSON only with this exact shape:
{
  "answer": "short grounded answer",
  "referenced_node_ids": ["table:id"],
  "sql_queries": ["the SQL you used"]
}

Prefer concise business answers, and include only node IDs that are directly relevant.

Here is the database schema DDL:
${getSchemaDDL()}
  `.trim();
}

function extractJsonBlock(text: string) {
  const match = text.match(/\{[\s\S]*\}$/);
  if (!match) {
    throw new Error("Model response did not contain JSON.");
  }
  return match[0];
}

export async function answerDatasetQuestion(messages: ChatRequestMessage[]): Promise<ChatResponsePayload> {
  const result = await generateText({
    model: getOpenRouterModel(),
    system: buildSystemPrompt(),
    messages,
    tools: {
      queryPostgresTool,
    },
    temperature: 0,
  });

  const text = result.text.trim();
  const parsed = JSON.parse(extractJsonBlock(text)) as Partial<ChatResponsePayload>;
  const toolSql = result.steps
    .flatMap((step) => step.toolResults ?? [])
    .map((toolResult) => {
      const output = toolResult.output as { sql?: string } | undefined;
      return output?.sql;
    })
    .filter((value): value is string => Boolean(value));

  return {
    answer: parsed.answer ?? "I could not produce a grounded answer.",
    referenced_node_ids: Array.isArray(parsed.referenced_node_ids) ? parsed.referenced_node_ids : [],
    sql_queries:
      Array.isArray(parsed.sql_queries) && parsed.sql_queries.length > 0 ? parsed.sql_queries : toolSql,
  };
}
