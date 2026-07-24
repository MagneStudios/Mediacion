import { HttpException } from "@nestjs/common";
import { ItemsService } from "./items.service";
import type { CreateItemDto } from "./items.types";

function createService(overrides: {
  assertMembership?: jest.Mock;
  createOwn?: jest.Mock;
  findOwn?: jest.Mock;
  findOwnById?: jest.Mock;
  updateOwnWithLock?: jest.Mock;
}) {
  const itemsRepository = {
    createOwn: overrides.createOwn ?? jest.fn(),
    findOwn: overrides.findOwn ?? jest.fn(),
    findOwnById: overrides.findOwnById ?? jest.fn(),
    updateOwnWithLock: overrides.updateOwnWithLock ?? jest.fn(),
  };
  const membershipService = {
    assertMembership: overrides.assertMembership ?? jest.fn(),
  };
  return new ItemsService(itemsRepository as never, membershipService as never);
}

describe("ItemsService", () => {
  describe("createOwnItem", () => {
    it("checks membership before creating, and creates with the caller's id", async () => {
      const callOrder: string[] = [];
      const assertMembership = jest.fn().mockImplementation(async () => {
        callOrder.push("assertMembership");
        return { rol_en_caso: "parte_a" };
      });
      const createOwn = jest.fn().mockImplementation(async () => {
        callOrder.push("createOwn");
        return { id: "item-1", caso_id: "caso-1", parte_id: "user-a" };
      });
      const service = createService({ assertMembership, createOwn });
      const dto: CreateItemDto = { categoria: "bienes", nombre: "Auto" };

      const result = await service.createOwnItem("caso-1", "user-a", dto);

      expect(callOrder).toEqual(["assertMembership", "createOwn"]);
      expect(assertMembership).toHaveBeenCalledWith("caso-1", "user-a");
      expect(createOwn).toHaveBeenCalledWith(dto, "caso-1", "user-a");
      expect(result).toEqual({
        id: "item-1",
        caso_id: "caso-1",
        parte_id: "user-a",
      });
    });

    it("rejects a non-member with 404 before any item creation is attempted", async () => {
      const assertMembership = jest
        .fn()
        .mockRejectedValue(
          new HttpException(
            { code: "caso_not_found", message: "Case not found" },
            404,
          ),
        );
      const createOwn = jest.fn();
      const service = createService({ assertMembership, createOwn });
      const dto: CreateItemDto = { categoria: "bienes", nombre: "Auto" };

      let thrown: unknown;
      try {
        await service.createOwnItem("caso-1", "stranger", dto);
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(HttpException);
      expect((thrown as HttpException).getStatus()).toBe(404);
      expect(createOwn).not.toHaveBeenCalled();
    });

    it("rejects a numeric min greater than max before creation is attempted", async () => {
      const assertMembership = jest
        .fn()
        .mockResolvedValue({ rol_en_caso: "parte_a" });
      const createOwn = jest.fn();
      const service = createService({ assertMembership, createOwn });
      const dto: CreateItemDto = {
        categoria: "economico",
        nombre: "Ahorros",
        valor_min: "500",
        valor_max: "100",
      };

      let thrown: unknown;
      try {
        await service.createOwnItem("caso-1", "user-a", dto);
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(HttpException);
      expect((thrown as HttpException).getStatus()).toBe(400);
      expect(createOwn).not.toHaveBeenCalled();
    });
  });

  describe("listOwnItems", () => {
    it("checks membership before listing the caller's own items", async () => {
      const callOrder: string[] = [];
      const assertMembership = jest.fn().mockImplementation(async () => {
        callOrder.push("assertMembership");
        return { rol_en_caso: "parte_a" };
      });
      const ownItems = [
        { id: "item-a1", caso_id: "caso-1", parte_id: "user-a" },
      ];
      const findOwn = jest.fn().mockImplementation(async () => {
        callOrder.push("findOwn");
        return ownItems;
      });
      const service = createService({ assertMembership, findOwn });

      const result = await service.listOwnItems("caso-1", "user-a");

      expect(callOrder).toEqual(["assertMembership", "findOwn"]);
      expect(findOwn).toHaveBeenCalledWith("caso-1", "user-a");
      expect(result).toBe(ownItems);
    });

    it("rejects a non-member with 404 before any listing is attempted", async () => {
      const assertMembership = jest
        .fn()
        .mockRejectedValue(
          new HttpException(
            { code: "caso_not_found", message: "Case not found" },
            404,
          ),
        );
      const findOwn = jest.fn();
      const service = createService({ assertMembership, findOwn });

      let thrown: unknown;
      try {
        await service.listOwnItems("caso-1", "stranger");
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(HttpException);
      expect((thrown as HttpException).getStatus()).toBe(404);
      expect(findOwn).not.toHaveBeenCalled();
    });
  });

  describe("getOwnItem", () => {
    it("returns the item when found by the scoped repository lookup", async () => {
      const item = { id: "item-1", parte_id: "user-a" };
      const findOwnById = jest.fn().mockResolvedValue(item);
      const service = createService({ findOwnById });

      const result = await service.getOwnItem("item-1", "user-a");

      expect(findOwnById).toHaveBeenCalledWith("item-1", "user-a");
      expect(result).toBe(item);
    });

    it("throws 404 when the scoped lookup returns undefined, indistinguishable from non-existent", async () => {
      const findOwnById = jest.fn().mockResolvedValue(undefined);
      const service = createService({ findOwnById });

      let thrown: unknown;
      try {
        await service.getOwnItem("item-owned-by-b", "user-a");
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(HttpException);
      expect((thrown as HttpException).getStatus()).toBe(404);
    });
  });

  describe("updateOwnItem", () => {
    function createUpdateOwnWithLockMock(
      current: Record<string, unknown> | undefined,
    ) {
      return jest
        .fn()
        .mockImplementation(
          async (
            _itemId: string,
            _callerId: string,
            computePatch: (current: unknown) => unknown,
          ) => {
            if (!current) {
              return undefined;
            }
            const patch = computePatch(current) as Record<string, unknown>;
            return { ...current, ...patch };
          },
        );
    }

    it("rejects an empty patch with 400 no_updatable_fields, never invoking the repository", async () => {
      const updateOwnWithLock = jest.fn();
      const service = createService({ updateOwnWithLock });

      let thrown: unknown;
      try {
        await service.updateOwnItem("item-1", "user-a", {});
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(HttpException);
      expect((thrown as HttpException).getStatus()).toBe(400);
      expect((thrown as HttpException).getResponse()).toEqual({
        code: "no_updatable_fields",
        message: "No updatable fields provided",
      });
      expect(updateOwnWithLock).not.toHaveBeenCalled();
    });

    it("rejects a patch containing only non-allowlisted keys with 400, never invoking the repository", async () => {
      const updateOwnWithLock = jest.fn();
      const service = createService({ updateOwnWithLock });

      let thrown: unknown;
      try {
        await service.updateOwnItem("item-1", "user-a", {
          foo: "bar",
        } as never);
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(HttpException);
      expect((thrown as HttpException).getStatus()).toBe(400);
      expect(updateOwnWithLock).not.toHaveBeenCalled();
    });

    it("rejects a mass-assignment-only patch with 400, writing/locking nothing", async () => {
      const updateOwnWithLock = jest.fn();
      const service = createService({ updateOwnWithLock });

      let thrown: unknown;
      try {
        await service.updateOwnItem("item-1", "user-a", {
          parte_id: "user-b",
        } as unknown as never);
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(HttpException);
      expect((thrown as HttpException).getStatus()).toBe(400);
      expect(updateOwnWithLock).not.toHaveBeenCalled();
    });

    it("locks, merges and updates the item, delegating the transaction to the repository", async () => {
      const current = {
        id: "item-1",
        parte_id: "user-a",
        valor_min: null,
        valor_max: null,
      };
      const updateOwnWithLock = createUpdateOwnWithLockMock(current);
      const service = createService({ updateOwnWithLock });

      const result = await service.updateOwnItem("item-1", "user-a", {
        nombre: "Bici",
      });

      expect(updateOwnWithLock).toHaveBeenCalledWith(
        "item-1",
        "user-a",
        expect.any(Function),
      );
      expect(result).toEqual({ ...current, nombre: "Bici" });
    });

    it("throws 404 when the row lock finds no item owned by the caller", async () => {
      const updateOwnWithLock = createUpdateOwnWithLockMock(undefined);
      const service = createService({ updateOwnWithLock });

      let thrown: unknown;
      try {
        await service.updateOwnItem("item-owned-by-b", "user-a", {
          nombre: "Hijacked",
        });
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(HttpException);
      expect((thrown as HttpException).getStatus()).toBe(404);
    });

    it("rejects a numeric min greater than max before any lock/update is attempted", async () => {
      const current = {
        id: "item-1",
        parte_id: "user-a",
        valor_min: null,
        valor_max: null,
      };
      const updateOwnWithLock = createUpdateOwnWithLockMock(current);
      const service = createService({ updateOwnWithLock });

      let thrown: unknown;
      try {
        await service.updateOwnItem("item-1", "user-a", {
          valor_min: "500",
          valor_max: "100",
        });
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(HttpException);
      expect((thrown as HttpException).getStatus()).toBe(400);
    });

    it("rejects a patched valor_min greater than the persisted valor_max — validated on the locked snapshot", async () => {
      const current = {
        id: "item-1",
        parte_id: "user-a",
        valor_min: "50",
        valor_max: "2000",
      };
      const updateOwnWithLock = createUpdateOwnWithLockMock(current);
      const service = createService({ updateOwnWithLock });

      let thrown: unknown;
      try {
        await service.updateOwnItem("item-1", "user-a", { valor_min: "9999" });
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(HttpException);
      expect((thrown as HttpException).getStatus()).toBe(400);
    });

    it("rejects a patched valor_max lower than the persisted valor_min — validated on the locked snapshot", async () => {
      const current = {
        id: "item-1",
        parte_id: "user-a",
        valor_min: "100",
        valor_max: "2000",
      };
      const updateOwnWithLock = createUpdateOwnWithLockMock(current);
      const service = createService({ updateOwnWithLock });

      let thrown: unknown;
      try {
        await service.updateOwnItem("item-1", "user-a", { valor_max: "50" });
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(HttpException);
      expect((thrown as HttpException).getStatus()).toBe(400);
    });

    it("allows a partial update whose effective merged range stays valid", async () => {
      const current = {
        id: "item-1",
        parte_id: "user-a",
        valor_min: "100",
        valor_max: "2000",
      };
      const updateOwnWithLock = createUpdateOwnWithLockMock(current);
      const service = createService({ updateOwnWithLock });

      const result = await service.updateOwnItem("item-1", "user-a", {
        nombre: "Nuevo nombre",
      });

      expect(result).toEqual({ ...current, nombre: "Nuevo nombre" });
    });

    it("rejects an invalid categoria in the patch before any lock/update is attempted", async () => {
      const updateOwnWithLock = jest.fn();
      const service = createService({ updateOwnWithLock });

      let thrown: unknown;
      try {
        await service.updateOwnItem("item-1", "user-a", {
          categoria: "not-a-real-categoria" as never,
        });
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(HttpException);
      expect((thrown as HttpException).getStatus()).toBe(400);
      expect(updateOwnWithLock).not.toHaveBeenCalled();
    });

    it("rejects an empty nombre in the patch before any lock/update is attempted", async () => {
      const updateOwnWithLock = jest.fn();
      const service = createService({ updateOwnWithLock });

      let thrown: unknown;
      try {
        await service.updateOwnItem("item-1", "user-a", { nombre: "" });
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(HttpException);
      expect((thrown as HttpException).getStatus()).toBe(400);
      expect(updateOwnWithLock).not.toHaveBeenCalled();
    });

    it("rejects a whitespace-only nombre in the patch before any lock/update is attempted", async () => {
      const updateOwnWithLock = jest.fn();
      const service = createService({ updateOwnWithLock });

      let thrown: unknown;
      try {
        await service.updateOwnItem("item-1", "user-a", { nombre: "   " });
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(HttpException);
      expect((thrown as HttpException).getStatus()).toBe(400);
      expect(updateOwnWithLock).not.toHaveBeenCalled();
    });
  });
});
