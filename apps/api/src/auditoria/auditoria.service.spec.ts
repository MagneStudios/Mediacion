import { HttpException } from "@nestjs/common";
import type { AuditoriaRepository } from "./auditoria.repository";
import { AuditoriaService } from "./auditoria.service";

describe("AuditoriaService", () => {
  function buildService(findPage: jest.Mock, count: jest.Mock) {
    return new AuditoriaService({
      findPage,
      count,
    } as unknown as AuditoriaRepository);
  }

  it("applies default page and limit when query is empty", async () => {
    const items = [{ id: "1" }];
    const findPage = jest.fn().mockResolvedValue(items);
    const count = jest.fn().mockResolvedValue(1);
    const service = buildService(findPage, count);

    const result = await service.listAuditoria({});

    expect(findPage).toHaveBeenCalledWith(0, 20);
    expect(result).toEqual({ items, page: 1, limit: 20, total: 1 });
  });

  it("computes the correct offset for a requested page", async () => {
    const findPage = jest.fn().mockResolvedValue([]);
    const count = jest.fn().mockResolvedValue(0);
    const service = buildService(findPage, count);

    await service.listAuditoria({ page: "3", limit: "10" });

    expect(findPage).toHaveBeenCalledWith(20, 10);
  });

  it("returns an empty page when the requested page is beyond the available range", async () => {
    const findPage = jest.fn().mockResolvedValue([]);
    const count = jest.fn().mockResolvedValue(5);
    const service = buildService(findPage, count);

    const result = await service.listAuditoria({ page: "99" });

    expect(result).toEqual({ items: [], page: 99, limit: 20, total: 5 });
  });

  it("caps an oversized limit at 100 before querying the repository", async () => {
    const findPage = jest.fn().mockResolvedValue([]);
    const count = jest.fn().mockResolvedValue(0);
    const service = buildService(findPage, count);

    await service.listAuditoria({ limit: "1000" });

    expect(findPage).toHaveBeenCalledWith(0, 100);
  });

  it("rejects an invalid page before querying the repository", async () => {
    const findPage = jest.fn();
    const count = jest.fn();
    const service = buildService(findPage, count);

    await expect(service.listAuditoria({ page: "-1" })).rejects.toBeInstanceOf(
      HttpException,
    );
    expect(findPage).not.toHaveBeenCalled();
    expect(count).not.toHaveBeenCalled();
  });
});
