import type { AuthenticatedUser } from "../auth/authenticated-user";
import { AcuerdosController } from "./acuerdos.controller";
import type { AcuerdosService } from "./acuerdos.service";

const parteA: AuthenticatedUser = {
  id: "user-a",
  email: "a@b.com",
  rol: "parte",
};

describe("AcuerdosController unit", () => {
  it("generates an agreement for the authenticated caller's case", async () => {
    const acuerdo = { id: "acuerdo-1", caso_id: "caso-1", estado: "borrador" };
    const generateAgreement = jest.fn().mockResolvedValue(acuerdo);
    const controller = new AcuerdosController({
      generateAgreement,
    } as unknown as AcuerdosService);

    const result = await controller.generateAgreement("caso-1", parteA);

    expect(generateAgreement).toHaveBeenCalledWith("caso-1", "user-a");
    expect(result).toBe(acuerdo);
  });
});
