import { AcuerdosRepository } from "./acuerdos.repository";
import { FirmasRepository } from "./firmas.repository";

describe("AcuerdosRepository.findByCasoId", () => {
  function createFakeKysely(row: unknown) {
    const executeTakeFirst = jest.fn().mockResolvedValue(row);
    const where = jest.fn().mockReturnValue({ executeTakeFirst });
    const selectAll = jest.fn().mockReturnValue({ where });
    const selectFrom = jest.fn().mockReturnValue({ selectAll });
    return { selectFrom, selectAll, where };
  }

  it("reads the single agreement of a case", async () => {
    const acuerdo = { id: "acuerdo-1", caso_id: "caso-1" };
    const fakeKysely = createFakeKysely(acuerdo);
    const repository = new AcuerdosRepository(fakeKysely as never, {} as never);

    const result = await repository.findByCasoId("caso-1");

    expect(fakeKysely.selectFrom).toHaveBeenCalledWith("acuerdos");
    expect(fakeKysely.where).toHaveBeenCalledWith("caso_id", "=", "caso-1");
    expect(result).toBe(acuerdo);
  });

  it("resolves undefined when the case has no agreement", async () => {
    const repository = new AcuerdosRepository(
      createFakeKysely(undefined) as never,
      {} as never,
    );

    await expect(repository.findByCasoId("caso-1")).resolves.toBeUndefined();
  });
});

describe("FirmasRepository.listByAcuerdo", () => {
  function createFakeKysely(rows: unknown[]) {
    const execute = jest.fn().mockResolvedValue(rows);
    const orderBy = jest.fn().mockReturnValue({ execute });
    const where = jest.fn().mockReturnValue({ orderBy });
    const select = jest.fn().mockReturnValue({ where });
    const selectFrom = jest.fn().mockReturnValue({ select });
    return { selectFrom, select, where, orderBy };
  }

  it("reads only the signature-status columns, never the whole row", async () => {
    const rows = [
      {
        id: "firma-1",
        usuario_id: "user-a",
        docusign_status: "signed",
        fecha_firma: "2026-07-28T10:00:00.000Z",
      },
    ];
    const fakeKysely = createFakeKysely(rows);
    const repository = new FirmasRepository(fakeKysely as never);

    const result = await repository.listByAcuerdo("acuerdo-1");

    expect(fakeKysely.selectFrom).toHaveBeenCalledWith("firmas");
    expect(fakeKysely.select).toHaveBeenCalledWith([
      "id",
      "usuario_id",
      "docusign_status",
      "fecha_firma",
    ]);
    expect(fakeKysely.where).toHaveBeenCalledWith(
      "acuerdo_id",
      "=",
      "acuerdo-1",
    );
    expect(fakeKysely.orderBy).toHaveBeenCalledWith("id", "asc");
    expect(result).toBe(rows);
  });
});
