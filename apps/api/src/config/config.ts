export type AppConfig = {
  port: number;
  supabaseJwtSecret: string;
  databaseUrl: string;
};

const defaultPort = 3000;
const minimumPort = 1;
const maximumPort = 65535;
const placeholderSupabaseJwtSecret = "dev-placeholder-secret";
const placeholderDatabaseUrl =
  "postgresql://placeholder:placeholder@localhost:5432/placeholder";
const postgresUrlPattern = /^postgres(ql)?:\/\/.+/;

function parsePort(rawPort: string): number {
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < minimumPort || port > maximumPort) {
    throw new Error(
      `PORT must be a valid port number between ${minimumPort} and ${maximumPort}, received: ${rawPort}`,
    );
  }
  return port;
}

function parseSupabaseJwtSecret(
  rawSecret: string | undefined,
  isProduction: boolean,
): string {
  if (rawSecret && rawSecret.trim().length > 0) {
    return rawSecret;
  }
  if (isProduction) {
    throw new Error("SUPABASE_JWT_SECRET is required and must be non-empty");
  }
  return placeholderSupabaseJwtSecret;
}

function parseDatabaseUrl(
  rawDatabaseUrl: string | undefined,
  isProduction: boolean,
): string {
  if (!rawDatabaseUrl) {
    if (isProduction) {
      throw new Error(
        "DATABASE_URL must be a valid postgres:// or postgresql:// connection string",
      );
    }
    return placeholderDatabaseUrl;
  }
  if (!postgresUrlPattern.test(rawDatabaseUrl)) {
    throw new Error(
      "DATABASE_URL must be a valid postgres:// or postgresql:// connection string",
    );
  }
  return rawDatabaseUrl;
}

export function loadConfig(environment: NodeJS.ProcessEnv): AppConfig {
  const isProduction = environment.NODE_ENV === "production";
  const port = environment.PORT ? parsePort(environment.PORT) : defaultPort;
  const supabaseJwtSecret = parseSupabaseJwtSecret(
    environment.SUPABASE_JWT_SECRET,
    isProduction,
  );
  const databaseUrl = parseDatabaseUrl(environment.DATABASE_URL, isProduction);
  return { port, supabaseJwtSecret, databaseUrl };
}
