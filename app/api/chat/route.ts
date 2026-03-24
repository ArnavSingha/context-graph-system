import { convertToModelMessages, stepCountIs, streamText, type UIMessage } from "ai";
import { readFileSync } from "node:fs";
import path from "node:path";
import { openrouterModel } from "@/src/lib/openrouter";
import { getSystemPrompt } from "@/src/lib/prompt";
import { queryDatabaseTool as queryPostgresTool } from "@/src/lib/tools/postgresTool";

type ChatRequestBody = {
  messages: UIMessage[];
};

export async function POST(req: Request) {
  const { messages } = (await req.json()) as ChatRequestBody;
  const schemaDDL = readFileSync(path.join(process.cwd(), "sql", "schema.sql"), "utf8");

  const result = streamText({
    model: openrouterModel,
    system: getSystemPrompt(schemaDDL),
    messages: await convertToModelMessages(messages),
    tools: {
      queryPostgresTool,
    },
    stopWhen: stepCountIs(4),
    maxOutputTokens: 1200,
    temperature: 0,
  });

  return result.toUIMessageStreamResponse();
}
