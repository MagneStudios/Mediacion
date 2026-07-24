import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import { InversoresRepository } from "./inversores.repository";
import type { CreateInversorDto, InversorResult } from "./types";

const nombreMaxLength = 200;
const emailMaxLength = 254;
const capitalDisponibleMaxLength = 500;
const experienciaMaxLength = 2000;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function invalidInput(message: string): HttpException {
  return new HttpException(
    { code: "invalid_input", message },
    HttpStatus.BAD_REQUEST,
  );
}

function assertValidNombre(nombre: unknown): void {
  if (typeof nombre !== "string" || nombre.trim().length === 0) {
    throw invalidInput("nombre is required");
  }
  if (nombre.length > nombreMaxLength) {
    throw invalidInput(`nombre must be at most ${nombreMaxLength} characters`);
  }
}

function assertValidEmail(email: unknown): void {
  if (typeof email !== "string" || email.trim().length === 0) {
    throw invalidInput("email is required");
  }
  if (email.length > emailMaxLength) {
    throw invalidInput(`email must be at most ${emailMaxLength} characters`);
  }
  if (!emailPattern.test(email)) {
    throw invalidInput("email must be a valid email address");
  }
}

function assertValidCapitalDisponible(capitalDisponible: unknown): void {
  if (
    typeof capitalDisponible !== "string" ||
    capitalDisponible.trim().length === 0
  ) {
    throw invalidInput("capital_disponible is required");
  }
  if (capitalDisponible.length > capitalDisponibleMaxLength) {
    throw invalidInput(
      `capital_disponible must be at most ${capitalDisponibleMaxLength} characters`,
    );
  }
}

function assertValidExperiencia(experiencia: unknown): void {
  if (typeof experiencia !== "string" || experiencia.trim().length === 0) {
    throw invalidInput("experiencia is required");
  }
  if (experiencia.length > experienciaMaxLength) {
    throw invalidInput(
      `experiencia must be at most ${experienciaMaxLength} characters`,
    );
  }
}

function assertValidCreateInput(input: CreateInversorDto): void {
  assertValidNombre(input?.nombre);
  assertValidEmail(input?.email);
  assertValidCapitalDisponible(input?.capital_disponible);
  assertValidExperiencia(input?.experiencia);
}

@Injectable()
export class InversoresService {
  constructor(
    @Inject(InversoresRepository)
    private readonly inversoresRepository: InversoresRepository,
  ) {}

  async createInversor(input: CreateInversorDto): Promise<InversorResult> {
    assertValidCreateInput(input);
    const inversor = await this.inversoresRepository.create(input);
    return { id: inversor.id };
  }
}
