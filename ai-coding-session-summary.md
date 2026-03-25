# AI Coding Session & Workflow Summary

## Overview of AI Tools Used
- **Primary IDE/Codex:** Cursor / Windsurf / Claude Code
- **Orchestration / Architecture Planning:** Google Gemini, used for high-level system design, phase planning, and generating master prompts.
- **LLM Provider for the App:** OpenRouter, routing to `meta-llama/llama-3.3-70b-instruct` and/or `anthropic/claude-3.5-sonnet`, integrated via Vercel AI SDK.

## Iteration Patterns & Methodology
Instead of relying on a single zero-shot prompt to generate the entire application, which often leads to hallucinations and broken code, I used a phased master prompting strategy. I broke the architecture down into 5 distinct phases and fed the AI context-heavy, constraint-driven prompts for each phase:

1. **Phase 1: Data Ingestion**  
   Prompted the AI to read the provided CSVs and generate PostgreSQL `CREATE TABLE` and `INSERT` scripts.
2. **Phase 2: AI Orchestration**  
   Prompted the AI to build the `queryPostgresTool` with strict Zod validation and hardcoded security blocks rejecting `DROP`, `UPDATE`, and similar write operations.
3. **Phase 3: Backend API Integration**  
   Prompted the AI to wire up the Vercel AI SDK `streamText` function and handle the `react-force-graph-2d` data payload.
4. **Phase 4: Frontend Visualization**  
   Prompted the AI to build the split-screen Next.js UI.
5. **Phase 5: Polish & UX**  
   Prompted the AI to refine the LLM output format so the UI could seamlessly highlight referenced nodes.

## Key Prompts Used
To keep the AI aligned with the assignment's strict evaluation criteria, I used highly structured prompts.

### Example: Enforcing Guardrails (System Prompt)
> "You are an expert Data Analyst and PostgreSQL Administrator. YOUR CORE DIRECTIVE & GUARDRAILS: You may ONLY answer questions related to the provided dataset (Sales Orders, Deliveries, Invoices, Customers, Products, etc.). If the user asks a general knowledge question, asks for creative writing, or asks about an irrelevant topic, you MUST reply verbatim with: 'This system is designed to answer questions related to the provided dataset only.'"

### Example: PostgreSQL Tool Definition
> "Create `src/lib/tools/queryPostgres.ts`. Add a strict security check: if the query string contains `DROP`, `DELETE`, `UPDATE`, `INSERT`, or `ALTER`, return an error object immediately. Write operations are strictly prohibited. Execute the query and return the rows as a JSON array."

## Debugging Workflow & AI Pair Programming
1. **Server-Side Rendering (SSR) Canvas Crash**  
   **Issue:** `react-force-graph-2d` crashed the Next.js app because it depends on the HTML5 Canvas and `window` object, which do not exist on the server.  
   **AI Debugging:** I prompted the IDE to isolate the graph component and enforce dynamic client-side rendering.  
   **Solution:** The AI implemented `dynamic(() => import('react-force-graph-2d'), { ssr: false });`, which resolved the crash.

2. **Node Highlighting Synchronization**  
   **Issue:** The LLM answered correctly, but the frontend did not know which nodes to highlight on the canvas because the natural-language output was unpredictable.  
   **AI Debugging:** I iterated on the system prompt to require a strict machine-readable suffix.  
   **Solution:** I instructed the LLM to append `[REFERENCES: id1, id2]` to its answers. I then used AI to write a frontend regex parser that extracts these IDs, updates React state, and strips the tag from the visible chat UI.

3. **Graph Traversal via SQL**  
   **Issue:** Translating "Trace the full flow of billing document X" into a standard SQL `JOIN` is insufficient for deep, variable-length graph relationships.  
   **Solution:** I explicitly prompted the AI to use recursive CTEs with `WITH RECURSIVE` so relational foreign keys could be traversed as graph edges dynamically.
