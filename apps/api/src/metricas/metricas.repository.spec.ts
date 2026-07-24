import { MetricasRepository } from "./metricas.repository";

describe("MetricasRepository", () => {
  describe("getMetricas", () => {
    function createFakeKysely(rowsByTable: Record<string, unknown[]>) {
      const selectFrom = jest.fn((table: string) => {
        const groupBy = jest.fn().mockReturnValue({
          execute: () => Promise.resolve(rowsByTable[table]),
        });
        const select2 = jest.fn().mockReturnValue({ groupBy });
        const select1 = jest.fn().mockReturnValue({ select: select2 });
        return { select: select1 };
      });
      return { selectFrom };
    }

    function createFakeKyselyRejecting(table: string, error: unknown) {
      const selectFrom = jest.fn((selectedTable: string) => {
        const groupBy = jest.fn().mockReturnValue({
          execute: () =>
            selectedTable === table
              ? Promise.reject(error)
              : Promise.resolve([]),
        });
        const select2 = jest.fn().mockReturnValue({ groupBy });
        const select1 = jest.fn().mockReturnValue({ select: select2 });
        return { select: select1 };
      });
      return { selectFrom };
    }

    it("aggregates counts of casos by estado, usuarios by rol, and acuerdos by estado", async () => {
      const fake = createFakeKysely({
        casos: [
          { estado: "activo", total: "3" },
          { estado: "cerrado", total: "1" },
        ],
        usuarios: [{ rol: "admin", total: "2" }],
        acuerdos: [{ estado: "borrador", total: "5" }],
      });
      const repository = new MetricasRepository(fake as never);

      const result = await repository.getMetricas();

      expect(fake.selectFrom).toHaveBeenCalledWith("casos");
      expect(fake.selectFrom).toHaveBeenCalledWith("usuarios");
      expect(fake.selectFrom).toHaveBeenCalledWith("acuerdos");
      expect(result).toEqual({
        casosByEstado: { activo: 3, cerrado: 1 },
        usuariosByRol: { admin: 2 },
        acuerdosByEstado: { borrador: 5 },
      });
    });

    it("returns empty breakdowns without per-row data when no rows exist", async () => {
      const fake = createFakeKysely({ casos: [], usuarios: [], acuerdos: [] });
      const repository = new MetricasRepository(fake as never);

      const result = await repository.getMetricas();

      expect(result).toEqual({
        casosByEstado: {},
        usuariosByRol: {},
        acuerdosByEstado: {},
      });
    });

    it("maps a rejected query into a domain error", async () => {
      const fake = createFakeKyselyRejecting("usuarios", "connection lost");
      const repository = new MetricasRepository(fake as never);

      await expect(repository.getMetricas()).rejects.toThrow("connection lost");
    });
  });
});
