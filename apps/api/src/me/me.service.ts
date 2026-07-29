import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import type { MeProfile } from "../auth/authenticated-user";
import { UsersRepository } from "../auth/users.repository";
import type { UpdateProfileDto } from "./me.types";
import { pickUpdatableProfileFields } from "./profile-allowlist";

const maxFieldLength = 120;

function invalidInput(message: string): HttpException {
  return new HttpException(
    { code: "invalid_input", message },
    HttpStatus.BAD_REQUEST,
  );
}

function assertHasUpdatableFields(patch: UpdateProfileDto): void {
  if (Object.keys(patch).length === 0) {
    throw new HttpException(
      { code: "no_updatable_fields", message: "No updatable fields provided" },
      HttpStatus.BAD_REQUEST,
    );
  }
}

function assertValidText(
  field: string,
  value: string | null | undefined,
): void {
  if (value === undefined || value === null) {
    return;
  }
  if (typeof value !== "string" || value.trim().length === 0) {
    throw invalidInput(`${field} must be a non-empty string`);
  }
  if (value.length > maxFieldLength) {
    throw invalidInput(`${field} must be at most ${maxFieldLength} characters`);
  }
}

function assertValidPatch(patch: UpdateProfileDto): void {
  assertValidText("nombre", patch.nombre);
  assertValidText("apellido", patch.apellido);
  assertValidText("telefono", patch.telefono);
  assertValidText("idioma", patch.idioma);
}

@Injectable()
export class MeService {
  constructor(
    @Inject(UsersRepository) private readonly usersRepository: UsersRepository,
  ) {}

  findOwnProfile(callerId: string): Promise<MeProfile | undefined> {
    return this.usersRepository.findProfileById(callerId);
  }

  /**
   * The patch is narrowed to the allowlist before validation so that a rejected
   * privilege field can never make an otherwise empty patch look populated.
   */
  async updateOwnProfile(
    callerId: string,
    patch: UpdateProfileDto,
  ): Promise<MeProfile> {
    const updatable = pickUpdatableProfileFields(patch ?? {});
    assertHasUpdatableFields(updatable);
    assertValidPatch(updatable);
    const updated = await this.usersRepository.updateProfileById(
      callerId,
      updatable,
    );
    if (!updated) {
      throw new HttpException(
        { code: "profile_not_found", message: "Profile not found" },
        HttpStatus.NOT_FOUND,
      );
    }
    return updated;
  }
}
