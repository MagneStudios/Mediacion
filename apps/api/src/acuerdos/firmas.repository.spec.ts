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

  it("inserts using an externally supplied transaction handle instead of its own connection", async () => {
    const inserted = [
      {
        id: "firma-1",
        acuerdo_id: "acuerdo-1",
        usuario_id: "user-a",
        docusign_status: "pending",
      },
    ];
    const ownKysely = createFakeKysely([]);
    const trx = createFakeKysely(inserted);
    const repository = new FirmasRepository(ownKysely as never);

    await repository.insertMany("acuerdo-1", ["user-a"], trx as never);

    expect(trx.insertInto).toHaveBeenCalledWith("firmas");
    expect(ownKysely.insertInto).not.toHaveBeenCalled();
  });

  describe("updateStatus", () => {
    function createFakeUpdate() {
      const execute = jest.fn().mockResolvedValue(undefined);
      const where = jest.fn().mockReturnValue({ execute });
      const set = jest.fn().mockReturnValue({ where });
      const updateTable = jest.fn().mockReturnValue({ set });
      return { updateTable, set, where, execute };
    }

    it("updates the docusign_status and sets fecha_firma when the target status is signed", async () => {
      const fakeUpdate = createFakeUpdate();
      const repository = new FirmasRepository(fakeUpdate as never);

      await repository.updateStatus("firma-1", "signed");

      expect(fakeUpdate.updateTable).toHaveBeenCalledWith("firmas");
      expect(fakeUpdate.set).toHaveBeenCalledWith(
        expect.objectContaining({
          docusign_status: "signed",
          fecha_firma: expect.any(String),
        }),
      );
      expect(fakeUpdate.where).toHaveBeenCalledWith("id", "=", "firma-1");
    });

    it("updates the docusign_status without touching fecha_firma for non-signed statuses", async () => {
      const fakeUpdate = createFakeUpdate();
      const repository = new FirmasRepository(fakeUpdate as never);

      await repository.updateStatus("firma-1", "sent");

      expect(fakeUpdate.set).toHaveBeenCalledWith({ docusign_status: "sent" });
    });
  });

  describe("findByEnvelopeAndEmail", () => {
    function createFakeSelect(row: unknown) {
      const executeTakeFirst = jest.fn().mockResolvedValue(row);
      const where2 = jest.fn().mockReturnValue({ executeTakeFirst });
      const where1 = jest.fn().mockReturnValue({ where: where2 });
      const select = jest.fn().mockReturnValue({ where: where1 });
      const innerJoin2 = jest.fn().mockReturnValue({ select });
      const innerJoin1 = jest.fn().mockReturnValue({ innerJoin: innerJoin2 });
      const selectFrom = jest.fn().mockReturnValue({ innerJoin: innerJoin1 });
      return { selectFrom, innerJoin1, innerJoin2, select, where1, where2 };
    }

    it("resolves the firma row matching the envelope and recipient email", async () => {
      const row = {
        id: "firma-1",
        acuerdo_id: "acuerdo-1",
        docusign_status: "pending",
      };
      const fakeSelect = createFakeSelect(row);
      const repository = new FirmasRepository(fakeSelect as never);

      const result = await repository.findByEnvelopeAndEmail(
        "envelope-1",
        "a@example.com",
      );

      expect(fakeSelect.selectFrom).toHaveBeenCalledWith("firmas");
      expect(result).toBe(row);
    });
  });

  describe("allSignedForAcuerdo", () => {
    function createFakeCount(pendingCount: number) {
      const executeTakeFirst = jest
        .fn()
        .mockResolvedValue({ pendingCount: String(pendingCount) });
      const where2 = jest.fn().mockReturnValue({ executeTakeFirst });
      const where1 = jest.fn().mockReturnValue({ where: where2 });
      const select = jest.fn().mockReturnValue({ where: where1 });
      const selectFrom = jest.fn().mockReturnValue({ select });
      return { selectFrom, select, where1, where2 };
    }

    it("returns true when no firma for the acuerdo is unsigned", async () => {
      const fakeCount = createFakeCount(0);
      const repository = new FirmasRepository(fakeCount as never);

      const result = await repository.allSignedForAcuerdo("acuerdo-1");

      expect(result).toBe(true);
    });

    it("returns false when at least one firma for the acuerdo is unsigned", async () => {
      const fakeCount = createFakeCount(1);
      const repository = new FirmasRepository(fakeCount as never);

      const result = await repository.allSignedForAcuerdo("acuerdo-1");

      expect(result).toBe(false);
    });
  });
});
