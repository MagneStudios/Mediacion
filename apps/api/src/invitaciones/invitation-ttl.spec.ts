import {
  DEFAULT_INVITATION_TTL_HOURS,
  isInvitationExpired,
} from "./invitation-ttl";

describe("isInvitationExpired", () => {
  const now = new Date("2026-07-23T00:00:00.000Z");

  it("uses 72 hours as the default TTL (R-04)", () => {
    expect(DEFAULT_INVITATION_TTL_HOURS).toBe(72);
  });

  it("treats a token sent 8 days ago as expired", () => {
    const fechaEnvio = new Date("2026-07-15T00:00:00.000Z").toISOString();

    expect(isInvitationExpired(fechaEnvio, now)).toBe(true);
  });

  it("treats a token sent 6 days ago as expired (beyond the 72-hour TTL)", () => {
    const fechaEnvio = new Date("2026-07-17T00:00:00.000Z").toISOString();

    expect(isInvitationExpired(fechaEnvio, now)).toBe(true);
  });

  it("treats a null fecha_envio as not expired", () => {
    expect(isInvitationExpired(null, now)).toBe(false);
  });

  it("treats a token sent exactly 72 hours ago as still valid", () => {
    const fechaEnvio = new Date(
      now.getTime() - 72 * 60 * 60 * 1000,
    ).toISOString();

    expect(isInvitationExpired(fechaEnvio, now)).toBe(false);
  });

  it("treats a token sent just over 72 hours ago as expired", () => {
    const fechaEnvio = new Date(
      now.getTime() - (72 * 60 * 60 * 1000 + 60 * 1000),
    ).toISOString();

    expect(isInvitationExpired(fechaEnvio, now)).toBe(true);
  });

  it("honors an explicit ttl override (e.g. 96h)", () => {
    const threeDaysAgo = new Date(
      now.getTime() - 3 * 24 * 60 * 60 * 1000,
    ).toISOString();
    const fourDaysAgo = new Date(
      now.getTime() - 4 * 24 * 60 * 60 * 1000,
    ).toISOString();

    expect(isInvitationExpired(threeDaysAgo, now, 96)).toBe(false);
    expect(isInvitationExpired(fourDaysAgo, now, 96)).toBe(false);
    expect(isInvitationExpired(fourDaysAgo, now, 72)).toBe(true);
  });
});