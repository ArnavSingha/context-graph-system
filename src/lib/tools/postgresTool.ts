import { tool } from "ai";
import { z } from "zod";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const DANGEROUS_SQL_PATTERN = /\b(drop|delete|update|insert|alter|truncate)\b/i;

export const queryDatabaseTool = tool({
  description: "Execute a read-only PostgreSQL query to retrieve Order-to-Cash supply chain data.",
  inputSchema: z.object({
    query: z.string().min(1, "SQL query is required."),
  }),
  execute: async ({ query }) => {
    if (DANGEROUS_SQL_PATTERN.test(query)) {
      return { error: "Write operations are strictly prohibited." };
    }

    let client;

    try {
      client = await pool.connect();
      const result = await client.query(query);
      return result.rows;
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Query execution failed.",
      };
    } finally {
      client?.release();
    }
  },
});
