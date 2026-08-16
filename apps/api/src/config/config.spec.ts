import { loadConfig } from "./config";

describe("loadConfig", () => {
  it("defaults the port to 3000 when PORT is not set", () => {
    const appConfig = loadConfig({ NODE_ENV: "test" });

    expect(appConfig.port).toBe(3000);
  });

  it("uses the PORT environment variable when set", () => {
    const appConfig = loadConfig({ NODE_ENV: "test", PORT: "4500" });

    expect(appConfig.port).toBe(4500);
  });

  it("throws when PORT is not a valid number", () => {
    expect(() => loadConfig({ PORT: "not-a-number" })).toThrow(
      "PORT must be a valid port number between 1 and 65535, received: not-a-number",
    );
  });

  it("throws when PORT is out of range", () => {
    expect(() => loadConfig({ PORT: "70000" })).toThrow(
      "PORT must be a valid port number between 1 and 65535, received: 70000",
    );
  });

  it("throws when PORT is zero", () => {
    expect(() => loadConfig({ PORT: "0" })).toThrow(
      "PORT must be a valid port number between 1 and 65535, received: 0",
    );
  });

  it("throws when PORT is negative", () => {
    expect(() => loadConfig({ PORT: "-1" })).toThrow(
      "PORT must be a valid port number between 1 and 65535, received: -1",
    );
  });

  it("throws when PORT is a decimal number", () => {
    expect(() => loadConfig({ PORT: "3000.5" })).toThrow(
      "PORT must be a valid port number between 1 and 65535, received: 3000.5",
    );
  });

  it("accepts PORT at the maximum valid boundary", () => {
    const appConfig = loadConfig({ NODE_ENV: "test", PORT: "65535" });

    expect(appConfig.port).toBe(65535);
  });

  it("throws when PORT is one above the maximum boundary", () => {
    expect(() => loadConfig({ PORT: "65536" })).toThrow(
      "PORT must be a valid port number between 1 and 65535, received: 65536",
    );
  });

  it("throws in production when SUPABASE_JWT_SECRET is missing", () => {
    expect(() =>
      loadConfig({
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://user:pass@host:5432/db",
      }),
    ).toThrow("SUPABASE_JWT_SECRET is required and must be non-empty");
  });

  it("throws in production when SUPABASE_JWT_SECRET is whitespace-only", () => {
    expect(() =>
      loadConfig({
        NODE_ENV: "production",
        SUPABASE_JWT_SECRET: " ",
        DATABASE_URL: "postgresql://user:pass@host:5432/db",
      }),
    ).toThrow("SUPABASE_JWT_SECRET is required and must be non-empty");
  });

  it("throws in production when DATABASE_URL is fully unset", () => {
    expect(() =>
      loadConfig({
        NODE_ENV: "production",
        SUPABASE_JWT_SECRET: "test-secret",
      }),
    ).toThrow(
      "DATABASE_URL must be a valid postgres:// or postgresql:// connection string",
    );
  });

  it("throws in production when DATABASE_URL is malformed", () => {
    expect(() =>
      loadConfig({
        NODE_ENV: "production",
        SUPABASE_JWT_SECRET: "test-secret",
        DATABASE_URL: "not-a-url",
      }),
    ).toThrow(
      "DATABASE_URL must be a valid postgres:// or postgresql:// connection string",
    );
  });

  it("uses safe placeholders when NODE_ENV is test and values are unset", () => {
    const appConfig = loadConfig({ NODE_ENV: "test" });

    expect(appConfig.supabaseJwtSecret).toBe("dev-placeholder-secret");
    expect(appConfig.databaseUrl).toBe(
      "postgresql://placeholder:placeholder@localhost:5432/placeholder",
    );
  });

  it("throws when NODE_ENV is unset and SUPABASE_JWT_SECRET is missing", () => {
    expect(() =>
      loadConfig({ DATABASE_URL: "postgresql://user:pass@host:5432/db" }),
    ).toThrow("SUPABASE_JWT_SECRET is required and must be non-empty");
  });

  it("throws when NODE_ENV is development and SUPABASE_JWT_SECRET is missing", () => {
    expect(() =>
      loadConfig({
        NODE_ENV: "development",
        DATABASE_URL: "postgresql://user:pass@host:5432/db",
      }),
    ).toThrow("SUPABASE_JWT_SECRET is required and must be non-empty");
  });

  it("throws when NODE_ENV is unset and DATABASE_URL is missing", () => {
    expect(() => loadConfig({ SUPABASE_JWT_SECRET: "test-secret" })).toThrow(
      "DATABASE_URL must be a valid postgres:// or postgresql:// connection string",
    );
  });

  it("throws when NODE_ENV is development and DATABASE_URL is missing", () => {
    expect(() =>
      loadConfig({
        NODE_ENV: "development",
        SUPABASE_JWT_SECRET: "test-secret",
      }),
    ).toThrow(
      "DATABASE_URL must be a valid postgres:// or postgresql:// connection string",
    );
  });

  it("accepts explicit values outside production", () => {
    const appConfig = loadConfig({
      NODE_ENV: "test",
      SUPABASE_JWT_SECRET: "my-secret",
      DATABASE_URL: "postgres://user:pass@host:5432/db",
      OPENROUTER_API_KEY: "sk-or-my-key",
      DOCUSIGN_INTEGRATION_KEY: "ik-1",
      DOCUSIGN_CLIENT_SECRET: "secret-1",
      DOCUSIGN_ACCOUNT_ID: "account-1",
      DOCUSIGN_BASE_PATH: "https://na1.docusign.net/restapi",
      DOCUSIGN_WEBHOOK_SECRET: "whsec-1",
    });

    expect(appConfig.supabaseJwtSecret).toBe("my-secret");
    expect(appConfig.databaseUrl).toBe("postgres://user:pass@host:5432/db");
  });

  it("uses a safe placeholder openrouterApiKey when NODE_ENV is test and unset", () => {
    const appConfig = loadConfig({ NODE_ENV: "test" });

    expect(appConfig.openrouterApiKey).toBe("dev-placeholder-openrouter-key");
  });

  it("leaves openrouterApiKey unconfigured in production when OPENROUTER_API_KEY is missing", () => {
    const appConfig = loadConfig({
      NODE_ENV: "production",
      SUPABASE_JWT_SECRET: "test-secret",
      DATABASE_URL: "postgresql://user:pass@host:5432/db",
      CRON_SECRET: "cron-secret",
    });

    expect(appConfig.openrouterApiKey).toBe("");
  });

  it("leaves openrouterApiKey unconfigured in production when OPENROUTER_API_KEY is whitespace-only", () => {
    const appConfig = loadConfig({
      NODE_ENV: "production",
      SUPABASE_JWT_SECRET: "test-secret",
      DATABASE_URL: "postgresql://user:pass@host:5432/db",
      CRON_SECRET: "cron-secret",
      OPENROUTER_API_KEY: " ",
    });

    expect(appConfig.openrouterApiKey).toBe("");
  });

  it("accepts an explicit OPENROUTER_API_KEY outside production", () => {
    const appConfig = loadConfig({
      NODE_ENV: "test",
      SUPABASE_JWT_SECRET: "my-secret",
      DATABASE_URL: "postgres://user:pass@host:5432/db",
      OPENROUTER_API_KEY: "sk-or-my-key",
      DOCUSIGN_INTEGRATION_KEY: "ik-1",
      DOCUSIGN_CLIENT_SECRET: "secret-1",
      DOCUSIGN_ACCOUNT_ID: "account-1",
      DOCUSIGN_BASE_PATH: "https://na1.docusign.net/restapi",
      DOCUSIGN_WEBHOOK_SECRET: "whsec-1",
    });

    expect(appConfig.openrouterApiKey).toBe("sk-or-my-key");
  });

  const docusignEnvVars = [
    { key: "DOCUSIGN_INTEGRATION_KEY", field: "docusignIntegrationKey" },
    { key: "DOCUSIGN_CLIENT_SECRET", field: "docusignClientSecret" },
    { key: "DOCUSIGN_ACCOUNT_ID", field: "docusignAccountId" },
    { key: "DOCUSIGN_WEBHOOK_SECRET", field: "docusignWebhookSecret" },
    { key: "DOCUSIGN_USER_ID", field: "docusignUserId" },
    { key: "DOCUSIGN_PRIVATE_KEY", field: "docusignPrivateKey" },
  ] as const;

  const validDocusignEnv = {
    DOCUSIGN_INTEGRATION_KEY: "ik-1",
    DOCUSIGN_CLIENT_SECRET: "secret-1",
    DOCUSIGN_ACCOUNT_ID: "account-1",
    DOCUSIGN_BASE_PATH: "https://na1.docusign.net/restapi",
    DOCUSIGN_WEBHOOK_SECRET: "whsec-1",
    DOCUSIGN_USER_ID: "user-1",
    DOCUSIGN_OAUTH_BASE: "account-d.docusign.com",
    DOCUSIGN_PRIVATE_KEY: "test-private-key-pem",
  };

  it.each(docusignEnvVars)(
    "leaves $field unconfigured in production when $key is missing",
    ({ key, field }) => {
      const environment: Record<string, string | undefined> = {
        NODE_ENV: "production",
        SUPABASE_JWT_SECRET: "test-secret",
        DATABASE_URL: "postgresql://user:pass@host:5432/db",
        CRON_SECRET: "cron-secret",
        OPENROUTER_API_KEY: "sk-or-test-key",
        ...validDocusignEnv,
      };
      environment[key] = undefined;

      expect(loadConfig(environment)[field]).toBe("");
    },
  );

  it.each(docusignEnvVars)(
    "uses a safe placeholder for $field when NODE_ENV is test and unset",
    ({ field }) => {
      const appConfig = loadConfig({ NODE_ENV: "test" });

      expect(appConfig[field]).toContain("dev-placeholder");
    },
  );

  it("defaults DOCUSIGN_BASE_PATH to the sandbox host in production when missing", () => {
    const appConfig = loadConfig({
      NODE_ENV: "production",
      SUPABASE_JWT_SECRET: "test-secret",
      DATABASE_URL: "postgresql://user:pass@host:5432/db",
      CRON_SECRET: "cron-secret",
      DOCUSIGN_BASE_PATH: undefined,
    });

    expect(appConfig.docusignBasePath).toBe(
      "https://demo.docusign.net/restapi",
    );
  });

  it("uses the real DocuSign sandbox host as the placeholder base path in test", () => {
    const appConfig = loadConfig({ NODE_ENV: "test" });

    expect(appConfig.docusignBasePath).toBe(
      "https://demo.docusign.net/restapi",
    );
  });

  it("accepts explicit DocuSign values outside production", () => {
    const appConfig = loadConfig({
      NODE_ENV: "test",
      SUPABASE_JWT_SECRET: "my-secret",
      DATABASE_URL: "postgres://user:pass@host:5432/db",
      OPENROUTER_API_KEY: "sk-or-my-key",
      DOCUSIGN_INTEGRATION_KEY: "ik-1",
      DOCUSIGN_CLIENT_SECRET: "secret-1",
      DOCUSIGN_ACCOUNT_ID: "account-1",
      DOCUSIGN_BASE_PATH: "https://na1.docusign.net/restapi",
      DOCUSIGN_WEBHOOK_SECRET: "whsec-1",
      DOCUSIGN_USER_ID: "user-1",
      DOCUSIGN_OAUTH_BASE: "account-d.docusign.com",
      DOCUSIGN_PRIVATE_KEY: "test-private-key-pem",
    });

    expect(appConfig.docusignIntegrationKey).toBe("ik-1");
    expect(appConfig.docusignClientSecret).toBe("secret-1");
    expect(appConfig.docusignAccountId).toBe("account-1");
    expect(appConfig.docusignBasePath).toBe("https://na1.docusign.net/restapi");
    expect(appConfig.docusignWebhookSecret).toBe("whsec-1");
    expect(appConfig.docusignUserId).toBe("user-1");
    expect(appConfig.docusignOauthBase).toBe("account-d.docusign.com");
    expect(appConfig.docusignPrivateKey).toBe("test-private-key-pem");
  });

  it("defaults DOCUSIGN_OAUTH_BASE to the sandbox host in production when missing", () => {
    const appConfig = loadConfig({
      NODE_ENV: "production",
      SUPABASE_JWT_SECRET: "test-secret",
      DATABASE_URL: "postgresql://user:pass@host:5432/db",
      CRON_SECRET: "cron-secret",
      DOCUSIGN_OAUTH_BASE: undefined,
    });

    expect(appConfig.docusignOauthBase).toBe("account-d.docusign.com");
  });

  it("uses the DocuSign sandbox host as the placeholder oauth base in test", () => {
    const appConfig = loadConfig({ NODE_ENV: "test" });

    expect(appConfig.docusignOauthBase).toBe("account-d.docusign.com");
  });

  it("defaults SMTP_PORT to 587 when unset", () => {
    const appConfig = loadConfig({ NODE_ENV: "test" });

    expect(appConfig.smtpPort).toBe(587);
  });

  it("uses the SMTP_PORT environment variable when set", () => {
    const appConfig = loadConfig({ NODE_ENV: "test", SMTP_PORT: "2525" });

    expect(appConfig.smtpPort).toBe(2525);
  });

  it("throws when SMTP_PORT is not a valid number", () => {
    expect(() => loadConfig({ SMTP_PORT: "not-a-number" })).toThrow(
      "SMTP_PORT must be a valid port number between 1 and 65535, received: not-a-number",
    );
  });

  it("throws when SMTP_PORT is out of range", () => {
    expect(() => loadConfig({ SMTP_PORT: "70000" })).toThrow(
      "SMTP_PORT must be a valid port number between 1 and 65535, received: 70000",
    );
  });

  it("uses a safe placeholder smtpHost when NODE_ENV is test and unset", () => {
    const appConfig = loadConfig({ NODE_ENV: "test" });

    expect(appConfig.smtpHost).toBe("dev-placeholder-smtp-host");
  });

  const optionalCredentialEnvVars = [
    { key: "SMTP_HOST", field: "smtpHost" },
    { key: "SMTP_USER", field: "smtpUser" },
    { key: "SMTP_PASS", field: "smtpPass" },
    { key: "FCM_KEY", field: "fcmKey" },
    { key: "APNS_KEY", field: "apnsKey" },
    { key: "MP_ACCESS_TOKEN", field: "mpAccessToken" },
    { key: "MP_WEBHOOK_SECRET", field: "mpWebhookSecret" },
  ] as const;

  it.each(optionalCredentialEnvVars)(
    "leaves $field unconfigured in production when $key is missing",
    ({ field }) => {
      const appConfig = loadConfig({
        NODE_ENV: "production",
        SUPABASE_JWT_SECRET: "test-secret",
        DATABASE_URL: "postgresql://user:pass@host:5432/db",
        CRON_SECRET: "cron-secret",
      });

      expect(appConfig[field]).toBe("");
    },
  );

  it("accepts an explicit SMTP_HOST outside production", () => {
    const appConfig = loadConfig({
      NODE_ENV: "test",
      SUPABASE_JWT_SECRET: "my-secret",
      DATABASE_URL: "postgres://user:pass@host:5432/db",
      SMTP_HOST: "smtp.example.com",
    });

    expect(appConfig.smtpHost).toBe("smtp.example.com");
  });

  it("uses a safe placeholder smtpUser when NODE_ENV is test and unset", () => {
    const appConfig = loadConfig({ NODE_ENV: "test" });

    expect(appConfig.smtpUser).toBe("dev-placeholder-smtp-user");
  });

  it("accepts an explicit SMTP_USER outside production", () => {
    const appConfig = loadConfig({
      NODE_ENV: "test",
      SUPABASE_JWT_SECRET: "my-secret",
      DATABASE_URL: "postgres://user:pass@host:5432/db",
      SMTP_USER: "smtp-user",
    });

    expect(appConfig.smtpUser).toBe("smtp-user");
  });

  it("uses a safe placeholder smtpPass when NODE_ENV is test and unset", () => {
    const appConfig = loadConfig({ NODE_ENV: "test" });

    expect(appConfig.smtpPass).toBe("dev-placeholder-smtp-pass");
  });

  it("accepts an explicit SMTP_PASS outside production", () => {
    const appConfig = loadConfig({
      NODE_ENV: "test",
      SUPABASE_JWT_SECRET: "my-secret",
      DATABASE_URL: "postgres://user:pass@host:5432/db",
      SMTP_PASS: "smtp-pass",
    });

    expect(appConfig.smtpPass).toBe("smtp-pass");
  });

  it("uses a safe placeholder fcmKey when NODE_ENV is test and unset", () => {
    const appConfig = loadConfig({ NODE_ENV: "test" });

    expect(appConfig.fcmKey).toBe("dev-placeholder-fcm-key");
  });

  it("accepts an explicit FCM_KEY outside production", () => {
    const appConfig = loadConfig({
      NODE_ENV: "test",
      SUPABASE_JWT_SECRET: "my-secret",
      DATABASE_URL: "postgres://user:pass@host:5432/db",
      FCM_KEY: "fcm-key-value",
    });

    expect(appConfig.fcmKey).toBe("fcm-key-value");
  });

  it("uses a safe placeholder apnsKey when NODE_ENV is test and unset", () => {
    const appConfig = loadConfig({ NODE_ENV: "test" });

    expect(appConfig.apnsKey).toBe("dev-placeholder-apns-key");
  });

  it("accepts an explicit APNS_KEY outside production", () => {
    const appConfig = loadConfig({
      NODE_ENV: "test",
      SUPABASE_JWT_SECRET: "my-secret",
      DATABASE_URL: "postgres://user:pass@host:5432/db",
      APNS_KEY: "apns-key-value",
    });

    expect(appConfig.apnsKey).toBe("apns-key-value");
  });

  it("uses a safe placeholder mpAccessToken when NODE_ENV is test and unset", () => {
    const appConfig = loadConfig({ NODE_ENV: "test" });

    expect(appConfig.mpAccessToken).toBe("dev-placeholder-mp-access-token");
  });

  it("accepts an explicit MP_ACCESS_TOKEN outside production", () => {
    const appConfig = loadConfig({
      NODE_ENV: "test",
      SUPABASE_JWT_SECRET: "my-secret",
      DATABASE_URL: "postgres://user:pass@host:5432/db",
      MP_ACCESS_TOKEN: "mp-access-token-value",
    });

    expect(appConfig.mpAccessToken).toBe("mp-access-token-value");
  });

  it("uses a safe placeholder mpWebhookSecret when NODE_ENV is test and unset", () => {
    const appConfig = loadConfig({ NODE_ENV: "test" });

    expect(appConfig.mpWebhookSecret).toBe("dev-placeholder-mp-webhook-secret");
  });

  it("accepts an explicit MP_WEBHOOK_SECRET outside production", () => {
    const appConfig = loadConfig({
      NODE_ENV: "test",
      SUPABASE_JWT_SECRET: "my-secret",
      DATABASE_URL: "postgres://user:pass@host:5432/db",
      MP_WEBHOOK_SECRET: "mp-webhook-secret-value",
    });

    expect(appConfig.mpWebhookSecret).toBe("mp-webhook-secret-value");
  });

  it("uses a safe placeholder cronSecret when NODE_ENV is test and unset", () => {
    const appConfig = loadConfig({ NODE_ENV: "test" });

    expect(appConfig.cronSecret).toBe("dev-placeholder-cron-secret");
  });

  it("throws in production when CRON_SECRET is missing", () => {
    expect(() =>
      loadConfig({
        NODE_ENV: "production",
        SUPABASE_JWT_SECRET: "test-secret",
        DATABASE_URL: "postgresql://user:pass@host:5432/db",
      }),
    ).toThrow("CRON_SECRET is required and must be non-empty");
  });

  it("loads in production with only the three boot-critical credentials", () => {
    const appConfig = loadConfig({
      NODE_ENV: "production",
      SUPABASE_JWT_SECRET: "prod-secret",
      DATABASE_URL: "postgresql://user:pass@host:6543/db",
      CRON_SECRET: "prod-cron-secret",
    });

    expect(appConfig.supabaseJwtSecret).toBe("prod-secret");
    expect(appConfig.databaseUrl).toBe("postgresql://user:pass@host:6543/db");
    expect(appConfig.cronSecret).toBe("prod-cron-secret");
  });

  it("never falls back to dev placeholders for unconfigured credentials in production", () => {
    const appConfig = loadConfig({
      NODE_ENV: "production",
      SUPABASE_JWT_SECRET: "prod-secret",
      DATABASE_URL: "postgresql://user:pass@host:6543/db",
      CRON_SECRET: "prod-cron-secret",
    });

    const credentials = [
      appConfig.openrouterApiKey,
      appConfig.docusignIntegrationKey,
      appConfig.docusignClientSecret,
      appConfig.docusignAccountId,
      appConfig.docusignWebhookSecret,
      appConfig.docusignUserId,
      appConfig.docusignPrivateKey,
      appConfig.mpAccessToken,
      appConfig.mpWebhookSecret,
      appConfig.smtpHost,
      appConfig.smtpUser,
      appConfig.smtpPass,
      appConfig.fcmKey,
      appConfig.apnsKey,
    ];

    for (const credential of credentials) {
      expect(credential).toBe("");
    }
  });

  it("accepts an explicit CRON_SECRET outside production", () => {
    const appConfig = loadConfig({
      NODE_ENV: "test",
      SUPABASE_JWT_SECRET: "my-secret",
      DATABASE_URL: "postgres://user:pass@host:5432/db",
      CRON_SECRET: "cron-secret-value",
    });

    expect(appConfig.cronSecret).toBe("cron-secret-value");
  });

  describe("CORS_ORIGINS", () => {
    it("defaults to an empty list when CORS_ORIGINS is not set, leaving cors disabled", () => {
      const appConfig = loadConfig({ NODE_ENV: "test" });

      expect(appConfig.corsOrigins).toEqual([]);
    });

    it("splits a comma-separated list and trims each origin", () => {
      const appConfig = loadConfig({
        NODE_ENV: "test",
        CORS_ORIGINS: "https://app.mediacion.io, http://localhost:8081",
      });

      expect(appConfig.corsOrigins).toEqual([
        "https://app.mediacion.io",
        "http://localhost:8081",
      ]);
    });

    it("drops empty entries produced by stray commas", () => {
      const appConfig = loadConfig({
        NODE_ENV: "test",
        CORS_ORIGINS: "https://app.mediacion.io,,  ,",
      });

      expect(appConfig.corsOrigins).toEqual(["https://app.mediacion.io"]);
    });

    it("keeps the wildcard as an explicit opt-in rather than a default", () => {
      const appConfig = loadConfig({ NODE_ENV: "test", CORS_ORIGINS: "*" });

      expect(appConfig.corsOrigins).toEqual(["*"]);
    });
  });

  describe("legal module settings", () => {
    it("defaults the notice window to the 10 day legal minimum", () => {
      const appConfig = loadConfig({ NODE_ENV: "test" });

      expect(appConfig.legalAvisoDiasAnticipacion).toBe(10);
      expect(appConfig.legalPublicRequestsPerWindow).toBe(5);
      expect(appConfig.legalPublicWindowMs).toBe(3_600_000);
    });

    it("takes the notice window and the public rate limit from the environment", () => {
      const appConfig = loadConfig({
        NODE_ENV: "test",
        LEGAL_AVISO_DIAS_ANTICIPACION: "15",
        LEGAL_PUBLIC_REQUESTS_PER_WINDOW: "20",
        LEGAL_PUBLIC_WINDOW_MS: "60000",
      });

      expect(appConfig.legalAvisoDiasAnticipacion).toBe(15);
      expect(appConfig.legalPublicRequestsPerWindow).toBe(20);
      expect(appConfig.legalPublicWindowMs).toBe(60_000);
    });

    it.each(["0", "-1", "diez", "1.5"])(
      "throws when the notice window is %s",
      (value) => {
        expect(() =>
          loadConfig({
            NODE_ENV: "test",
            LEGAL_AVISO_DIAS_ANTICIPACION: value,
          }),
        ).toThrow("LEGAL_AVISO_DIAS_ANTICIPACION must be a positive integer");
      },
    );

    it("leaves the Operaciones mailbox empty outside test when it is not configured", () => {
      const appConfig = loadConfig({
        NODE_ENV: "production",
        SUPABASE_JWT_SECRET: "secret",
        DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
        CRON_SECRET: "cron",
      });

      expect(appConfig.operacionesEmail).toBe("");
    });

    it("uses the configured Operaciones mailbox", () => {
      const appConfig = loadConfig({
        NODE_ENV: "test",
        OPERACIONES_EMAIL: "operaciones@mediacion.test",
      });

      expect(appConfig.operacionesEmail).toBe("operaciones@mediacion.test");
    });
  });
});
