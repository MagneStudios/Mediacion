import { HttpException } from "@nestjs/common";
import { ConflictError } from "../common/errors/domain-errors";
import { AcuerdosRepository } from "./acuerdos.repository";

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
    const repository = new AcuerdosRepository(fakeKysely as never);

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
    const repository = new AcuerdosRepository(fakeKysely as never);

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
    const repository = new AcuerdosRepository(fakeKysely as never);

    await expect(
      repository.insertDraft("caso-1", { split: "50/50" }),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});
