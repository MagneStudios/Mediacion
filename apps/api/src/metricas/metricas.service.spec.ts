import type { MetricasRepository } from "./metricas.repository";
import { MetricasService } from "./metricas.service";

describe("MetricasService", () => {
  function buildService(getMetricas: jest.Mock) {
    return new MetricasService({
      getMetricas,
    } as unknown as MetricasRepository);
  }

  it("returns the aggregate metrics assembled by the repository", async () => {
    const metricas = {
      casosByEstado: { activo: 3 },
      usuariosByRol: { admin: 1 },
      acuerdosByEstado: { borrador: 2 },
    };
    const getMetricas = jest.fn().mockResolvedValue(metricas);
    const service = buildService(getMetricas);

    const result = await service.getMetricas();

    expect(getMetricas).toHaveBeenCalledTimes(1);
    expect(result).toEqual(metricas);
  });
});
