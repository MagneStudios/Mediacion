import type { INestApplication } from "@nestjs/common";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AuthGuard } from "../auth/auth.guard";
import type { AuthenticatedUser } from "../auth/authenticated-user";
import { RolesGuard } from "../auth/roles.guard";
import { TOKEN_VERIFIER } from "../auth/token-verifier";
import { UsersRepository } from "../auth/users.repository";
import { AllExceptionsFilter } from "../common/filters/all-exceptions.filter";
import { LegalController } from "./legal.controller";
import { LegalService } from "./legal.service";
import { PublicRateLimiter } from "./rate-limiter";

const admin: AuthenticatedUser = {
  id: "admin-1",
  email: "admin@example.com",
  rol: "admin",
};

const parte: AuthenticatedUser = {
  id: "parte-1",
  email: "parte@example.com",
  rol: "parte",
};

const pdfBytes = Buffer.from(
  "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n",
  "latin1",
);

/**
 * The PDF export through the real Nest pipeline. The unit spec asserts
 * `setHeader`/`send` on a hand-built object, so it cannot see what the wire
 * actually carries. Verified by mutation: returning the Buffer from the handler
 * instead of sending it — the natural mistake, since every other route in this
 * API returns its body — leaves the unit spec green while Nest routes the
 * Buffer through `res.json`. The byte-for-byte assertion below is what fails.
 * Binary responses are where a controller unit test stops being enough.
 */
describe("GET /legal/aceptaciones/export/pdf end-to-end", () => {
  async function bootstrapApp(
    exportAcceptancesPdf: jest.Mock,
  ): Promise<INestApplication> {
    const usersRepository = {
      findAuthById: (id: string) =>
        Promise.resolve(
          id === admin.id ? admin : id === parte.id ? parte : undefined,
        ),
    };

    const moduleReference = await Test.createTestingModule({
      controllers: [LegalController],
      providers: [
        {
          provide: LegalService,
          useValue: { exportAcceptancesPdf },
        },
        {
          provide: PublicRateLimiter,
          useValue: { assertWithinLimit: jest.fn() },
        },
        { provide: UsersRepository, useValue: usersRepository },
        {
          provide: TOKEN_VERIFIER,
          useValue: {
            verify: (token: string) => Promise.resolve({ sub: token }),
          },
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

  it("serves the bytes untouched, as an application/pdf attachment", async () => {
    const exportAcceptancesPdf = jest
      .fn()
      .mockResolvedValue({ filename: "aceptaciones-x-y.pdf", pdf: pdfBytes });
    const app = await bootstrapApp(exportAcceptancesPdf);

    const response = await request(app.getHttpServer())
      .get("/legal/aceptaciones/export/pdf")
      .query({ desde: "2026-01-01" })
      .set("Authorization", "Bearer admin-1")
      .buffer()
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => callback(null, Buffer.concat(chunks)));
      });

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toBe("application/pdf");
    expect(response.headers["content-disposition"]).toBe(
      'attachment; filename="aceptaciones-x-y.pdf"',
    );
    // Byte-for-byte: a JSON-serialized Buffer would arrive as
    // {"type":"Buffer","data":[...]} and this is what catches it.
    expect(Buffer.compare(response.body as Buffer, pdfBytes)).toBe(0);
    expect(exportAcceptancesPdf).toHaveBeenCalledWith({ desde: "2026-01-01" });
    await app.close();
  });

  it("rejects a non-admin with 403 without rendering anything", async () => {
    const exportAcceptancesPdf = jest.fn();
    const app = await bootstrapApp(exportAcceptancesPdf);

    const response = await request(app.getHttpServer())
      .get("/legal/aceptaciones/export/pdf")
      .set("Authorization", "Bearer parte-1");

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("forbidden_role");
    expect(exportAcceptancesPdf).not.toHaveBeenCalled();
    await app.close();
  });

  it("rejects an unauthenticated request with 401", async () => {
    const exportAcceptancesPdf = jest.fn();
    const app = await bootstrapApp(exportAcceptancesPdf);

    const response = await request(app.getHttpServer()).get(
      "/legal/aceptaciones/export/pdf",
    );

    expect(response.status).toBe(401);
    expect(exportAcceptancesPdf).not.toHaveBeenCalled();
    await app.close();
  });
});
