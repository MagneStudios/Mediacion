import type { AuthenticatedUser } from "../auth/authenticated-user";
import { AbogadoController } from "./abogado.controller";
import type { AbogadoService } from "./abogado.service";

const parteA: AuthenticatedUser = {
  id: "user-a",
  email: "a@b.com",
  rol: "parte",
};

describe("AbogadoController", () => {
  it("opens the lawyer request for the authenticated caller's caso", async () => {
    const checkout = {
      solicitud: { id: "solicitud-1" },
      init_point: "https://mp",
    };
    const requestForCaso = jest.fn().mockResolvedValue(checkout);
    const controller = new AbogadoController({
      requestForCaso,
    } as unknown as AbogadoService);

    const result = await controller.requestAbogado("caso-1", parteA);

    expect(requestForCaso).toHaveBeenCalledWith("caso-1", "user-a");
    expect(result).toBe(checkout);
  });

  it("reads the caso's lawyer request for the authenticated caller", async () => {
    const solicitud = { id: "solicitud-1" };
    const getForCaso = jest.fn().mockResolvedValue(solicitud);
    const controller = new AbogadoController({
      getForCaso,
    } as unknown as AbogadoService);

    const result = await controller.getAbogado("caso-1", parteA);

    expect(getForCaso).toHaveBeenCalledWith("caso-1", "user-a");
    expect(result).toBe(solicitud);
  });
});
