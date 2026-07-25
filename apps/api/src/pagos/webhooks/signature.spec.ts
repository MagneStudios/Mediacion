import { createHmac } from "node:crypto";
import { verifyMercadoPagoSignature } from "./signature";

const secret = "mp-webhook-secret";

function signManifest(manifest: string, hmacSecret: string): string {
  return createHmac("sha256", hmacSecret).update(manifest).digest("hex");
}

function buildManifest(
  dataId: string,
  requestId: string | undefined,
  ts: string,
): string {
  const requestIdSegment = requestId ? `request-id:${requestId};` : "";
  return `id:${dataId};${requestIdSegment}ts:${ts};`;
}

describe("verifyMercadoPagoSignature", () => {
  it("accepts a valid HMAC-SHA256 hex signature computed over id, request-id and ts", () => {
    const ts = "1704908010";
    const dataId = "123456";
    const requestId = "req-1";
    const manifest = buildManifest(dataId, requestId, ts);
    const v1 = signManifest(manifest, secret);

    const isValid = verifyMercadoPagoSignature({
      xSignature: `ts=${ts},v1=${v1}`,
      xRequestId: requestId,
      dataId,
      secret,
      now: () => Number(ts),
    });

    expect(isValid).toBe(true);
  });

  it("accepts a valid signature when there is no x-request-id header", () => {
    const ts = "1704908010";
    const dataId = "123456";
    const manifest = buildManifest(dataId, undefined, ts);
    const v1 = signManifest(manifest, secret);

    const isValid = verifyMercadoPagoSignature({
      xSignature: `ts=${ts},v1=${v1}`,
      xRequestId: undefined,
      dataId,
      secret,
      now: () => Number(ts),
    });

    expect(isValid).toBe(true);
  });

  it("rejects when the x-signature header is missing", () => {
    const isValid = verifyMercadoPagoSignature({
      xSignature: undefined,
      xRequestId: "req-1",
      dataId: "123456",
      secret,
    });

    expect(isValid).toBe(false);
  });

  it("rejects when data.id is missing", () => {
    const ts = "1704908010";
    const manifest = buildManifest("123456", "req-1", ts);
    const v1 = signManifest(manifest, secret);

    const isValid = verifyMercadoPagoSignature({
      xSignature: `ts=${ts},v1=${v1}`,
      xRequestId: "req-1",
      dataId: undefined,
      secret,
      now: () => Number(ts),
    });

    expect(isValid).toBe(false);
  });

  it("rejects a malformed x-signature header without ts or v1", () => {
    const isValid = verifyMercadoPagoSignature({
      xSignature: "not-a-valid-header",
      xRequestId: "req-1",
      dataId: "123456",
      secret,
    });

    expect(isValid).toBe(false);
  });

  it("rejects a forged v1 signature of matching length", () => {
    const ts = "1704908010";
    const dataId = "123456";
    const manifest = buildManifest(dataId, "req-1", ts);
    const validV1 = signManifest(manifest, secret);
    const forgedV1 =
      validV1.slice(0, -2) + (validV1.slice(-2) === "00" ? "11" : "00");

    const isValid = verifyMercadoPagoSignature({
      xSignature: `ts=${ts},v1=${forgedV1}`,
      xRequestId: "req-1",
      dataId,
      secret,
      now: () => Number(ts),
    });

    expect(isValid).toBe(false);
  });

  it("rejects a signature computed with the wrong data.id (tampered payload id)", () => {
    const ts = "1704908010";
    const manifest = buildManifest("123456", "req-1", ts);
    const v1 = signManifest(manifest, secret);

    const isValid = verifyMercadoPagoSignature({
      xSignature: `ts=${ts},v1=${v1}`,
      xRequestId: "req-1",
      dataId: "999999",
      secret,
      now: () => Number(ts),
    });

    expect(isValid).toBe(false);
  });

  it("rejects a length-mismatched v1 hex value before any timingSafeEqual call", () => {
    const isValid = verifyMercadoPagoSignature({
      xSignature: "ts=1704908010,v1=abcd",
      xRequestId: "req-1",
      dataId: "123456",
      secret,
    });

    expect(isValid).toBe(false);
  });

  it("rejects a v1 value that is not valid hex without throwing", () => {
    expect(() =>
      verifyMercadoPagoSignature({
        xSignature: "ts=1704908010,v1=not-hex-!!",
        xRequestId: "req-1",
        dataId: "123456",
        secret,
      }),
    ).not.toThrow();
    expect(
      verifyMercadoPagoSignature({
        xSignature: "ts=1704908010,v1=not-hex-!!",
        xRequestId: "req-1",
        dataId: "123456",
        secret,
      }),
    ).toBe(false);
  });

  describe("ts freshness tolerance", () => {
    const dataId = "123456";
    const requestId = "req-1";

    function signAt(ts: string): string {
      return signManifest(buildManifest(dataId, requestId, ts), secret);
    }

    it("rejects a signature whose ts is older than the 600s tolerance", () => {
      const nowSeconds = 1704908010;
      const ts = String(nowSeconds - 601);
      const v1 = signAt(ts);

      const isValid = verifyMercadoPagoSignature({
        xSignature: `ts=${ts},v1=${v1}`,
        xRequestId: requestId,
        dataId,
        secret,
        now: () => nowSeconds,
      });

      expect(isValid).toBe(false);
    });

    it("accepts a signature whose ts is within the 600s tolerance", () => {
      const nowSeconds = 1704908010;
      const ts = String(nowSeconds - 300);
      const v1 = signAt(ts);

      const isValid = verifyMercadoPagoSignature({
        xSignature: `ts=${ts},v1=${v1}`,
        xRequestId: requestId,
        dataId,
        secret,
        now: () => nowSeconds,
      });

      expect(isValid).toBe(true);
    });

    it("accepts a signature exactly at the 600s tolerance boundary", () => {
      const nowSeconds = 1704908010;
      const ts = String(nowSeconds - 600);
      const v1 = signAt(ts);

      const isValid = verifyMercadoPagoSignature({
        xSignature: `ts=${ts},v1=${v1}`,
        xRequestId: requestId,
        dataId,
        secret,
        now: () => nowSeconds,
      });

      expect(isValid).toBe(true);
    });

    it("rejects a signature one second past the 600s tolerance boundary", () => {
      const nowSeconds = 1704908010;
      const ts = String(nowSeconds - 601);
      const v1 = signAt(ts);

      const isValid = verifyMercadoPagoSignature({
        xSignature: `ts=${ts},v1=${v1}`,
        xRequestId: requestId,
        dataId,
        secret,
        now: () => nowSeconds,
      });

      expect(isValid).toBe(false);
    });

    it("rejects a ts from the future beyond the tolerance", () => {
      const nowSeconds = 1704908010;
      const ts = String(nowSeconds + 601);
      const v1 = signAt(ts);

      const isValid = verifyMercadoPagoSignature({
        xSignature: `ts=${ts},v1=${v1}`,
        xRequestId: requestId,
        dataId,
        secret,
        now: () => nowSeconds,
      });

      expect(isValid).toBe(false);
    });
  });
});
