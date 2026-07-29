export type AppConfig = {
  port: number;
  supabaseJwtSecret: string;
  databaseUrl: string;
  openrouterApiKey: string;
  docusignIntegrationKey: string;
  docusignClientSecret: string;
  docusignAccountId: string;
  docusignBasePath: string;
  docusignWebhookSecret: string;
  docusignUserId: string;
  docusignOauthBase: string;
  docusignPrivateKey: string;
  mpAccessToken: string;
  mpWebhookSecret: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  fcmKey: string;
  apnsKey: string;
  cronSecret: string;
  corsOrigins: string[];
};

const defaultPort = 3000;
const defaultSmtpPort = 587;
const minimumPort = 1;
const maximumPort = 65535;
const placeholderSupabaseJwtSecret = "dev-placeholder-secret";
const placeholderDatabaseUrl =
  "postgresql://placeholder:placeholder@localhost:5432/placeholder";
const placeholderOpenrouterApiKey = "dev-placeholder-openrouter-key";
const placeholderDocusignIntegrationKey = "dev-placeholder-docusign-key";
const placeholderDocusignClientSecret = "dev-placeholder-docusign-secret";
const placeholderDocusignAccountId = "dev-placeholder-docusign-account";
const placeholderDocusignBasePath = "https://demo.docusign.net/restapi";
const placeholderDocusignWebhookSecret = "dev-placeholder-docusign-webhook";
const placeholderDocusignUserId = "dev-placeholder-docusign-user-id";
const placeholderDocusignOauthBase = "account-d.docusign.com";
const placeholderDocusignPrivateKey = "dev-placeholder-docusign-private-key";
const placeholderMpAccessToken = "dev-placeholder-mp-access-token";
const placeholderMpWebhookSecret = "dev-placeholder-mp-webhook-secret";
const placeholderSmtpHost = "dev-placeholder-smtp-host";
const placeholderSmtpUser = "dev-placeholder-smtp-user";
const placeholderSmtpPass = "dev-placeholder-smtp-pass";
const placeholderFcmKey = "dev-placeholder-fcm-key";
const placeholderApnsKey = "dev-placeholder-apns-key";
const placeholderCronSecret = "dev-placeholder-cron-secret";
const postgresUrlPattern = /^postgres(ql)?:\/\/.+/;

function parsePortNumber(envVarName: string, rawPort: string): number {
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < minimumPort || port > maximumPort) {
    throw new Error(
      `${envVarName} must be a valid port number between ${minimumPort} and ${maximumPort}, received: ${rawPort}`,
    );
  }
  return port;
}

function parseRequiredNonEmpty(
  envVarName: string,
  rawValue: string | undefined,
  isTestEnv: boolean,
  placeholder: string,
): string {
  if (rawValue && rawValue.trim().length > 0) {
    return rawValue;
  }
  if (isTestEnv) {
    return placeholder;
  }
  throw new Error(`${envVarName} is required and must be non-empty`);
}

function parseSupabaseJwtSecret(
  rawSecret: string | undefined,
  isTestEnv: boolean,
): string {
  return parseRequiredNonEmpty(
    "SUPABASE_JWT_SECRET",
    rawSecret,
    isTestEnv,
    placeholderSupabaseJwtSecret,
  );
}

const unconfiguredCredential = "";

function parseOptionalCredential(
  rawValue: string | undefined,
  isTestEnv: boolean,
  placeholder: string,
): string {
  if (rawValue && rawValue.trim().length > 0) {
    return rawValue;
  }
  return isTestEnv ? placeholder : unconfiguredCredential;
}

function parseWithFallback(
  rawValue: string | undefined,
  fallback: string,
): string {
  if (rawValue && rawValue.trim().length > 0) {
    return rawValue;
  }
  return fallback;
}

const originSeparator = ",";

function parseCorsOrigins(rawValue: string | undefined): string[] {
  if (!rawValue) {
    return [];
  }
  return rawValue
    .split(originSeparator)
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

function parseDatabaseUrl(
  rawDatabaseUrl: string | undefined,
  isTestEnv: boolean,
): string {
  if (!rawDatabaseUrl) {
    if (isTestEnv) {
      return placeholderDatabaseUrl;
    }
    throw new Error(
      "DATABASE_URL must be a valid postgres:// or postgresql:// connection string",
    );
  }
  if (!postgresUrlPattern.test(rawDatabaseUrl)) {
    throw new Error(
      "DATABASE_URL must be a valid postgres:// or postgresql:// connection string",
    );
  }
  return rawDatabaseUrl;
}

export function loadConfig(environment: NodeJS.ProcessEnv): AppConfig {
  const isTestEnv = environment.NODE_ENV === "test";
  const port = environment.PORT
    ? parsePortNumber("PORT", environment.PORT)
    : defaultPort;
  const smtpPort = environment.SMTP_PORT
    ? parsePortNumber("SMTP_PORT", environment.SMTP_PORT)
    : defaultSmtpPort;
  const supabaseJwtSecret = parseSupabaseJwtSecret(
    environment.SUPABASE_JWT_SECRET,
    isTestEnv,
  );
  const databaseUrl = parseDatabaseUrl(environment.DATABASE_URL, isTestEnv);
  const openrouterApiKey = parseOptionalCredential(
    environment.OPENROUTER_API_KEY,
    isTestEnv,
    placeholderOpenrouterApiKey,
  );
  const docusignIntegrationKey = parseOptionalCredential(
    environment.DOCUSIGN_INTEGRATION_KEY,
    isTestEnv,
    placeholderDocusignIntegrationKey,
  );
  const docusignClientSecret = parseOptionalCredential(
    environment.DOCUSIGN_CLIENT_SECRET,
    isTestEnv,
    placeholderDocusignClientSecret,
  );
  const docusignAccountId = parseOptionalCredential(
    environment.DOCUSIGN_ACCOUNT_ID,
    isTestEnv,
    placeholderDocusignAccountId,
  );
  const docusignBasePath = parseWithFallback(
    environment.DOCUSIGN_BASE_PATH,
    placeholderDocusignBasePath,
  );
  const docusignWebhookSecret = parseOptionalCredential(
    environment.DOCUSIGN_WEBHOOK_SECRET,
    isTestEnv,
    placeholderDocusignWebhookSecret,
  );
  const docusignUserId = parseOptionalCredential(
    environment.DOCUSIGN_USER_ID,
    isTestEnv,
    placeholderDocusignUserId,
  );
  const docusignOauthBase = parseWithFallback(
    environment.DOCUSIGN_OAUTH_BASE,
    placeholderDocusignOauthBase,
  );
  const docusignPrivateKey = parseOptionalCredential(
    environment.DOCUSIGN_PRIVATE_KEY,
    isTestEnv,
    placeholderDocusignPrivateKey,
  );
  const mpAccessToken = parseOptionalCredential(
    environment.MP_ACCESS_TOKEN,
    isTestEnv,
    placeholderMpAccessToken,
  );
  const mpWebhookSecret = parseOptionalCredential(
    environment.MP_WEBHOOK_SECRET,
    isTestEnv,
    placeholderMpWebhookSecret,
  );
  const smtpHost = parseOptionalCredential(
    environment.SMTP_HOST,
    isTestEnv,
    placeholderSmtpHost,
  );
  const smtpUser = parseOptionalCredential(
    environment.SMTP_USER,
    isTestEnv,
    placeholderSmtpUser,
  );
  const smtpPass = parseOptionalCredential(
    environment.SMTP_PASS,
    isTestEnv,
    placeholderSmtpPass,
  );
  const fcmKey = parseOptionalCredential(
    environment.FCM_KEY,
    isTestEnv,
    placeholderFcmKey,
  );
  const apnsKey = parseOptionalCredential(
    environment.APNS_KEY,
    isTestEnv,
    placeholderApnsKey,
  );
  const cronSecret = parseRequiredNonEmpty(
    "CRON_SECRET",
    environment.CRON_SECRET,
    isTestEnv,
    placeholderCronSecret,
  );
  const corsOrigins = parseCorsOrigins(environment.CORS_ORIGINS);
  return {
    port,
    supabaseJwtSecret,
    databaseUrl,
    openrouterApiKey,
    docusignIntegrationKey,
    docusignClientSecret,
    docusignAccountId,
    docusignBasePath,
    docusignWebhookSecret,
    docusignUserId,
    docusignOauthBase,
    docusignPrivateKey,
    mpAccessToken,
    mpWebhookSecret,
    smtpHost,
    smtpPort,
    smtpUser,
    smtpPass,
    fcmKey,
    apnsKey,
    cronSecret,
    corsOrigins,
  };
}
