import { HttpException } from "@nestjs/common";
import type { InversoresRepository } from "./inversores.repository";
import { InversoresService } from "./inversores.service";
import type { CreateInversorDto } from "./types";

describe("InversoresService", () => {
  function buildService(create: jest.Mock) {
    return new InversoresService({
      create,
    } as unknown as InversoresRepository);
  }

  const validInput: CreateInversorDto = {
    nombre: "Ana Pérez",
    email: "ana@example.com",
    capital_disponible: "10000",
    experiencia: "5 años en real estate",
  };

  it("creates an inversor when all fields are valid", async () => {
    const create = jest.fn().mockResolvedValue({ id: "inv-1" });
    const service = buildService(create);

    const result = await service.createInversor(validInput);

    expect(create).toHaveBeenCalledWith(validInput);
    expect(result).toEqual({ id: "inv-1" });
  });

  it("rejects a missing nombre with 400 and never inserts", async () => {
    const create = jest.fn();
    const service = buildService(create);
    const input = { ...validInput, nombre: "" };

    await expect(service.createInversor(input)).rejects.toBeInstanceOf(
      HttpException,
    );
    expect(create).not.toHaveBeenCalled();
  });

  it("rejects a missing email with 400 and never inserts", async () => {
    const create = jest.fn();
    const service = buildService(create);
    const input = {
      ...validInput,
      email: undefined,
    } as unknown as CreateInversorDto;

    await expect(service.createInversor(input)).rejects.toBeInstanceOf(
      HttpException,
    );
    expect(create).not.toHaveBeenCalled();
  });

  it("rejects an invalid email format with 400 and never inserts", async () => {
    const create = jest.fn();
    const service = buildService(create);
    const input = { ...validInput, email: "not-an-email" };

    await expect(service.createInversor(input)).rejects.toBeInstanceOf(
      HttpException,
    );
    expect(create).not.toHaveBeenCalled();
  });

  it("rejects an oversized nombre with 400 and never inserts", async () => {
    const create = jest.fn();
    const service = buildService(create);
    const input = { ...validInput, nombre: "a".repeat(201) };

    await expect(service.createInversor(input)).rejects.toBeInstanceOf(
      HttpException,
    );
    expect(create).not.toHaveBeenCalled();
  });

  it("rejects a missing capital_disponible with 400 and never inserts", async () => {
    const create = jest.fn();
    const service = buildService(create);
    const input = {
      ...validInput,
      capital_disponible: undefined,
    } as unknown as CreateInversorDto;

    await expect(service.createInversor(input)).rejects.toBeInstanceOf(
      HttpException,
    );
    expect(create).not.toHaveBeenCalled();
  });

  it("rejects a missing experiencia with 400 and never inserts", async () => {
    const create = jest.fn();
    const service = buildService(create);
    const input = {
      ...validInput,
      experiencia: undefined,
    } as unknown as CreateInversorDto;

    await expect(service.createInversor(input)).rejects.toBeInstanceOf(
      HttpException,
    );
    expect(create).not.toHaveBeenCalled();
  });
});
