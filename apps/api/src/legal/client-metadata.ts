import { isIP } from "node:net";
import { HttpException, HttpStatus } from "@nestjs/common";
import type { AceptacionRequestMetadata } from "./legal.types";

const forwardedSeparator = ",";
const unknownUserAgent = "";

function firstForwardedCandidate(
  forwardedFor: string | undefined,
): string | undefined {
  if (!forwardedFor) {
    return undefined;
  }
  const [first] = forwardedFor.split(forwardedSeparator);
  const candidate = first?.trim().replace(/^\[|\]$/g, "");
  return candidate && candidate.length > 0 ? candidate : undefined;
}

function unresolvableIp(): HttpException {
  return new HttpException(
    {
      code: "invalid_input",
      message: "the client ip could not be resolved from the request",
    },
    HttpStatus.BAD_REQUEST,
  );
}

export function resolveClientIp(
  forwardedFor: string | undefined,
  fallbackIp: string | undefined,
): string {
  const candidates = [
    firstForwardedCandidate(forwardedFor),
    fallbackIp?.trim(),
  ];
  const resolved = candidates.find(
    (candidate) => candidate !== undefined && isIP(candidate) !== 0,
  );
  if (!resolved) {
    throw unresolvableIp();
  }
  return resolved;
}

export function resolveUserAgent(userAgent: string | undefined): string {
  return userAgent?.trim() ?? unknownUserAgent;
}

export function resolveRequestMetadata(
  forwardedFor: string | undefined,
  fallbackIp: string | undefined,
  userAgent: string | undefined,
): AceptacionRequestMetadata {
  return {
    ip: resolveClientIp(forwardedFor, fallbackIp),
    userAgent: resolveUserAgent(userAgent),
  };
}
