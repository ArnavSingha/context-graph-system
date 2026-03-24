# Context Graph System

## Project Overview

Context Graph System is a full-stack Order-to-Cash exploration tool that combines PostgreSQL, a tool-calling LLM, and an interactive graph UI. It ingests structured business data such as customers, sales orders, deliveries, billing documents, and accounting records, then allows users to query that dataset in natural language while visually tracing connected entities in a graph.

The system is designed around one core idea: treat the relational Order-to-Cash dataset as a graph of business entities and relationships, then let an LLM generate grounded SQL to answer questions and surface the relevant nodes in the visualization.

## Architecture Decisions

### Why Next.js App Router

We chose Next.js App Router because it gives us a unified full-stack runtime for:

- server-side API routes for chat orchestration and graph data
- client-side React components for the graph and chat UI
- shared TypeScript types and utilities across frontend and backend
- simple deployment and local development with one application boundary

This avoids splitting the system into multiple services too early and keeps the assignment architecture easy to understand, run, and evaluate.

### Why the Vercel AI SDK

We chose the Vercel AI SDK because it provides the exact primitives needed for this type of agentic workflow:

- streaming LLM responses to the UI
- structured tool calling
- multi-step reasoning/tool loops
- clean integration with Next.js App Router

This lets the model generate SQL, call the database tool, inspect results, correct itself when needed, and then return a final user-facing answer in one orchestrated flow.

### Why OpenRouter

We chose OpenRouter so we can access strong open and low-cost models through a single OpenAI-compatible interface. That simplifies model switching and avoids locking the application to a single vendor-specific API shape. In this project, OpenRouter is used through `@ai-sdk/openai` with a custom `baseURL`, which keeps the integration straightforward while still giving model flexibility.

## Database / Storage Choice

We chose PostgreSQL instead of a dedicated graph database such as Neo4j.

This decision was deliberate:

- the source dataset is inherently tabular supply-chain and ERP-style data
- the entities already map naturally to relational tables
- the relationships are well represented through primary keys and foreign keys
- PostgreSQL gives strong maturity, easy local setup, and predictable SQL tooling

A dedicated graph database would introduce additional operational and conceptual overhead, including a separate query language such as Cypher. For this assignment, that tradeoff was unnecessary because modern LLMs are very strong at generating complex SQL, including `JOIN`s and `WITH RECURSIVE` CTEs for graph-like traversals. That means we can preserve a familiar relational storage model while still supporting graph-style tracing across the Order-to-Cash flow.

## LLM Prompting Strategy

The prompting strategy is based on controlled tool use.

The LLM is provided:

- the exact PostgreSQL DDL schema
- a constrained role as a data analyst / database expert
- explicit instructions to use the database tool when data retrieval is needed
- strict domain restrictions so it only answers dataset-related questions

At runtime, the LLM behaves like a lightweight autonomous analyst:

1. It reads the user question.
2. It decides whether a database query is needed.
3. It generates SQL against the provided schema.
4. It calls the PostgreSQL tool.
5. It reads the returned rows.
6. It synthesizes a grounded final answer.

For deeper business-flow tracing, the prompt explicitly encourages `JOIN`s and `WITH RECURSIVE` CTEs so the model can traverse paths such as Sales Order -> Delivery -> Billing -> Journal Entry.

To support graph highlighting in the UI, the prompt also enforces a strict output footer:

```text
[REFERENCES: id1, id2, id3]
```

If no IDs are relevant, the model must emit:

```text
[REFERENCES: NONE]
```

This gives the frontend a predictable contract for extracting node references without depending on brittle natural-language heuristics.

## Guardrails

We use two main categories of guardrails.

### Domain Guardrails

The system prompt hard-restricts the model to the provided dataset. If a user asks for general knowledge, creative writing, or anything unrelated to the Order-to-Cash data, the model is instructed to respond exactly with:

> This system is designed to answer questions related to the provided dataset only.

This keeps the system aligned with the assignment scope and prevents it from drifting into unsupported use cases.

### SQL Safety Guardrails

The PostgreSQL tool is explicitly read-only. Before executing any SQL, it checks for dangerous write-oriented statements such as:

- `DROP`
- `UPDATE`
- `DELETE`
- `INSERT`
- `ALTER`
- `TRUNCATE`

If any of these appear in the generated SQL, the tool refuses to execute the query and returns an error. This prevents the model from mutating the database even if it generates an unsafe statement.

## How to Run Locally

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Create a `.env` file from `.env.example` and set:

```bash
DATABASE_URL=postgresql://...
OPENROUTER_API_KEY=...
```

Optional environment variables:

```bash
OPENROUTER_MODEL=meta-llama/llama-3.3-70b-instruct:free
OPENROUTER_SITE_URL=http://localhost:3000
```

### 3. Ingest the dataset into PostgreSQL

If the database has not already been populated, run:

```bash
npm run import:o2c
```

This creates the schema and imports the Order-to-Cash dataset into PostgreSQL.

### 4. Start the development server

```bash
npm run dev
```

### 5. Open the app

Visit:

```text
http://localhost:3000
```

You should see:

- a graph view on the left populated from `/api/graph`
- a chat interface on the right connected to `/api/chat`

## Deploying to Netlify

Netlify is a good deployment target for this project because it supports modern Next.js App Router features, route handlers, and streaming via its OpenNext-based Next.js adapter. According to the current Netlify documentation, major Next.js features are supported with zero configuration, and the typical build settings for hybrid/SSR apps are:

- build command: `next build`
- publish directory: `.next`

This repository includes a [`netlify.toml`](C:\Users\ARNAV\OneDrive\Documents\GitHub\context graph system\netlify.toml) with those settings so the deploy is explicit and reproducible.

### Important requirement

Your current local PostgreSQL database cannot be reached from Netlify. To deploy this app successfully, you need a hosted PostgreSQL instance, such as Neon, Supabase Postgres, Railway Postgres, Render Postgres, or AWS RDS.

### Netlify deployment steps

1. Push this repository to GitHub, GitLab, or Bitbucket.
2. In Netlify, create a new site from that Git repository.
3. Confirm the build settings:
   `Build command: npm run build`
   `Publish directory: .next`
4. Add these environment variables in the Netlify dashboard:
   `DATABASE_URL`
   `OPENROUTER_API_KEY`
   `OPENROUTER_MODEL`
   `OPENROUTER_SITE_URL`
5. Set `OPENROUTER_SITE_URL` to your Netlify production URL, for example:
   `https://your-site-name.netlify.app`
6. Trigger the deploy.

### Recommended Netlify environment variables

```bash
DATABASE_URL=postgresql://<hosted-postgres-connection-string>
OPENROUTER_API_KEY=<your-openrouter-key>
OPENROUTER_MODEL=google/gemini-2.5-flash
OPENROUTER_SITE_URL=https://your-site-name.netlify.app
```

### Notes

- Keep `DATABASE_URL` and `OPENROUTER_API_KEY` in Netlify environment variables, not in the repo.
- If you use different values for preview and production deployments, Netlify supports contextual environment values.
- Netlify also supports local testing of deployment settings through Netlify CLI and `netlify dev`, but the project can still be developed normally with `npm run dev`.

## Submission Notes

This project is intentionally structured as a single coherent Next.js application so evaluators can inspect:

- relational schema design
- ingestion and database safety
- tool-calling AI orchestration
- graph-oriented frontend interaction
- end-to-end integration between the LLM and the UI

The final result demonstrates how a relational business dataset can be turned into a context graph system without requiring a dedicated graph database, while still supporting natural-language exploration and visual entity highlighting.
