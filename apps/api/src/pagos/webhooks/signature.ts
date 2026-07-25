import { createHmac, timingSafeEqual } from "node:crypto";

const signatureFreshnessToleranceSeconds = 600;

function defaultNowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

export type VerifyMercadoPagoSignatureInput = {
  xSignature: string | undefined;
  xRequestId: string | undefined;
  dataId: string | undefined;
  secret: string;
  now?: () => number;
};

type ParsedSignatureHeader = {
  ts: string;
  v1: string;
};

function parseSignatureHeader(
  header: string,
): ParsedSignatureHeader | undefined {
  const fields = new Map<string, string>();
  for (const part of header.split(",")) {
    const separatorIndex = part.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }
    const key = part.slice(0, separatorIndex).trim();
    const value = part.slice(separatorIndex + 1).trim();
    fields.set(key, value);
  }
  const ts = fields.get("ts");
  const v1 = fields.get("v1");
  if (!ts || !v1) {
    return undefined;
  }
  return { ts, v1 };
}

function decodeHexSignature(headerValue: string): Buffer | undefined {
  if (headerValue.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(headerValue)) {
    return undefined;
  }
  return Buffer.from(headerValue, "hex");
}

function buildManifest(
  dataId: string,
  xRequestId: string | undefined,
  ts: string,
): string {
  const requestIdSegment = xRequestId ? `request-id:${xRequestId};` : "";
  return `id:${dataId};${requestIdSegment}ts:${ts};`;
}

export function verifyMercadoPagoSignature(
  input: VerifyMercadoPagoSignatureInput,
): boolean {
  if (!input.xSignature || !input.dataId) {
    return false;
  }
  const parsed = parseSignatureHeader(input.xSignature);
  if (!parsed) {
    return false;
  }
  const providedSignature = decodeHexSignature(parsed.v1);
  if (!providedSignature) {
    return false;
  }
  const manifest = buildManifest(input.dataId, input.xRequestId, parsed.ts);
  const expectedSignature = createHmac("sha256", input.secret)
    .update(manifest)
    .digest();
  if (providedSignature.length !== expectedSignature.length) {
    return false;
  }
  if (!timingSafeEqual(providedSignature, expectedSignature)) {
    return false;
  }
  return isFresh(parsed.ts, input.now ?? defaultNowSeconds);
}

function isFresh(ts: string, now: () => number): boolean {
  const tsSeconds = Number(ts);
  if (!Number.isFinite(tsSeconds)) {
    return false;
  }
  return Math.abs(now() - tsSeconds) <= signatureFreshnessToleranceSeconds;
}
