import { readAcceptedFirmantes } from "./firmantes-read.query";

function createFakeKysely(rows: unknown[]) {
  const execute = jest.fn().mockResolvedValue(rows);
  const where2 = jest.fn().mockReturnValue({ execute });
  const where1 = jest.fn().mockReturnValue({ where: where2 });
  const select = jest.fn().mockReturnValue({ where: where1 });
  const innerJoin1 = jest.fn().mockReturnValue({ select });
  const selectFrom = jest.fn().mockReturnValue({ innerJoin: innerJoin1 });
  return { selectFrom, innerJoin1, select, where1, where2 };
}

describe("readAcceptedFirmantes", () => {
  it("reads accepted case parties joined with their usuario email and nombre", async () => {
    const rows = [
      {
        usuario_id: "user-a",
        email: "a@example.com",
        nombre: "Ana",
        apellido: "Perez",
      },
      {
        usuario_id: "user-b",
        email: "b@example.com",
        nombre: "Beto",
        apellido: "Diaz",
      },
    ];
    const fakeKysely = createFakeKysely(rows);

    const result = await readAcceptedFirmantes(fakeKysely as never, "caso-1");

    expect(fakeKysely.selectFrom).toHaveBeenCalledWith("caso_partes");
    expect(fakeKysely.innerJoin1).toHaveBeenCalledWith(
      "usuarios",
      "usuarios.id",
      "caso_partes.usuario_id",
    );
    expect(result).toBe(rows);
  });
});
