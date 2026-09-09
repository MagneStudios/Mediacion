import type { AppConfig } from "./config";

/**
 * A complete AppConfig for tests, with every field filled by a recognisable
 * placeholder. Shared so that adding a config field is one edit here instead of
 * one per spec that needs a config — eight specs used to carry their own copy
 * of the full literal, and each new field broke all eight.
 *
 * Not a spec itself: jest only collects `*.spec.ts`.
 */
export function buildTestAppConfig(overrides?: Partial<AppConfig>): AppConfig {
  return {
    port: 3000,
    supabaseJwtSecret: "secret",
    databaseUrl: "postgresql://placeholder",
    openrouterApiKey: "sk-or-test-key",
    docusignIntegrationKey: "ik-test",
    docusignClientSecret: "secret-test",
    docusignAccountId: "account-test",
    docusignBasePath: "https://demo.docusign.net/restapi",
    docusignWebhookSecret: "whsec-test",
    docusignUserId: "user-test",
    docusignOauthBase: "account-d.docusign.com",
    docusignPrivateKey: "test-private-key-pem",
    signnowBasePath: "https://api-eval.signnow.com",
    signnowClientId: "signnow-client-id",
    signnowClientSecret: "signnow-client-secret",
    signnowUserEmail: "signnow@test",
    signnowUserPassword: "signnow-password",
    signnowWebhookSecret: "signnow-whsec-test",
    signnowWebhookCallbackUrl: "https://api.test/api/webhooks/signnow",
    mpAccessToken: "mp-access-token",
    mpWebhookSecret: "mp-webhook-secret",
    smtpHost: "smtp.example.com",
    smtpPort: 587,
    smtpUser: "smtp-user",
    smtpPass: "smtp-pass",
    fcmKey: "fcm-key",
    apnsKey: "apns-key",
    operacionesEmail: "operaciones@test",
    legalAvisoDiasAnticipacion: 10,
    legalPublicRequestsPerWindow: 5,
    legalPublicWindowMs: 3_600_000,
    lawyerFeeArsMinor: 5_000_000,
    cronSecret: "cron-secret",
    corsOrigins: [],
    ...overrides,
  };
}
