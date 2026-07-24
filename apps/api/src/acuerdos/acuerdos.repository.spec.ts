import { HttpException } from "@nestjs/common";
import { ConflictError } from "../common/errors/domain-errors";
import { AcuerdosRepository } from "./acuerdos.repository";
import type { FirmasRepository } from "./firmas.repository";

describe("AcuerdosRepository", () => {
  function createFakeKysely(options: {
    existing: { id: string } | undefined;
    inserted: unknown;
    insertRejection?: unknown;
  }) {
    const existingExecuteTakeFirst = jest
      .fn()
      .mockResolvedValue(options.existing);
    const existingWhere = jest
      .fn()
      .mockReturnValue({ executeTakeFirst: existingExecuteTakeFirst });
    const existingSelect = jest.fn().mockReturnValue({ where: existingWhere });

    const executeTakeFirstOrThrow = options.insertRejection
      ? jest.fn().mockRejectedValue(options.insertRejection)
      : jest.fn().mockResolvedValue(options.inserted);
    const returningAll = jest.fn().mockReturnValue({ executeTakeFirstOrThrow });
    const values = jest.fn().mockReturnValue({ returningAll });
    const insertInto = jest.fn().mockReturnValue({ values });

    const selectFrom = jest.fn().mockReturnValue({ select: existingSelect });
    const trx = { selectFrom, insertInto };
    const execute = jest.fn((callback: (trx: unknown) => unknown) =>
      callback(trx),
    );
    const transaction = jest.fn().mockReturnValue({ execute });

    return {
      transaction,
      selectFrom,
      existingSelect,
      existingWhere,
      insertInto,
      values,
      returningAll,
    };
  }

  it("inserts a draft acuerdo scoped to the caso when none exists yet", async () => {
    const inserted = { id: "acuerdo-1", caso_id: "caso-1", estado: "borrador" };
    const fakeKysely = createFakeKysely({ existing: undefined, inserted });
    const repository = new AcuerdosRepository(
      fakeKysely as never,
      { insertMany: jest.fn() } as unknown as FirmasRepository,
    );

    const result = await repository.insertDraft("caso-1", { split: "50/50" });

    expect(fakeKysely.selectFrom).toHaveBeenCalledWith("acuerdos");
    expect(fakeKysely.existingWhere).toHaveBeenCalledWith(
      "caso_id",
      "=",
      "caso-1",
    );
    expect(fakeKysely.insertInto).toHaveBeenCalledWith("acuerdos");
    expect(fakeKysely.values).toHaveBeenCalledWith(
      expect.objectContaining({ caso_id: "caso-1", estado: "borrador" }),
    );
    expect(result).toBe(inserted);
  });

  it("rejects with 409 acuerdo_already_exists without inserting when a draft already exists", async () => {
    const fakeKysely = createFakeKysely({
      existing: { id: "acuerdo-0" },
      inserted: undefined,
    });
    const repository = new AcuerdosRepository(
      fakeKysely as never,
      { insertMany: jest.fn() } as unknown as FirmasRepository,
    );

    let thrown: unknown;
    try {
      await repository.insertDraft("caso-1", { split: "50/50" });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(HttpException);
    expect((thrown as HttpException).getStatus()).toBe(409);
    expect((thrown as HttpException).getResponse()).toEqual(
      expect.objectContaining({ code: "acuerdo_already_exists" }),
    );
    expect(fakeKysely.insertInto).not.toHaveBeenCalled();
  });

  it("maps a pg unique-violation 23505 race on the caso_id constraint to a domain ConflictError", async () => {
    const fakeKysely = createFakeKysely({
      existing: undefined,
      inserted: undefined,
      insertRejection: {
        code: "23505",
        message:
          'duplicate key value violates unique constraint "acuerdos_caso_unique"',
      },
    });
    const repository = new AcuerdosRepository(
      fakeKysely as never,
      { insertMany: jest.fn() } as unknown as FirmasRepository,
    );

    await expect(
      repository.insertDraft("caso-1", { split: "50/50" }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  describe("findById", () => {
    it("reads an acuerdo by id", async () => {
      const acuerdo = {
        id: "acuerdo-1",
        caso_id: "caso-1",
        estado: "borrador",
      };
      const executeTakeFirst = jest.fn().mockResolvedValue(acuerdo);
      const where = jest.fn().mockReturnValue({ executeTakeFirst });
      const selectAll = jest.fn().mockReturnValue({ where });
      const selectFrom = jest.fn().mockReturnValue({ selectAll });
      const repository = new AcuerdosRepository(
        { selectFrom } as never,
        { insertMany: jest.fn() } as unknown as FirmasRepository,
      );

      const result = await repository.findById("acuerdo-1");

      expect(selectFrom).toHaveBeenCalledWith("acuerdos");
      expect(where).toHaveBeenCalledWith("id", "=", "acuerdo-1");
      expect(result).toBe(acuerdo);
    });
  });

  describe("claimForSignature", () => {
    function createFakeClaimKysely(claimed: { id: string } | undefined) {
      const executeTakeFirst = jest.fn().mockResolvedValue(claimed);
      const returningAll = jest.fn().mockReturnValue({ executeTakeFirst });
      const where2 = jest.fn().mockReturnValue({ returningAll });
      const where1 = jest.fn().mockReturnValue({ where: where2 });
      const set = jest.fn().mockReturnValue({ where: where1 });
      const updateTable = jest.fn().mockReturnValue({ set });
      return { updateTable, set, where1, where2 };
    }

    it("CAS-updates estado from borrador to enviado_a_firma without touching the envelope id", async () => {
      const claimed = {
        id: "acuerdo-1",
        caso_id: "caso-1",
        estado: "enviado_a_firma",
      };
      const fakeKysely = createFakeClaimKysely(claimed);
      const repository = new AcuerdosRepository(
        fakeKysely as never,
        { insertMany: jest.fn() } as unknown as FirmasRepository,
      );

      const result = await repository.claimForSignature("acuerdo-1");

      expect(fakeKysely.updateTable).toHaveBeenCalledWith("acuerdos");
      expect(fakeKysely.set).toHaveBeenCalledWith({
        estado: "enviado_a_firma",
      });
      expect(fakeKysely.where1).toHaveBeenCalledWith("id", "=", "acuerdo-1");
      expect(fakeKysely.where2).toHaveBeenCalledWith("estado", "=", "borrador");
      expect(result).toBe(claimed);
    });

    it("rejects with a conflict when the acuerdo is no longer in borrador state (race guard)", async () => {
      const fakeKysely = createFakeClaimKysely(undefined);
      const repository = new AcuerdosRepository(
        fakeKysely as never,
        { insertMany: jest.fn() } as unknown as FirmasRepository,
      );

      let thrown: unknown;
      try {
        await repository.claimForSignature("acuerdo-1");
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(HttpException);
      expect((thrown as HttpException).getStatus()).toBe(409);
    });
  });

  describe("persistSignatureEnvelope", () => {
    it("sets the docusign envelope id and inserts one firma per party inside a single transaction", async () => {
      const updated = {
        id: "acuerdo-1",
        caso_id: "caso-1",
        estado: "enviado_a_firma",
        docusign_envelope_id: "envelope-1",
      };
      const executeTakeFirstOrThrow = jest.fn().mockResolvedValue(updated);
      const returningAll = jest
        .fn()
        .mockReturnValue({ executeTakeFirstOrThrow });
      const where = jest.fn().mockReturnValue({ returningAll });
      const set = jest.fn().mockReturnValue({ where });
      const updateTable = jest.fn().mockReturnValue({ set });
      const trx = { updateTable };
      const execute = jest.fn((callback: (trx: unknown) => unknown) =>
        callback(trx),
      );
      const transaction = jest.fn().mockReturnValue({ execute });
      const insertMany = jest.fn().mockResolvedValue([]);
      const repository = new AcuerdosRepository(
        { transaction } as never,
        { insertMany } as unknown as FirmasRepository,
      );

      const result = await repository.persistSignatureEnvelope(
        "acuerdo-1",
        "envelope-1",
        ["user-a", "user-b"],
      );

      expect(updateTable).toHaveBeenCalledWith("acuerdos");
      expect(set).toHaveBeenCalledWith({ docusign_envelope_id: "envelope-1" });
      expect(where).toHaveBeenCalledWith("id", "=", "acuerdo-1");
      expect(insertMany).toHaveBeenCalledWith(
        "acuerdo-1",
        ["user-a", "user-b"],
        trx,
      );
      expect(result).toBe(updated);
    });
  });

  describe("revertClaimToBorrador", () => {
    it("CAS-reverts estado from enviado_a_firma back to borrador when no envelope was persisted", async () => {
      const execute = jest.fn().mockResolvedValue(undefined);
      const where3 = jest.fn().mockReturnValue({ execute });
      const where2 = jest.fn().mockReturnValue({ where: where3 });
      const where1 = jest.fn().mockReturnValue({ where: where2 });
      const set = jest.fn().mockReturnValue({ where: where1 });
      const updateTable = jest.fn().mockReturnValue({ set });
      const repository = new AcuerdosRepository(
        { updateTable } as never,
        { insertMany: jest.fn() } as unknown as FirmasRepository,
      );

      await repository.revertClaimToBorrador("acuerdo-1");

      expect(updateTable).toHaveBeenCalledWith("acuerdos");
      expect(set).toHaveBeenCalledWith({ estado: "borrador" });
      expect(where1).toHaveBeenCalledWith("id", "=", "acuerdo-1");
      expect(where2).toHaveBeenCalledWith("estado", "=", "enviado_a_firma");
      expect(where3).toHaveBeenCalledWith("docusign_envelope_id", "is", null);
    });
  });

  describe("markFirmado", () => {
    it("updates the acuerdo estado to firmado only from enviado_a_firma", async () => {
      const execute = jest.fn().mockResolvedValue(undefined);
      const where2 = jest.fn().mockReturnValue({ execute });
      const where1 = jest.fn().mockReturnValue({ where: where2 });
      const set = jest.fn().mockReturnValue({ where: where1 });
      const updateTable = jest.fn().mockReturnValue({ set });
      const repository = new AcuerdosRepository(
        { updateTable } as never,
        { insertMany: jest.fn() } as unknown as FirmasRepository,
      );

      await repository.markFirmado("acuerdo-1");

      expect(updateTable).toHaveBeenCalledWith("acuerdos");
      expect(set).toHaveBeenCalledWith({ estado: "firmado" });
      expect(where1).toHaveBeenCalledWith("id", "=", "acuerdo-1");
      expect(where2).toHaveBeenCalledWith("estado", "=", "enviado_a_firma");
    });
  });
});
