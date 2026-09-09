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
          max_negotiations_per_period: 3,
          max_clients_per_period: null,
        },
        {
          id: "plan-plus",
          nombre: "plus",
          limite_carpetas: -1,
          limite_casos: -1,
          limite_iteraciones_ia: -1,
          precio: 19.99,
          moneda: "ARS",
          max_negotiations_per_period: null,
          max_clients_per_period: null,
        },
      ];
      const fakeKysely = createFakeKysely(plans);
      const repository = new PlanesRepository(fakeKysely as never);

      const result = await repository.listPlanes();

      expect(fakeKysely.selectFrom).toHaveBeenCalledWith("planes");
      expect(fakeKysely.select).toHaveBeenCalledWith(
        expect.arrayContaining([
          "moneda",
          "precio",
          "max_negotiations_per_period",
          "max_clients_per_period",
        ]),
      );
      expect(result).toBe(plans);
      expect(result[1]?.limite_casos).toBe(-1);
      expect(result[0]?.max_negotiations_per_period).toBe(3);
      expect(result[1]?.max_negotiations_per_period).toBeNull();
    });
  });
});
