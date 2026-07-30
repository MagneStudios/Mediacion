import { randomUUID } from "node:crypto";
import type { Database } from "@mediacion/db-types";
import { Kysely, PostgresDialect, sql } from "kysely";
import { Pool } from "pg";
import { UsersRepository } from "../auth/users.repository";
import { MeService } from "./me.service";
import {
  defaultNotificationPreferences,
  notificationPreferenceKeys,
} from "./notification-preferences";

const describeDb = process.env.DATABASE_URL ? describe : describe.skip;

describeDb(
  "notification preferences and deactivation against a real database",
  () => {
    let kysely: Kysely<Database>;
    let service: MeService;
    const usuarioId = randomUUID();

    beforeAll(async () => {
      kysely = new Kysely<Database>({
        dialect: new PostgresDialect({
          pool: new Pool({ connectionString: process.env.DATABASE_URL }),
        }),
      });
      service = new MeService(new UsersRepository(kysely));

      await sql`
      insert into auth.users (id, email, raw_user_meta_data)
      values (${usuarioId}, ${`prefs-${usuarioId}@test.local`},
              ${JSON.stringify({ nombre: "Pref", apellido: "Test" })}::jsonb)
    `.execute(kysely);
    });

    afterAll(async () => {
      await sql`delete from auth.users where id = ${usuarioId}`.execute(kysely);
      await kysely.destroy();
    });

    it("a freshly provisioned user is opted in to everything", async () => {
      // The column default has to match what the system actually does today,
      // otherwise the migration silently opts every existing user out.
      await expect(
        service.findNotificationPreferences(usuarioId),
      ).resolves.toEqual(defaultNotificationPreferences());
    });

    it("a partial patch changes only what it names", async () => {
      const updated = await service.updateNotificationPreferences(usuarioId, {
        caseUpdates: false,
      });
      expect(updated.caseUpdates).toBe(false);
      expect(updated.proposalReady).toBe(true);
      expect(Object.keys(updated).sort()).toEqual(
        [...notificationPreferenceKeys].sort(),
      );

      // Read back through a separate call: the merge has to be persisted, not
      // just returned.
      const reread = await service.findNotificationPreferences(usuarioId);
      expect(reread.caseUpdates).toBe(false);
      expect(reread.proposalReady).toBe(true);
    });

    it("a second patch does not reset the first one", async () => {
      await service.updateNotificationPreferences(usuarioId, {
        productUpdates: false,
      });
      const reread = await service.findNotificationPreferences(usuarioId);
      expect(reread.caseUpdates).toBe(false);
      expect(reread.productUpdates).toBe(false);
    });

    it("rejects a patch with nothing usable in it", async () => {
      await expect(
        service.updateNotificationPreferences(usuarioId, { invented: true }),
      ).rejects.toMatchObject({ status: 400 });
    });

    it("records a deactivation request and deactivates the account", async () => {
      const result = await service.requestDeactivation(usuarioId);
      expect(result.status).toBe("requested");
      expect(result.requestedAt).toBeTruthy();

      const row = await kysely
        .selectFrom("usuarios")
        .select(["activo", "desactivacion_solicitada_at"])
        .where("id", "=", usuarioId)
        .executeTakeFirstOrThrow();
      // Both, not one: the flag is what stops access, the timestamp is what makes
      // it attributable.
      expect(row.activo).toBe(false);
      expect(row.desactivacion_solicitada_at).not.toBeNull();
    });

    it("is idempotent — a repeat call returns the original timestamp, never a new one", async () => {
      const first = await service.requestDeactivation(usuarioId);
      const second = await service.requestDeactivation(usuarioId);
      expect(second.status).toBe("already_requested");
      expect(second.requestedAt).toBe(first.requestedAt);
    });
  },
);
