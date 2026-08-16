import {
  resolveClientIp,
  resolveRequestMetadata,
  resolveUserAgent,
} from "./client-metadata";

describe("resolveClientIp", () => {
  it("takes the first entry of x-forwarded-for", () => {
    expect(resolveClientIp("203.0.113.7, 10.0.0.1", "127.0.0.1")).toBe(
      "203.0.113.7",
    );
  });

  it("falls back to the socket ip when the header is absent", () => {
    expect(resolveClientIp(undefined, "198.51.100.4")).toBe("198.51.100.4");
  });

  it("falls back to the socket ip when the header is not an ip", () => {
    expect(resolveClientIp("no-es-ip", "198.51.100.4")).toBe("198.51.100.4");
  });

  it("accepts ipv6, with or without brackets", () => {
    expect(resolveClientIp("[2001:db8::1]", undefined)).toBe("2001:db8::1");
  });

  it("rejects the request when no candidate is a valid ip", () => {
    expect(() => resolveClientIp("no-es-ip", "")).toThrow(
      expect.objectContaining({
        status: 400,
        response: expect.objectContaining({ code: "invalid_input" }),
      }),
    );
  });
});

describe("resolveUserAgent", () => {
  it("trims the header", () => {
    expect(resolveUserAgent("  Expo/1.0  ")).toBe("Expo/1.0");
  });

  it("returns an empty string when the header is absent", () => {
    expect(resolveUserAgent(undefined)).toBe("");
  });
});

describe("resolveRequestMetadata", () => {
  it("builds the proof metadata from the request alone", () => {
    expect(
      resolveRequestMetadata("203.0.113.7", "127.0.0.1", "Expo/1.0"),
    ).toEqual({ ip: "203.0.113.7", userAgent: "Expo/1.0" });
  });
});
