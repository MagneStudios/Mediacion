import { ConfiguracionRepository } from "./configuracion.repository";
import type { UpdateIaConfigDto } from "./types";

describe("ConfiguracionRepository", () => {
  describe("upsertIaKeys", () => {
    function createFakeTrxKysely() {
      const valuesCalls: Array<{ clave: string }> = [];
      const execute = jest.fn().mockResolvedValue(undefined);
      const onConflict = jest.fn().mockReturnValue({ execute });
      const trxValues = jest.fn((v: { clave: string; valor: unknown }) => {
        valuesCalls.push({ clave: v.clave });
        return { onConflict };
      });
      const trxInsertInto = jest.fn().mockReturnValue({ values: trxValues });
      const trx = { insertInto: trxInsertInto };
      const transactionExecute = jest.fn(
        (callback: (trx: unknown) => unknown) => callback(trx),
      );
      const transaction = jest
        .fn()
        .mockReturnValue({ execute: transactionExecute });
      const kysely = { transaction };

      return {
        kysely,
        transaction,
        transactionExecute,
        trxInsertInto,
        trxValues,
        onConflict,
        execute,
        valuesCalls,
      };
    }

    function createFakeTrxKyselyWithSecondRejecting(error: unknown) {
      const valuesCalls: Array<{ clave: string }> = [];
      const execute = jest
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(error);
      const onConflict = jest.fn().mockReturnValue({ execute });
      const trxValues = jest.fn((v: { clave: string; valor: unknown }) => {
        valuesCalls.push({ clave: v.clave });
        return { onConflict };
      });
      const trxInsertInto = jest.fn().mockReturnValue({ values: trxValues });
      const trx = { insertInto: trxInsertInto };
      const transactionExecute = jest.fn(
        (callback: (trx: unknown) => unknown) => callback(trx),
      );
      const transaction = jest
        .fn()
        .mockReturnValue({ execute: transactionExecute });
      const kysely = { transaction };

      return { kysely, transaction, trxInsertInto, valuesCalls };
    }

    it("upserts every provided key inside a single kysely transaction", async () => {
      const fake = createFakeTrxKysely();
      const repository = new ConfiguracionRepository(fake.kysely as never);
      const patch: UpdateIaConfigDto = {
        ia_modelo: "openai/gpt-4",
        ia_temperature: 0.5,
        ia_max_tokens: 1000,
      };

      const updated = await repository.upsertIaKeys(patch);

      expect(fake.transaction).toHaveBeenCalledTimes(1);
      expect(fake.trxInsertInto).toHaveBeenCalledWith("configuracion");
      expect(fake.valuesCalls).toEqual([
        { clave: "ia_modelo" },
        { clave: "ia_temperature" },
        { clave: "ia_max_tokens" },
      ]);
      expect(updated).toEqual(["ia_modelo", "ia_temperature", "ia_max_tokens"]);
    });

    it("propagates a rejection from the second key's write, leaving no key committed independently", async () => {
      const writeError = new Error("connection lost");
      const fake = createFakeTrxKyselyWithSecondRejecting(writeError);
      const repository = new ConfiguracionRepository(fake.kysely as never);
      const patch: UpdateIaConfigDto = {
        ia_modelo: "openai/gpt-4",
        ia_temperature: 0.5,
        ia_max_tokens: 1000,
      };

      await expect(repository.upsertIaKeys(patch)).rejects.toThrow(
        "connection lost",
      );
      expect(fake.transaction).toHaveBeenCalledTimes(1);
      expect(fake.trxInsertInto).toHaveBeenCalledWith("configuracion");
      expect(fake.valuesCalls).toEqual([
        { clave: "ia_modelo" },
        { clave: "ia_temperature" },
      ]);
    });
  });
});
