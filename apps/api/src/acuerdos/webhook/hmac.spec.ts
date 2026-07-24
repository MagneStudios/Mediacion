import { createHmac } from "node:crypto";
import { verifyDocusignHmac } from "./hmac";

const secret = "whsec-test";

function signRawBody(rawBody: Buffer, hmacSecret: string): string {
  return createHmac("sha256", hmacSecret).update(rawBody).digest("base64");
}

describe("verifyDocusignHmac", () => {
  it("accepts a valid HMAC-SHA256 base64 signature computed over the raw body", () => {
    const rawBody = Buffer.from(
      JSON.stringify({ envelopeId: "envelope-1", status: "completed" }),
    );
    const signature = signRawBody(rawBody, secret);

    expect(verifyDocusignHmac(rawBody, signature, secret)).toBe(true);
  });

  it("rejects a mismatched signature of the same length", () => {
    const rawBody = Buffer.from(
      JSON.stringify({ envelopeId: "envelope-1", status: "completed" }),
    );
    const validSignature = signRawBody(rawBody, secret);
    const tamperedRawBody = Buffer.from(
      JSON.stringify({ envelopeId: "envelope-2", status: "completed" }),
    );

    expect(verifyDocusignHmac(tamperedRawBody, validSignature, secret)).toBe(
      false,
    );
  });

  it("rejects when the signature header is missing, without attempting a comparison", () => {
    const rawBody = Buffer.from(JSON.stringify({ envelopeId: "envelope-1" }));

    expect(verifyDocusignHmac(rawBody, undefined, secret)).toBe(false);
  });

  it("rejects a length-mismatched base64 signature before any timingSafeEqual call", () => {
    const rawBody = Buffer.from(JSON.stringify({ envelopeId: "envelope-1" }));

    expect(verifyDocusignHmac(rawBody, "short", secret)).toBe(false);
  });

  it("rejects a signature that is not valid base64 without throwing", () => {
    const rawBody = Buffer.from(JSON.stringify({ envelopeId: "envelope-1" }));

    expect(() =>
      verifyDocusignHmac(rawBody, "not base64!!! %%%", secret),
    ).not.toThrow();
    expect(verifyDocusignHmac(rawBody, "not base64!!! %%%", secret)).toBe(
      false,
    );
  });
});
