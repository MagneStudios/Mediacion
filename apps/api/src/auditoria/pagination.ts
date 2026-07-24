import { HttpException, HttpStatus } from "@nestjs/common";
import type { ListAuditoriaQuery } from "./types";

const defaultPage = 1;
const defaultLimit = 20;
const maxLimit = 100;

function invalidInput(message: string): HttpException {
  return new HttpException(
    { code: "invalid_input", message },
    HttpStatus.BAD_REQUEST,
  );
}

function parsePage(raw: string | undefined): number {
  if (raw === undefined) {
    return defaultPage;
  }
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    throw invalidInput("page must be a positive integer");
  }
  return value;
}

function parseLimit(raw: string | undefined): number {
  if (raw === undefined) {
    return defaultLimit;
  }
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    throw invalidInput("limit must be a positive integer");
  }
  return Math.min(value, maxLimit);
}

export function resolvePagination(query: ListAuditoriaQuery | undefined): {
  page: number;
  limit: number;
} {
  return {
    page: parsePage(query?.page),
    limit: parseLimit(query?.limit),
  };
}
