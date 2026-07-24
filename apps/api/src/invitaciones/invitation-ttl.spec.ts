import { isInvitationExpired } from "./invitation-ttl";

describe("isInvitationExpired", () => {
  const now = new Date("2026-07-23T00:00:00.000Z");

  it("treats a token sent 8 days ago as expired", () => {
    const fechaEnvio = new Date("2026-07-15T00:00:00.000Z").toISOString();

    expect(isInvitationExpired(fechaEnvio, now)).toBe(true);
  });

  it("treats a token sent 6 days ago as still valid", () => {
    const fechaEnvio = new Date("2026-07-17T00:00:00.000Z").toISOString();

    expect(isInvitationExpired(fechaEnvio, now)).toBe(false);
  });

  it("treats a null fecha_envio as not expired", () => {
    expect(isInvitationExpired(null, now)).toBe(false);
  });

  it("treats a token sent exactly 7 days ago as still valid", () => {
    const fechaEnvio = new Date(
      now.getTime() - 7 * 24 * 60 * 60 * 1000,
    ).toISOString();

    expect(isInvitationExpired(fechaEnvio, now)).toBe(false);
  });

  it("treats a token sent just over 7 days ago as expired", () => {
    const fechaEnvio = new Date(
      now.getTime() - (7 * 24 * 60 * 60 * 1000 + 60 * 1000),
    ).toISOString();

    expect(isInvitationExpired(fechaEnvio, now)).toBe(true);
  });
});
