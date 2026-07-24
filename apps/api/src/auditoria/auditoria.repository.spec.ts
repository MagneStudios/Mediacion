import { AuditoriaRepository } from "./auditoria.repository";

describe("AuditoriaRepository", () => {
  describe("findPage", () => {
    function createFakeKysely(rows: unknown[]) {
      const execute = jest.fn().mockResolvedValue(rows);
      const offset = jest.fn().mockReturnValue({ execute });
      const limit = jest.fn().mockReturnValue({ offset });
      const orderBy = jest.fn().mockReturnValue({ limit });
      const selectAll = jest.fn().mockReturnValue({ orderBy });
      const selectFrom = jest.fn().mockReturnValue({ selectAll });
      return { selectFrom, orderBy, limit, offset, execute };
    }

    function createFakeKyselyRejecting(error: unknown) {
      const execute = jest.fn().mockRejectedValue(error);
      const offset = jest.fn().mockReturnValue({ execute });
      const limit = jest.fn().mockReturnValue({ offset });
      const orderBy = jest.fn().mockReturnValue({ limit });
      const selectAll = jest.fn().mockReturnValue({ orderBy });
      const selectFrom = jest.fn().mockReturnValue({ selectAll });
      return { selectFrom };
    }

    it("orders rows by created_at desc and applies the requested page slice", async () => {
      const rows = [{ id: "1" }, { id: "2" }];
      const fake = createFakeKysely(rows);
      const repository = new AuditoriaRepository(fake as never);

      const result = await repository.findPage(20, 20);

      expect(fake.selectFrom).toHaveBeenCalledWith("auditoria");
      expect(fake.orderBy).toHaveBeenCalledWith("created_at", "desc");
      expect(fake.limit).toHaveBeenCalledWith(20);
      expect(fake.offset).toHaveBeenCalledWith(20);
      expect(result).toEqual(rows);
    });

    it("maps a rejected query into a domain error", async () => {
      const fake = createFakeKyselyRejecting("connection lost");
      const repository = new AuditoriaRepository(fake as never);

      await expect(repository.findPage(0, 20)).rejects.toThrow(
        "connection lost",
      );
    });
  });

  describe("count", () => {
    function createFakeKysely(total: string) {
      const executeTakeFirstOrThrow = jest.fn().mockResolvedValue({ total });
      const select = jest.fn().mockReturnValue({ executeTakeFirstOrThrow });
      const selectFrom = jest.fn().mockReturnValue({ select });
      return { selectFrom };
    }

    function createFakeKyselyRejecting(error: unknown) {
      const executeTakeFirstOrThrow = jest.fn().mockRejectedValue(error);
      const select = jest.fn().mockReturnValue({ executeTakeFirstOrThrow });
      const selectFrom = jest.fn().mockReturnValue({ select });
      return { selectFrom };
    }

    it("returns the total row count as a number", async () => {
      const fake = createFakeKysely("42");
      const repository = new AuditoriaRepository(fake as never);

      const result = await repository.count();

      expect(fake.selectFrom).toHaveBeenCalledWith("auditoria");
      expect(result).toBe(42);
    });

    it("maps a rejected query into a domain error", async () => {
      const fake = createFakeKyselyRejecting("connection lost");
      const repository = new AuditoriaRepository(fake as never);

      await expect(repository.count()).rejects.toThrow("connection lost");
    });
  });
});
