import type { INestApplication } from "@nestjs/common";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AuthGuard } from "../auth/auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { TOKEN_VERIFIER } from "../auth/token-verifier";
import { UsersRepository } from "../auth/users.repository";
import { AllExceptionsFilter } from "../common/filters/all-exceptions.filter";
import { InversoresController } from "./inversores.controller";
import { InversoresRepository } from "./inversores.repository";
import { InversoresService } from "./inversores.service";

async function bootstrapApp(create: jest.Mock): Promise<INestApplication> {
  const usersRepository = {
    findAuthById: () => Promise.resolve(undefined),
  };

  const moduleReference = await Test.createTestingModule({
    controllers: [InversoresController],
    providers: [
      InversoresService,
      { provide: InversoresRepository, useValue: { create } },
      { provide: UsersRepository, useValue: usersRepository },
      {
        provide: TOKEN_VERIFIER,
        useValue: { verify: () => Promise.reject(new Error("no token")) },
      },
      AuthGuard,
      RolesGuard,
      { provide: APP_GUARD, useExisting: AuthGuard },
      { provide: APP_GUARD, useExisting: RolesGuard },
      { provide: APP_FILTER, useClass: AllExceptionsFilter },
    ],
  }).compile();

  const app = moduleReference.createNestApplication();
  await app.init();
  return app;
}

const validBody = {
  nombre: "Ana Pérez",
  email: "ana@example.com",
  capital_disponible: "10000",
  experiencia: "5 años en real estate",
};

describe("POST /inversores", () => {
  let app: INestApplication;
  let create: jest.Mock;

  beforeEach(async () => {
    create = jest.fn().mockResolvedValue({ id: "inv-1" });
    app = await bootstrapApp(create);
  });

  afterEach(async () => {
    await app.close();
  });

  it("accepts an unauthenticated request with a valid body, proving the @Public() bypass", async () => {
    const response = await request(app.getHttpServer())
      .post("/inversores")
      .send(validBody);

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ id: "inv-1" });
    expect(create).toHaveBeenCalledWith(validBody);
  });

  it("rejects a request missing email with 400 and never inserts", async () => {
    const response = await request(app.getHttpServer())
      .post("/inversores")
      .send({ ...validBody, email: undefined });

    expect(response.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  it("rejects a request with an invalid email format with 400 and never inserts", async () => {
    const response = await request(app.getHttpServer())
      .post("/inversores")
      .send({ ...validBody, email: "not-an-email" });

    expect(response.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  it("rejects a request with an oversized nombre with 400 and never inserts", async () => {
    const response = await request(app.getHttpServer())
      .post("/inversores")
      .send({ ...validBody, nombre: "a".repeat(201) });

    expect(response.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });
});
