import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import type { MeProfile } from "../auth/authenticated-user";
import { UsersRepository } from "../auth/users.repository";
import { normalizeTimestamp } from "../common/db/timestamp";
import type { AccountActionResult, UpdateProfileDto } from "./me.types";
import type { NotificationPreferences } from "./notification-preferences";
import {
  mergeNotificationPreferences,
  parseNotificationPreferences,
  pickNotificationPreferencePatch,
} from "./notification-preferences";
import { pickUpdatableProfileFields } from "./profile-allowlist";

const maxFieldLength = 120;

function invalidInput(message: string): HttpException {
  return new HttpException(
    { code: "invalid_input", message },
    HttpStatus.BAD_REQUEST,
  );
}

function profileNotFound(): HttpException {
  return new HttpException(
    { code: "profile_not_found", message: "Profile not found" },
    HttpStatus.NOT_FOUND,
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

  async findNotificationPreferences(
    callerId: string,
  ): Promise<NotificationPreferences> {
    const row =
      await this.usersRepository.findNotificationPreferencesById(callerId);
    if (!row) {
      throw profileNotFound();
    }
    return parseNotificationPreferences(row.preferencias_notificacion);
  }

  /**
   * Merged onto the stored value rather than replacing it, so a client that
   * sends one toggle does not silently reset the other six to their defaults.
   */
  async updateNotificationPreferences(
    callerId: string,
    patch: unknown,
  ): Promise<NotificationPreferences> {
    const narrowed = pickNotificationPreferencePatch(patch);
    if (Object.keys(narrowed).length === 0) {
      throw new HttpException(
        {
          code: "no_updatable_fields",
          message: "No notification preference provided",
        },
        HttpStatus.BAD_REQUEST,
      );
    }
    const current =
      await this.usersRepository.findNotificationPreferencesById(callerId);
    if (!current) {
      throw profileNotFound();
    }
    const merged = mergeNotificationPreferences(
      current.preferencias_notificacion,
      narrowed,
    );
    const updated =
      await this.usersRepository.updateNotificationPreferencesById(
        callerId,
        merged,
      );
    if (!updated) {
      throw profileNotFound();
    }
    return parseNotificationPreferences(updated.preferencias_notificacion);
  }

  /**
   * Idempotent by construction: the repository only writes where no request is
   * recorded yet, so a repeat call reports the ORIGINAL timestamp rather than
   * moving it. That matches the contract the frontend already models
   * (`AccountActionResult`), and it means a double tap cannot make it look like
   * two separate requests were filed.
   */
  async requestDeactivation(callerId: string): Promise<AccountActionResult> {
    const requestedAt = new Date().toISOString();
    const created = await this.usersRepository.requestDeactivationById(
      callerId,
      requestedAt,
    );
    // normalizeTimestamp, not the raw column: db-types declares every
    // TIMESTAMPTZ as `string`, but node-postgres hands back a JS Date at
    // runtime because no type parser is configured. Returning it unconverted
    // makes the response type a lie and breaks any caller comparing strings.
    const createdAt = normalizeTimestamp(created?.desactivacion_solicitada_at);
    if (createdAt) {
      return { status: "requested", requestedAt: createdAt };
    }
    const existing = await this.usersRepository.findDeactivationById(callerId);
    if (!existing) {
      throw profileNotFound();
    }
    const existingAt = normalizeTimestamp(existing.desactivacion_solicitada_at);
    if (!existingAt) {
      // The update matched nothing and no request is recorded either. Reporting
      // success here would tell someone their account is closing when nothing
      // was written.
      throw new HttpException(
        {
          code: "conflict",
          message: "Deactivation could not be recorded",
        },
        HttpStatus.CONFLICT,
      );
    }
    return { status: "already_requested", requestedAt: existingAt };
  }
}
