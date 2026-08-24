import { PagosRepository } from "./pagos.repository";

describe("PagosRepository", () => {
  describe("findSuscripcionForPreference", () => {
    function buildFakeSelectKysely(row: unknown) {
      const executeTakeFirst = jest.fn().mockResolvedValue(row);
      const ownerWhere = jest.fn().mockReturnValue({ executeTakeFirst });
      const idWhere = jest.fn().mockReturnValue({ where: ownerWhere });
      const select = jest.fn().mockReturnValue({ where: idWhere });
      const innerJoin = jest.fn().mockReturnValue({ select });
      const selectFrom = jest.fn().mockReturnValue({ innerJoin });
      return {
        kysely: { selectFrom },
        selectFrom,
        innerJoin,
        select,
        idWhere,
        ownerWhere,
        executeTakeFirst,
      };
    }

    function invokeOwnerPredicate(ownerWhere: jest.Mock) {
      const callback = ownerWhere.mock.calls[0][0] as (eb: unknown) => unknown;
      const comparisons: unknown[] = [];
      const fakeEb = Object.assign(
        jest.fn((column: string, op: string, value: unknown) => {
          const comparison = { column, op, value };
          comparisons.push(comparison);
          return comparison;
        }),
        { or: jest.fn((expressions: unknown[]) => expressions) },
      );
      callback(fakeEb);
      return { fakeEb, comparisons };
    }

    it("joins suscripciones with planes and selects only the fields needed for a preference", async () => {
      const row = {
        id: "sus-1",
        plan_nombre: "plus",
        plan_precio: 19.99,
        plan_moneda: "ARS",
      };
      const fake = buildFakeSelectKysely(row);
      const repository = new PagosRepository(fake.kysely as never);

      const result = await repository.findSuscripcionForPreference("sus-1", {
        usuarioId: "user-a",
        estudioId: null,
      });

      expect(fake.selectFrom).toHaveBeenCalledWith("suscripciones");
      expect(fake.innerJoin).toHaveBeenCalledWith(
        "planes",
        "planes.id",
        "suscripciones.plan_id",
      );
      expect(fake.select).toHaveBeenCalledWith([
        "suscripciones.id",
        "planes.nombre as plan_nombre",
        "planes.precio as plan_precio",
        "planes.moneda as plan_moneda",
      ]);
      expect(fake.idWhere).toHaveBeenCalledWith(
        "suscripciones.id",
        "=",
        "sus-1",
      );
      expect(result).toBe(row);
    });

    it("filters by the suscripcion id AND (usuario_id OR estudio_id) matching the caller", async () => {
      const fake = buildFakeSelectKysely(undefined);
      const repository = new PagosRepository(fake.kysely as never);

      await repository.findSuscripcionForPreference("sus-1", {
        usuarioId: "user-a",
        estudioId: "estudio-1",
      });

      expect(fake.ownerWhere).toHaveBeenCalledWith(expect.any(Function));
      const { fakeEb, comparisons } = invokeOwnerPredicate(fake.ownerWhere);
      expect(comparisons).toEqual([
        { column: "suscripciones.usuario_id", op: "=", value: "user-a" },
        { column: "suscripciones.estudio_id", op: "=", value: "estudio-1" },
      ]);
      expect(fakeEb.or).toHaveBeenCalledWith(comparisons);
    });

    it("returns undefined when no matching suscripcion exists for the caller", async () => {
      const fake = buildFakeSelectKysely(undefined);
      const repository = new PagosRepository(fake.kysely as never);

      const result = await repository.findSuscripcionForPreference("sus-x", {
        usuarioId: "user-a",
        estudioId: null,
      });

      expect(result).toBeUndefined();
    });

    it("returns undefined when the suscripcion exists but belongs to a different owner", async () => {
      const fake = buildFakeSelectKysely(undefined);
      const repository = new PagosRepository(fake.kysely as never);

      const result = await repository.findSuscripcionForPreference("sus-1", {
        usuarioId: "intruder",
        estudioId: null,
      });

      expect(result).toBeUndefined();
    });
  });

  describe("applyPayment", () => {
    function buildFakeTrxKysely(
      upsertedRows: Array<{
        id: string;
        estado: string;
      }>,
    ) {
      const execute = jest.fn().mockResolvedValue(upsertedRows);
      const returning = jest.fn().mockReturnValue({ execute });
      const ocWhere = jest.fn().mockReturnValue({ returning: undefined });
      const ocDoUpdateSet = jest.fn().mockReturnValue({ where: ocWhere });
      const ocColumn = jest.fn().mockReturnValue({
        doUpdateSet: ocDoUpdateSet,
      });
      const fakeOc = { column: ocColumn };
      const onConflict = jest.fn((callback: (oc: unknown) => unknown) => {
        callback(fakeOc);
        return { returning };
      });
      const insertValues = jest.fn().mockReturnValue({ onConflict });
      const insertInto = jest.fn().mockReturnValue({ values: insertValues });
      const updateExecute = jest.fn().mockResolvedValue(undefined);
      const updateWhere = jest.fn().mockReturnValue({ execute: updateExecute });
      const updateSet = jest.fn().mockReturnValue({ where: updateWhere });
      const updateTable = jest.fn().mockReturnValue({ set: updateSet });
      const trx = { insertInto, updateTable };
      const transactionExecute = jest.fn(
        (callback: (trx: unknown) => unknown) => callback(trx),
      );
      const transaction = jest
        .fn()
        .mockReturnValue({ execute: transactionExecute });
      return {
        kysely: { transaction },
        insertInto,
        insertValues,
        onConflict,
        ocColumn,
        ocDoUpdateSet,
        ocWhere,
        returning,
        updateTable,
        updateSet,
        updateWhere,
      };
    }

    it("inserts the pago row and activates the suscripcion when the payment is approved and new", async () => {
      const fake = buildFakeTrxKysely([{ id: "pago-1", estado: "aprobado" }]);
      const repository = new PagosRepository(fake.kysely as never);

      const result = await repository.applyPayment({
        suscripcionId: "sus-1",
        mpPaymentId: "mp-1",
        estadoPago: "aprobado",
        monto: 19.99,
        rawWebhook: { id: "mp-1" },
      });

      expect(result).toEqual({ applied: true });
      expect(fake.insertInto).toHaveBeenCalledWith("pagos");
      expect(fake.insertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          suscripcion_id: "sus-1",
          mp_payment_id: "mp-1",
          estado: "aprobado",
          monto: 19.99,
        }),
      );
      expect(fake.updateTable).toHaveBeenCalledWith("suscripciones");
      expect(fake.updateSet).toHaveBeenCalledWith(
        expect.objectContaining({ estado: "activa" }),
      );
      expect(fake.updateWhere).toHaveBeenCalledWith("id", "=", "sus-1");
    });

    it("upserts on mp_payment_id conflict instead of doing nothing, guarding against downgrading an approved row", async () => {
      const fake = buildFakeTrxKysely([{ id: "pago-1", estado: "aprobado" }]);
      const repository = new PagosRepository(fake.kysely as never);

      await repository.applyPayment({
        suscripcionId: "sus-1",
        mpPaymentId: "mp-1",
        estadoPago: "aprobado",
        monto: 19.99,
        rawWebhook: { id: "mp-1" },
      });

      expect(fake.ocColumn).toHaveBeenCalledWith("mp_payment_id");
      expect(fake.ocDoUpdateSet).toHaveBeenCalledWith({
        estado: "aprobado",
        raw_webhook: { id: "mp-1" },
      });
      expect(fake.ocWhere).toHaveBeenCalledWith(
        "pagos.estado",
        "!=",
        "aprobado",
      );
      expect(fake.returning).toHaveBeenCalledWith(["id", "estado"]);
    });

    it("activates the suscripcion when a later approved webhook transitions a previously pendiente row", async () => {
      const fake = buildFakeTrxKysely([{ id: "pago-1", estado: "aprobado" }]);
      const repository = new PagosRepository(fake.kysely as never);

      const result = await repository.applyPayment({
        suscripcionId: "sus-1",
        mpPaymentId: "mp-1",
        estadoPago: "aprobado",
        monto: 19.99,
        rawWebhook: { id: "mp-1", status: "approved" },
      });

      expect(result).toEqual({ applied: true });
      expect(fake.updateTable).toHaveBeenCalledWith("suscripciones");
    });

    it("does not activate the suscripcion when the upserted row is not approved (still pendiente)", async () => {
      const fake = buildFakeTrxKysely([{ id: "pago-1", estado: "pendiente" }]);
      const repository = new PagosRepository(fake.kysely as never);

      const result = await repository.applyPayment({
        suscripcionId: "sus-1",
        mpPaymentId: "mp-1",
        estadoPago: "pendiente",
        monto: 19.99,
        rawWebhook: { id: "mp-1" },
      });

      expect(result).toEqual({ applied: true });
      expect(fake.updateTable).not.toHaveBeenCalled();
    });

    it("does not downgrade nor deactivate when a late pendiente webhook is guarded out by an already-aprobado row", async () => {
      const fake = buildFakeTrxKysely([]);
      const repository = new PagosRepository(fake.kysely as never);

      const result = await repository.applyPayment({
        suscripcionId: "sus-1",
        mpPaymentId: "mp-1",
        estadoPago: "pendiente",
        monto: 19.99,
        rawWebhook: { id: "mp-1" },
      });

      expect(result).toEqual({ applied: false });
      expect(fake.updateTable).not.toHaveBeenCalled();
    });

    it("stays idempotent for a duplicate aprobado redelivery of the same mp_payment_id (no double side effects)", async () => {
      const fake = buildFakeTrxKysely([]);
      const repository = new PagosRepository(fake.kysely as never);

      const result = await repository.applyPayment({
        suscripcionId: "sus-1",
        mpPaymentId: "mp-1",
        estadoPago: "aprobado",
        monto: 19.99,
        rawWebhook: { id: "mp-1" },
      });

      expect(result).toEqual({ applied: false });
      expect(fake.updateTable).not.toHaveBeenCalled();
    });
  });
});
