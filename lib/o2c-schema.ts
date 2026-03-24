import { readFileSync } from "node:fs";
import path from "node:path";

let cachedSchema: string | null = null;

export function getSchemaDDL() {
  if (cachedSchema) {
    return cachedSchema;
  }

  cachedSchema = readFileSync(path.join(process.cwd(), "sql", "schema.sql"), "utf8");
  return cachedSchema;
}
