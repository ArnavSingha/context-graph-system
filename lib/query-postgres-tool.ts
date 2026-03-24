import { tool } from "ai";
import { z } from "zod";
import { query } from "@/lib/db";

const MUTATION_PATTERN =
  /\b(insert|update|delete|drop|truncate|alter|create|grant|revoke|comment|vacuum|analyze|refresh|merge|copy)\b/i;

function validateReadOnlySql(sql: string) {
  const trimmed = sql.trim().replace(/;+\s*$/, "");

  if (!/^(select|with)\b/i.test(trimmed)) {
    throw new Error("Only SELECT and WITH queries are allowed.");
  }

  if (MUTATION_PATTERN.test(trimmed)) {
    throw new Error("Mutating SQL is not allowed.");
  }

  if (trimmed.split(";").length > 1) {
    throw new Error("Only a single SQL statement is allowed.");
  }

  return trimmed;
}

export const queryPostgresTool = tool({
  description:
    "Execute a single read-only PostgreSQL query against the order-to-cash dataset and return JSON rows. Use only SELECT or WITH queries.",
  inputSchema: z.object({
    sql: z.string().min(1),
  }),
  execute: async ({ sql }) => {
    const validatedSql = validateReadOnlySql(sql);
    const result = await query(validatedSql);

    return {
      sql: validatedSql,
      rowCount: result.rowCount ?? 0,
      rows: result.rows,
    };
  },
});
