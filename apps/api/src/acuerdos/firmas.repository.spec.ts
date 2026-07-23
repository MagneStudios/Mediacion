import { FirmasRepository } from "./firmas.repository";

describe("FirmasRepository", () => {
  function createFakeKysely(inserted: unknown[]) {
    const execute = jest.fn().mockResolvedValue(inserted);
    const returningAll = jest.fn().mockReturnValue({ execute });
    const values = jest.fn().mockReturnValue({ returningAll });
    const insertInto = jest.fn().mockReturnValue({ values });
    return { insertInto, values, returningAll, execute };
  }

  it("inserts one pending firma row per party for the acuerdo", async () => {
    const inserted = [
      {
        id: "firma-1",
        acuerdo_id: "acuerdo-1",
        usuario_id: "user-a",
        docusign_status: "pending",
      },
      {
        id: "firma-2",
        acuerdo_id: "acuerdo-1",
        usuario_id: "user-b",
        docusign_status: "pending",
      },
    ];
    const fakeKysely = createFakeKysely(inserted);
    const repository = new FirmasRepository(fakeKysely as never);

    const result = await repository.insertMany("acuerdo-1", [
      "user-a",
      "user-b",
    ]);

    expect(fakeKysely.insertInto).toHaveBeenCalledWith("firmas");
    expect(fakeKysely.values).toHaveBeenCalledWith([
      {
        acuerdo_id: "acuerdo-1",
        usuario_id: "user-a",
        docusign_status: "pending",
      },
      {
        acuerdo_id: "acuerdo-1",
        usuario_id: "user-b",
        docusign_status: "pending",
      },
    ]);
    expect(result).toBe(inserted);
  });
});
