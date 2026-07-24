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
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  fcmKey: string;
  apnsKey: string;
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
const placeholderSmtpHost = "dev-placeholder-smtp-host";
const placeholderSmtpUser = "dev-placeholder-smtp-user";
const placeholderSmtpPass = "dev-placeholder-smtp-pass";
const placeholderFcmKey = "dev-placeholder-fcm-key";
const placeholderApnsKey = "dev-placeholder-apns-key";
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

function parseOpenrouterApiKey(
  rawKey: string | undefined,
  isTestEnv: boolean,
): string {
  return parseRequiredNonEmpty(
    "OPENROUTER_API_KEY",
    rawKey,
    isTestEnv,
    placeholderOpenrouterApiKey,
  );
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
  const openrouterApiKey = parseOpenrouterApiKey(
    environment.OPENROUTER_API_KEY,
    isTestEnv,
  );
  const docusignIntegrationKey = parseRequiredNonEmpty(
    "DOCUSIGN_INTEGRATION_KEY",
    environment.DOCUSIGN_INTEGRATION_KEY,
    isTestEnv,
    placeholderDocusignIntegrationKey,
  );
  const docusignClientSecret = parseRequiredNonEmpty(
    "DOCUSIGN_CLIENT_SECRET",
    environment.DOCUSIGN_CLIENT_SECRET,
    isTestEnv,
    placeholderDocusignClientSecret,
  );
  const docusignAccountId = parseRequiredNonEmpty(
    "DOCUSIGN_ACCOUNT_ID",
    environment.DOCUSIGN_ACCOUNT_ID,
    isTestEnv,
    placeholderDocusignAccountId,
  );
  const docusignBasePath = parseRequiredNonEmpty(
    "DOCUSIGN_BASE_PATH",
    environment.DOCUSIGN_BASE_PATH,
    isTestEnv,
    placeholderDocusignBasePath,
  );
  const docusignWebhookSecret = parseRequiredNonEmpty(
    "DOCUSIGN_WEBHOOK_SECRET",
    environment.DOCUSIGN_WEBHOOK_SECRET,
    isTestEnv,
    placeholderDocusignWebhookSecret,
  );
  const docusignUserId = parseRequiredNonEmpty(
    "DOCUSIGN_USER_ID",
    environment.DOCUSIGN_USER_ID,
    isTestEnv,
    placeholderDocusignUserId,
  );
  const docusignOauthBase = parseRequiredNonEmpty(
    "DOCUSIGN_OAUTH_BASE",
    environment.DOCUSIGN_OAUTH_BASE,
    isTestEnv,
    placeholderDocusignOauthBase,
  );
  const docusignPrivateKey = parseRequiredNonEmpty(
    "DOCUSIGN_PRIVATE_KEY",
    environment.DOCUSIGN_PRIVATE_KEY,
    isTestEnv,
    placeholderDocusignPrivateKey,
  );
  const smtpHost = parseRequiredNonEmpty(
    "SMTP_HOST",
    environment.SMTP_HOST,
    isTestEnv,
    placeholderSmtpHost,
  );
  const smtpUser = parseRequiredNonEmpty(
    "SMTP_USER",
    environment.SMTP_USER,
    isTestEnv,
    placeholderSmtpUser,
  );
  const smtpPass = parseRequiredNonEmpty(
    "SMTP_PASS",
    environment.SMTP_PASS,
    isTestEnv,
    placeholderSmtpPass,
  );
  const fcmKey = parseRequiredNonEmpty(
    "FCM_KEY",
    environment.FCM_KEY,
    isTestEnv,
    placeholderFcmKey,
  );
  const apnsKey = parseRequiredNonEmpty(
    "APNS_KEY",
    environment.APNS_KEY,
    isTestEnv,
    placeholderApnsKey,
  );
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
    smtpHost,
    smtpPort,
    smtpUser,
    smtpPass,
    fcmKey,
    apnsKey,
  };
}
