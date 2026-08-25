import { PlanesRepository } from "./planes.repository";

describe("PlanesRepository", () => {
  describe("listPlanes", () => {
    function createFakeKysely(rows: unknown[]) {
      const execute = jest.fn().mockResolvedValue(rows);
      const select = jest.fn().mockReturnValue({ execute });
      const selectFrom = jest.fn().mockReturnValue({ select });
      return { selectFrom, select, execute };
    }

    it("lists all seeded plans, returning -1 unlimited values unchanged", async () => {
      const plans = [
        {
          id: "plan-base",
          nombre: "base",
          limite_carpetas: 3,
          limite_casos: 2,
          limite_iteraciones_ia: 5,
          precio: 0,
          moneda: "ARS",
        },
        {
          id: "plan-plus",
          nombre: "plus",
          limite_carpetas: -1,
          limite_casos: -1,
          limite_iteraciones_ia: -1,
          precio: 19.99,
          moneda: "ARS",
        },
      ];
      const fakeKysely = createFakeKysely(plans);
      const repository = new PlanesRepository(fakeKysely as never);

      const result = await repository.listPlanes();

      expect(fakeKysely.selectFrom).toHaveBeenCalledWith("planes");
      expect(fakeKysely.select).toHaveBeenCalledWith(
        expect.arrayContaining(["moneda", "precio"]),
      );
      expect(result).toBe(plans);
      expect(result[1]?.limite_casos).toBe(-1);
    });
  });
});
