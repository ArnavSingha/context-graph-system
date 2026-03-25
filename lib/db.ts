import { Pool, type PoolConfig, type QueryResultRow } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __contextGraphPool__: Pool | undefined;
}

export function getPool() {
  const connectionString = process.env.DATABASE_URL?.trim();

  if (!connectionString) {
    throw new Error("DATABASE_URL is required.");
  }

  if (connectionString.includes("\n") || connectionString.includes("OPENROUTER_") || connectionString.includes("DATABASE_URL=")) {
    throw new Error(
      "DATABASE_URL is malformed. In Netlify, each environment variable must be entered in its own field.",
    );
  }

  if (!global.__contextGraphPool__) {
    const isLocalConnection =
      connectionString.includes("localhost") || connectionString.includes("127.0.0.1");
    const shouldUseSsl = process.env.PGSSLMODE === "require" || (!isLocalConnection && !connectionString.includes("sslmode="));

    const poolConfig: PoolConfig = {
      connectionString,
    };

    if (shouldUseSsl) {
      poolConfig.ssl = {
        rejectUnauthorized: false,
      };
    }

    global.__contextGraphPool__ = new Pool(poolConfig);
  }

  return global.__contextGraphPool__;
}

export async function query<T extends QueryResultRow = QueryResultRow>(sql: string, values: unknown[] = []) {
  return getPool().query<T>(sql, values);
}
