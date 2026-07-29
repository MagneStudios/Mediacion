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

  it("sends an agreement to signature for the authenticated caller", async () => {
    const acuerdo = {
      id: "acuerdo-1",
      caso_id: "caso-1",
      estado: "enviado_a_firma",
    };
    const sendToSignature = jest.fn().mockResolvedValue(acuerdo);
    const controller = new AcuerdosController({
      sendToSignature,
    } as unknown as AcuerdosService);

    const result = await controller.sendToSignature("acuerdo-1", parteA);

    expect(sendToSignature).toHaveBeenCalledWith("acuerdo-1", "user-a");
    expect(result).toBe(acuerdo);
  });

  it("reads the case agreement with its signature statuses", async () => {
    const payload = { acuerdo: { id: "acuerdo-1" }, firmas: [] };
    const getForCaso = jest.fn().mockResolvedValue(payload);
    const controller = new AcuerdosController({
      getForCaso,
    } as unknown as AcuerdosService);

    const result = await controller.getForCaso("caso-1", parteA);

    expect(getForCaso).toHaveBeenCalledWith("caso-1", "user-a");
    expect(result).toBe(payload);
  });

  it("returns the export body and sets the attachment filename header", async () => {
    const exportAgreement = jest.fn().mockResolvedValue({
      filename: "acuerdo-acuerdo-1.txt",
      document: "ACUERDO DE MEDIACIÓN",
    });
    const controller = new AcuerdosController({
      exportAgreement,
    } as unknown as AcuerdosService);
    const setHeader = jest.fn();

    const result = await controller.exportAgreement("acuerdo-1", parteA, {
      setHeader,
    });

    expect(exportAgreement).toHaveBeenCalledWith("acuerdo-1", "user-a");
    expect(setHeader).toHaveBeenCalledWith(
      "Content-Disposition",
      'attachment; filename="acuerdo-acuerdo-1.txt"',
    );
    expect(result).toBe("ACUERDO DE MEDIACIÓN");
  });
});
