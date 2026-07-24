import { ItemsRepository } from "./items.repository";
import type { CreateItemDto } from "./items.types";

describe("ItemsRepository", () => {
  describe("createOwn", () => {
    function createFakeKysely(insertedItem: unknown) {
      const executeTakeFirstOrThrow = jest.fn().mockResolvedValue(insertedItem);
      const returning = jest.fn().mockReturnValue({ executeTakeFirstOrThrow });
      const values = jest.fn().mockReturnValue({ returning });
      const insertInto = jest.fn().mockReturnValue({ values });
      return { insertInto, values, returning, executeTakeFirstOrThrow };
    }

    it("inserts an item scoped to the caso and the caller as parte_id", async () => {
      const insertedItem = {
        id: "item-1",
        caso_id: "caso-1",
        parte_id: "user-a",
      };
      const fakeKysely = createFakeKysely(insertedItem);
      const repository = new ItemsRepository(fakeKysely as never);
      const dto: CreateItemDto = { categoria: "bienes", nombre: "Auto" };

      const result = await repository.createOwn(dto, "caso-1", "user-a");

      expect(fakeKysely.insertInto).toHaveBeenCalledWith("items");
      expect(fakeKysely.values).toHaveBeenCalledWith(
        expect.objectContaining({
          caso_id: "caso-1",
          parte_id: "user-a",
          categoria: "bienes",
          nombre: "Auto",
        }),
      );
      expect(result).toBe(insertedItem);
    });

    it("never lets the caller pick a different parte_id than their own", async () => {
      const fakeKysely = createFakeKysely({ id: "item-2" });
      const repository = new ItemsRepository(fakeKysely as never);
      const dto: CreateItemDto = { categoria: "economico", nombre: "Ahorros" };

      await repository.createOwn(dto, "caso-1", "user-b");

      const insertedValues = fakeKysely.values.mock.calls[0][0];
      expect(insertedValues.parte_id).toBe("user-b");
    });
  });

  describe("findOwn — RN-01 isolation (adversarial)", () => {
    function createBehavioralKysely(
      items: Array<{ id: string; caso_id: string; parte_id: string }>,
    ) {
      const predicates: Array<[string, string, unknown]> = [];
      const chain: {
        selectFrom: jest.Mock;
        select: jest.Mock;
        where: jest.Mock;
        execute: jest.Mock;
      } = {
        selectFrom: jest.fn(),
        select: jest.fn(),
        where: jest.fn(),
        execute: jest.fn(),
      };
      chain.selectFrom.mockReturnValue(chain);
      chain.select.mockReturnValue(chain);
      chain.where.mockImplementation(
        (column: string, _operator: string, value: unknown) => {
          predicates.push([column, _operator, value]);
          return chain;
        },
      );
      chain.execute.mockImplementation(async () => {
        const casoPredicate = predicates.find(
          ([column]) => column === "caso_id",
        );
        const partePredicate = predicates.find(
          ([column]) => column === "parte_id",
        );
        if (!casoPredicate || !partePredicate) {
          throw new Error("findOwn must scope by both caso_id and parte_id");
        }
        const casoId = casoPredicate[2];
        const callerId = partePredicate[2];
        return items.filter(
          (item) => item.caso_id === casoId && item.parte_id === callerId,
        );
      });
      return chain;
    }

    it("returns only party A's own items, zero of party B's items, in a shared case", async () => {
      const itemA1 = { id: "item-a1", caso_id: "caso-1", parte_id: "user-a" };
      const itemA2 = { id: "item-a2", caso_id: "caso-1", parte_id: "user-a" };
      const itemB1 = { id: "item-b1", caso_id: "caso-1", parte_id: "user-b" };
      const allItems = [itemA1, itemA2, itemB1];

      const fakeKyselyForA = createBehavioralKysely(allItems);
      const repositoryForA = new ItemsRepository(fakeKyselyForA as never);

      const resultForA = await repositoryForA.findOwn("caso-1", "user-a");

      expect(resultForA).toHaveLength(2);
      expect(resultForA).toEqual(expect.arrayContaining([itemA1, itemA2]));
      expect(resultForA).not.toContainEqual(itemB1);
      expect(resultForA.some((item) => item.id === itemB1.id)).toBe(false);

      const fakeKyselyForB = createBehavioralKysely(allItems);
      const repositoryForB = new ItemsRepository(fakeKyselyForB as never);

      const resultForB = await repositoryForB.findOwn("caso-1", "user-b");

      expect(resultForB).toEqual([itemB1]);
      expect(resultForB).not.toContainEqual(itemA1);
      expect(resultForB).not.toContainEqual(itemA2);
    });
  });

  describe("findOwnById — enumeration defense", () => {
    function createFakeSelectKysely(row: unknown) {
      const executeTakeFirst = jest.fn().mockResolvedValue(row);
      const where2 = jest.fn().mockReturnValue({ executeTakeFirst });
      const where1 = jest.fn().mockReturnValue({ where: where2 });
      const select = jest.fn().mockReturnValue({ where: where1 });
      const selectFrom = jest.fn().mockReturnValue({ select });
      return { selectFrom, select, where1, where2, executeTakeFirst };
    }

    it("returns the item when it belongs to the caller", async () => {
      const row = { id: "item-1", parte_id: "user-a" };
      const fakeKysely = createFakeSelectKysely(row);
      const repository = new ItemsRepository(fakeKysely as never);

      const result = await repository.findOwnById("item-1", "user-a");

      expect(fakeKysely.where1).toHaveBeenCalledWith("id", "=", "item-1");
      expect(fakeKysely.where2).toHaveBeenCalledWith("parte_id", "=", "user-a");
      expect(result).toBe(row);
    });

    it("returns undefined — identical to a non-existent id — when the item belongs to another party", async () => {
      const fakeKysely = createFakeSelectKysely(undefined);
      const repository = new ItemsRepository(fakeKysely as never);

      const result = await repository.findOwnById("item-owned-by-b", "user-a");

      expect(result).toBeUndefined();
    });
  });

  describe("updateOwn — enumeration defense, single scoped statement", () => {
    function createFakeUpdateKysely(row: unknown) {
      const executeTakeFirst = jest.fn().mockResolvedValue(row);
      const returning = jest.fn().mockReturnValue({ executeTakeFirst });
      const where2 = jest.fn().mockReturnValue({ returning });
      const where1 = jest.fn().mockReturnValue({ where: where2 });
      const set = jest.fn().mockReturnValue({ where: where1 });
      const updateTable = jest.fn().mockReturnValue({ set });
      return {
        updateTable,
        set,
        where1,
        where2,
        returning,
        executeTakeFirst,
      };
    }

    it("updates the item and returns it when the caller owns it", async () => {
      const row = { id: "item-1", parte_id: "user-a", nombre: "Bici" };
      const fakeKysely = createFakeUpdateKysely(row);
      const repository = new ItemsRepository(fakeKysely as never);

      const result = await repository.updateOwn("item-1", "user-a", {
        nombre: "Bici",
      });

      expect(fakeKysely.updateTable).toHaveBeenCalledWith("items");
      expect(fakeKysely.where1).toHaveBeenCalledWith("id", "=", "item-1");
      expect(fakeKysely.where2).toHaveBeenCalledWith("parte_id", "=", "user-a");
      expect(result).toBe(row);
    });

    it("returns undefined for zero rows updated — identical whether foreign or non-existent", async () => {
      const fakeKysely = createFakeUpdateKysely(undefined);
      const repository = new ItemsRepository(fakeKysely as never);

      const result = await repository.updateOwn("item-owned-by-b", "user-a", {
        nombre: "Hijacked",
      });

      expect(result).toBeUndefined();
    });
  });

  describe("updateOwnWithLock — RN-02 race defense (transaction + row lock)", () => {
    function createFakeLockingTrx(options: {
      lockedId: string | undefined;
      current: Record<string, unknown> | undefined;
      updated: Record<string, unknown> | undefined;
    }) {
      const callOrder: string[] = [];

      const lockExecuteTakeFirst = jest.fn().mockImplementation(() => {
        callOrder.push("lock");
        return Promise.resolve(
          options.lockedId ? { id: options.lockedId } : undefined,
        );
      });
      const lockForUpdate = jest
        .fn()
        .mockReturnValue({ executeTakeFirst: lockExecuteTakeFirst });
      const lockWhere2 = jest
        .fn()
        .mockReturnValue({ forUpdate: lockForUpdate });
      const lockWhere1 = jest.fn().mockReturnValue({ where: lockWhere2 });

      const fetchExecuteTakeFirstOrThrow = jest.fn().mockImplementation(() => {
        callOrder.push("fetch");
        return Promise.resolve(options.current);
      });
      const fetchWhere2 = jest.fn().mockReturnValue({
        executeTakeFirstOrThrow: fetchExecuteTakeFirstOrThrow,
      });
      const fetchWhere1 = jest.fn().mockReturnValue({ where: fetchWhere2 });

      const itemsSelect = jest.fn((columns: unknown) => {
        if (columns === "id") {
          return { where: lockWhere1 };
        }
        return { where: fetchWhere1 };
      });

      const updateExecuteTakeFirst = jest.fn().mockImplementation(() => {
        callOrder.push("update");
        return Promise.resolve(options.updated);
      });
      const updateReturning = jest
        .fn()
        .mockReturnValue({ executeTakeFirst: updateExecuteTakeFirst });
      const updateWhere2 = jest
        .fn()
        .mockReturnValue({ returning: updateReturning });
      const updateWhere1 = jest.fn().mockReturnValue({ where: updateWhere2 });
      const updateSet = jest.fn().mockReturnValue({ where: updateWhere1 });

      const selectFrom = jest.fn().mockReturnValue({ select: itemsSelect });
      const updateTable = jest.fn().mockReturnValue({ set: updateSet });

      const trx = { selectFrom, updateTable };
      const execute = jest.fn((callback: (trx: unknown) => unknown) =>
        callback(trx),
      );
      const transaction = jest.fn().mockReturnValue({ execute });

      return {
        transaction,
        selectFrom,
        itemsSelect,
        lockWhere1,
        lockForUpdate,
        fetchWhere1,
        updateTable,
        updateSet,
        updateWhere1,
        callOrder,
      };
    }

    it("locks the item row before reading or updating it, serializing concurrent PATCHes", async () => {
      const current = {
        id: "item-1",
        parte_id: "user-a",
        valor_min: "50",
        valor_max: "2000",
      };
      const updated = { id: "item-1", parte_id: "user-a", nombre: "Bici" };
      const fakeKysely = createFakeLockingTrx({
        lockedId: "item-1",
        current,
        updated,
      });
      const repository = new ItemsRepository(fakeKysely as never);

      await repository.updateOwnWithLock("item-1", "user-a", () => ({
        nombre: "Bici",
      }));

      expect(fakeKysely.transaction).toHaveBeenCalledTimes(1);
      expect(fakeKysely.itemsSelect).toHaveBeenCalledWith("id");
      expect(fakeKysely.lockWhere1).toHaveBeenCalledWith("id", "=", "item-1");
      expect(fakeKysely.lockForUpdate).toHaveBeenCalled();
      expect(fakeKysely.callOrder).toEqual(["lock", "fetch", "update"]);
    });

    it("returns undefined without fetching or updating when the row lock finds no owned item", async () => {
      const fakeKysely = createFakeLockingTrx({
        lockedId: undefined,
        current: undefined,
        updated: undefined,
      });
      const computePatch = jest.fn();
      const repository = new ItemsRepository(fakeKysely as never);

      const result = await repository.updateOwnWithLock(
        "item-owned-by-b",
        "user-a",
        computePatch,
      );

      expect(result).toBeUndefined();
      expect(computePatch).not.toHaveBeenCalled();
      expect(fakeKysely.callOrder).toEqual(["lock"]);
    });

    it("passes the locked current row into computePatch and persists the returned patch", async () => {
      const current = {
        id: "item-1",
        parte_id: "user-a",
        valor_min: "50",
        valor_max: "2000",
      };
      const updated = {
        id: "item-1",
        parte_id: "user-a",
        valor_min: "9999",
        valor_max: "2000",
      };
      const fakeKysely = createFakeLockingTrx({
        lockedId: "item-1",
        current,
        updated,
      });
      const computePatch = jest.fn().mockReturnValue({ valor_min: "9999" });
      const repository = new ItemsRepository(fakeKysely as never);

      const result = await repository.updateOwnWithLock(
        "item-1",
        "user-a",
        computePatch,
      );

      expect(computePatch).toHaveBeenCalledWith(current);
      expect(fakeKysely.updateSet).toHaveBeenCalledWith({
        valor_min: "9999",
      });
      expect(result).toBe(updated);
    });
  });
});
