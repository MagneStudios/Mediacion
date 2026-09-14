import { HttpException, HttpStatus, Logger } from "@nestjs/common";
import type { ModeracionRepository } from "./moderacion.repository";
import { ModeracionService } from "./moderacion.service";

function buildService(terminos: string[] = ["idiota"]) {
  const readTerminos = jest.fn().mockResolvedValue(terminos);
  const moderacionRepository = {
    readTerminos,
  } as unknown as ModeracionRepository;
  return {
    service: new ModeracionService(moderacionRepository),
    readTerminos,
  };
}

describe("ModeracionService.assertTextoAceptable", () => {
  it("accepts clean text", async () => {
    const { service } = buildService();

    await expect(
      service.assertTextoAceptable("user-a", [
        { campo: "nombre", valor: "Cronograma escolar" },
      ]),
    ).resolves.toBeUndefined();
  });

  it("rejects offensive text with texto_ofensivo and names the field", async () => {
    const { service } = buildService();

    let thrown: unknown;
    try {
      await service.assertTextoAceptable("user-a", [
        { campo: "descripcion", valor: "sos un idiota" },
      ]);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(HttpException);
    expect((thrown as HttpException).getStatus()).toBe(HttpStatus.BAD_REQUEST);
    expect((thrown as HttpException).getResponse()).toEqual(
      expect.objectContaining({
        code: "texto_ofensivo",
        campo: "descripcion",
      }),
    );
  });

  it("does not echo the detected terms back in the response", async () => {
    const { service } = buildService();

    let thrown: unknown;
    try {
      await service.assertTextoAceptable("user-a", [
        { campo: "nombre", valor: "idiota" },
      ]);
    } catch (error) {
      thrown = error;
    }

    expect(
      JSON.stringify((thrown as HttpException).getResponse()),
    ).not.toContain("idiota");
  });

  it("traces the blocked event with the user and the terms found", async () => {
    const warn = jest
      .spyOn(Logger.prototype, "warn")
      .mockImplementation(() => undefined);
    const { service } = buildService();

    await service
      .assertTextoAceptable("user-a", [{ campo: "nombre", valor: "idiota" }])
      .catch(() => undefined);

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("usuarioId=user-a"),
    );
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("campo=nombre"));
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("terminos=idiota"),
    );
    warn.mockRestore();
  });

  it("skips the read entirely when every field is empty", async () => {
    const { service, readTerminos } = buildService();

    await service.assertTextoAceptable("user-a", [
      { campo: "nombre", valor: null },
      { campo: "descripcion", valor: "   " },
    ]);

    expect(readTerminos).not.toHaveBeenCalled();
  });

  it("lets everything through when the configured list is empty", async () => {
    const { service } = buildService([]);

    await expect(
      service.assertTextoAceptable("user-a", [
        { campo: "nombre", valor: "sos un idiota" },
      ]),
    ).resolves.toBeUndefined();
  });

  it("checks every field, not only the first one", async () => {
    const { service } = buildService();

    await expect(
      service.assertTextoAceptable("user-a", [
        { campo: "nombre", valor: "Cronograma" },
        { campo: "descripcion", valor: "sos un idiota" },
      ]),
    ).rejects.toMatchObject({ response: { campo: "descripcion" } });
  });
});
