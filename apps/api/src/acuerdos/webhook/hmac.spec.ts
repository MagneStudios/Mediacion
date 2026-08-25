import { createHmac } from "node:crypto";
import { verifyDocusignHmac, verifySignnowHmac } from "./hmac";

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

describe("verifySignnowHmac", () => {
  const rawBody = Buffer.from(
    JSON.stringify({ content: { document_id: "document-1" } }),
  );

  it("accepts a valid HMAC-SHA256 hex signature computed over the raw body", () => {
    const signature = createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");

    expect(verifySignnowHmac(rawBody, signature, secret)).toBe(true);
  });

  it("accepts a valid HMAC-SHA256 base64 signature computed over the raw body", () => {
    const signature = createHmac("sha256", secret)
      .update(rawBody)
      .digest("base64");

    expect(verifySignnowHmac(rawBody, signature, secret)).toBe(true);
  });

  it("accepts an uppercase hex signature", () => {
    const signature = createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex")
      .toUpperCase();

    expect(verifySignnowHmac(rawBody, signature, secret)).toBe(true);
  });

  it("accepts a signature with an optional sha256= prefix, case-insensitively", () => {
    const hexSignature = createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");
    const base64Signature = createHmac("sha256", secret)
      .update(rawBody)
      .digest("base64");

    expect(verifySignnowHmac(rawBody, `sha256=${hexSignature}`, secret)).toBe(
      true,
    );
    expect(
      verifySignnowHmac(rawBody, `SHA256=${base64Signature}`, secret),
    ).toBe(true);
  });

  it("accepts a base64url signature without padding", () => {
    const signature = createHmac("sha256", secret)
      .update(rawBody)
      .digest("base64url");

    expect(verifySignnowHmac(rawBody, signature, secret)).toBe(true);
    expect(verifySignnowHmac(rawBody, `sha256=${signature}`, secret)).toBe(
      true,
    );
  });

  it("rejects a mismatched base64url signature", () => {
    const otherBody = Buffer.from(
      JSON.stringify({ content: { document_id: "document-2" } }),
    );
    const signature = createHmac("sha256", secret)
      .update(otherBody)
      .digest("base64url");

    expect(verifySignnowHmac(rawBody, signature, secret)).toBe(false);
  });

  it("rejects a mismatched signature in either encoding", () => {
    const otherBody = Buffer.from(
      JSON.stringify({ content: { document_id: "document-2" } }),
    );
    const hexSignature = createHmac("sha256", secret)
      .update(otherBody)
      .digest("hex");
    const base64Signature = createHmac("sha256", secret)
      .update(otherBody)
      .digest("base64");

    expect(verifySignnowHmac(rawBody, hexSignature, secret)).toBe(false);
    expect(verifySignnowHmac(rawBody, base64Signature, secret)).toBe(false);
  });

  it("rejects when the signature header is missing", () => {
    expect(verifySignnowHmac(rawBody, undefined, secret)).toBe(false);
  });

  it("rejects when the secret is unconfigured, even for a signature computed with an empty secret", () => {
    const signature = createHmac("sha256", "").update(rawBody).digest("hex");

    expect(verifySignnowHmac(rawBody, signature, "")).toBe(false);
  });

  it("rejects malformed signatures without throwing", () => {
    expect(() =>
      verifySignnowHmac(rawBody, "not a signature!!! %%%", secret),
    ).not.toThrow();
    expect(verifySignnowHmac(rawBody, "not a signature!!! %%%", secret)).toBe(
      false,
    );
    expect(verifySignnowHmac(rawBody, "abcd", secret)).toBe(false);
  });
});
