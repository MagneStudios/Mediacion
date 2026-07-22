import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "./app.module";

describe("AppModule health route wiring", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleReference = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleReference.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("responds with status ok on GET /health", async () => {
    const response = await request(app.getHttpServer()).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });

  it("responds with a uniform 404 body for an unknown route", async () => {
    const response = await request(app.getHttpServer()).get(
      "/nonexistent-route",
    );

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: {
        code: "not_found",
        message: expect.stringContaining("Cannot GET"),
      },
    });
  });
});
