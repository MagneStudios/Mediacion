import { PagosRepository } from "./pagos.repository";

describe("PagosRepository", () => {
  describe("findSuscripcionForPreference", () => {
    it("joins suscripciones with planes and selects only the fields needed for a preference", async () => {
      const row = { id: "sus-1", plan_nombre: "plus", plan_precio: 19.99 };
      const executeTakeFirst = jest.fn().mockResolvedValue(row);
      const where = jest.fn().mockReturnValue({ executeTakeFirst });
      const select = jest.fn().mockReturnValue({ where });
      const innerJoin = jest.fn().mockReturnValue({ select });
      const selectFrom = jest.fn().mockReturnValue({ innerJoin });
      const kysely = { selectFrom };
      const repository = new PagosRepository(kysely as never);

      const result = await repository.findSuscripcionForPreference("sus-1");

      expect(selectFrom).toHaveBeenCalledWith("suscripciones");
      expect(innerJoin).toHaveBeenCalledWith(
        "planes",
        "planes.id",
        "suscripciones.plan_id",
      );
      expect(where).toHaveBeenCalledWith("suscripciones.id", "=", "sus-1");
      expect(result).toBe(row);
    });

    it("returns undefined when no matching suscripcion exists", async () => {
      const executeTakeFirst = jest.fn().mockResolvedValue(undefined);
      const where = jest.fn().mockReturnValue({ executeTakeFirst });
      const select = jest.fn().mockReturnValue({ where });
      const innerJoin = jest.fn().mockReturnValue({ select });
      const selectFrom = jest.fn().mockReturnValue({ innerJoin });
      const kysely = { selectFrom };
      const repository = new PagosRepository(kysely as never);

      const result = await repository.findSuscripcionForPreference("sus-x");

      expect(result).toBeUndefined();
    });
  });

  describe("applyPayment", () => {
    function buildFakeTrxKysely(insertedRows: Array<{ id: string }>) {
      const execute = jest.fn().mockResolvedValue(insertedRows);
      const returning = jest.fn().mockReturnValue({ execute });
      const onConflict = jest.fn().mockReturnValue({ returning });
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
        returning,
        updateTable,
        updateSet,
        updateWhere,
      };
    }

    it("inserts the pago row and activates the suscripcion when the payment is approved and unseen", async () => {
      const fake = buildFakeTrxKysely([{ id: "pago-1" }]);
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

    it("does not re-apply the state change when mp_payment_id already exists (0 rows inserted)", async () => {
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

    it("does not activate the suscripcion when the payment is not approved", async () => {
      const fake = buildFakeTrxKysely([{ id: "pago-1" }]);
      const repository = new PagosRepository(fake.kysely as never);

      const result = await repository.applyPayment({
        suscripcionId: "sus-1",
        mpPaymentId: "mp-1",
        estadoPago: "rechazado",
        monto: 19.99,
        rawWebhook: { id: "mp-1" },
      });

      expect(result).toEqual({ applied: true });
      expect(fake.updateTable).not.toHaveBeenCalled();
    });
  });
});
