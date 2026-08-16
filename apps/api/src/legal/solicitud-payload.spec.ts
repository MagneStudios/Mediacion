import {
  assertValidArrepentimiento,
  assertValidContacto,
} from "./solicitud-payload";

const invalidInput = expect.objectContaining({
  status: 400,
  response: expect.objectContaining({ code: "invalid_input" }),
});

describe("assertValidArrepentimiento", () => {
  it("trims and returns the three required fields", () => {
    expect(
      assertValidArrepentimiento({
        nombre: "  Ana Pérez ",
        email: "ana@example.com",
        detalle: " Plan estudio ",
      }),
    ).toEqual({
      nombre: "Ana Pérez",
      email: "ana@example.com",
      detalle: "Plan estudio",
    });
  });

  it.each(["nombre", "email", "detalle"])("rejects an empty %s", (field) => {
    const body = {
      nombre: "Ana",
      email: "ana@example.com",
      detalle: "detalle",
      [field]: "   ",
    };
    expect(() => assertValidArrepentimiento(body)).toThrow(invalidInput);
  });

  it("rejects an email without email shape", () => {
    expect(() =>
      assertValidArrepentimiento({
        nombre: "Ana",
        email: "ana-at-example",
        detalle: "detalle",
      }),
    ).toThrow(invalidInput);
  });

  it("rejects a missing body", () => {
    expect(() => assertValidArrepentimiento(undefined)).toThrow(invalidInput);
  });
});

describe("assertValidContacto", () => {
  it("requires mensaje instead of detalle", () => {
    expect(
      assertValidContacto({
        nombre: "Ana",
        email: "ana@example.com",
        mensaje: "Consulta",
      }),
    ).toEqual({
      nombre: "Ana",
      email: "ana@example.com",
      mensaje: "Consulta",
    });
    expect(() =>
      assertValidContacto({
        nombre: "Ana",
        email: "ana@example.com",
        detalle: "Consulta",
      }),
    ).toThrow(invalidInput);
  });
});
