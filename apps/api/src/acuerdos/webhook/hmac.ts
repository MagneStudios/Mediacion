import { createHmac, timingSafeEqual } from "node:crypto";

function decodeBase64Signature(headerValue: string): Buffer | undefined {
  const decoded = Buffer.from(headerValue, "base64");
  const reencoded = decoded.toString("base64");
  if (reencoded !== headerValue) {
    return undefined;
  }
  return decoded;
}

const hmacDigestLengthBytes = 32;
const hexSignaturePattern = /^[0-9a-fA-F]{64}$/;
const sha256PrefixPattern = /^sha256=/i;
const base64PaddingBlockSize = 4;

/** Normalizes a base64url value to standard base64, restoring padding. */
function normalizeBase64Url(value: string): string {
  const standard = value.replace(/-/g, "+").replace(/_/g, "/");
  const missingPadding =
    (base64PaddingBlockSize - (standard.length % base64PaddingBlockSize)) %
    base64PaddingBlockSize;
  return standard + "=".repeat(missingPadding);
}

function decodeSignnowSignature(headerValue: string): Buffer[] {
  const signatureValue = headerValue.replace(sha256PrefixPattern, "");
  const candidates: Buffer[] = [];
  if (hexSignaturePattern.test(signatureValue)) {
    candidates.push(Buffer.from(signatureValue, "hex"));
  }
  const base64Values = new Set([
    signatureValue,
    normalizeBase64Url(signatureValue),
  ]);
  for (const base64Value of base64Values) {
    const base64Decoded = decodeBase64Signature(base64Value);
    if (base64Decoded && base64Decoded.length === hmacDigestLengthBytes) {
      candidates.push(base64Decoded);
    }
  }
  return candidates;
}

export function verifySignnowHmac(
  rawBody: Buffer,
  headerValue: string | undefined,
  secret: string,
): boolean {
  if (!headerValue || secret.length === 0) {
    return false;
  }
  const expectedSignature = createHmac("sha256", secret)
    .update(rawBody)
    .digest();
  return decodeSignnowSignature(headerValue).some(
    (candidate) =>
      candidate.length === expectedSignature.length &&
      timingSafeEqual(candidate, expectedSignature),
  );
}

export function verifyDocusignHmac(
  rawBody: Buffer,
  headerValue: string | undefined,
  secret: string,
): boolean {
  if (!headerValue) {
    return false;
  }
  const providedSignature = decodeBase64Signature(headerValue);
  if (!providedSignature) {
    return false;
  }
  const expectedSignature = createHmac("sha256", secret)
    .update(rawBody)
    .digest();
  if (providedSignature.length !== expectedSignature.length) {
    return false;
  }
  return timingSafeEqual(providedSignature, expectedSignature);
}
