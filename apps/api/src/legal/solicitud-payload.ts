import { HttpException, HttpStatus } from "@nestjs/common";
import type { ArrepentimientoDto, ContactoDto } from "./legal.types";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function invalidInput(message: string): HttpException {
  return new HttpException(
    { code: "invalid_input", message },
    HttpStatus.BAD_REQUEST,
  );
}

function readNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw invalidInput(`${field} must be a non-empty string`);
  }
  return value.trim();
}

function readEmail(value: unknown): string {
  const email = readNonEmptyString(value, "email");
  if (!emailPattern.test(email)) {
    throw invalidInput("email must be a valid email address");
  }
  return email;
}

function readSolicitud(body: unknown): { nombre: string; email: string } {
  const source = (body ?? {}) as Record<string, unknown>;
  return {
    nombre: readNonEmptyString(source.nombre, "nombre"),
    email: readEmail(source.email),
  };
}

export function assertValidArrepentimiento(body: unknown): ArrepentimientoDto {
  const source = (body ?? {}) as Record<string, unknown>;
  return {
    ...readSolicitud(body),
    detalle: readNonEmptyString(source.detalle, "detalle"),
  };
}

export function assertValidContacto(body: unknown): ContactoDto {
  const source = (body ?? {}) as Record<string, unknown>;
  return {
    ...readSolicitud(body),
    mensaje: readNonEmptyString(source.mensaje, "mensaje"),
  };
}
