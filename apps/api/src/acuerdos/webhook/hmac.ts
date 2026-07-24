import { createHmac, timingSafeEqual } from "node:crypto";

function decodeBase64Signature(headerValue: string): Buffer | undefined {
  const decoded = Buffer.from(headerValue, "base64");
  const reencoded = decoded.toString("base64");
  if (reencoded !== headerValue) {
    return undefined;
  }
  return decoded;
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
