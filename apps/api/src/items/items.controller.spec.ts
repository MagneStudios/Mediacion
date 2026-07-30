import type { INestApplication } from "@nestjs/common";
import { HttpException } from "@nestjs/common";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AuthGuard } from "../auth/auth.guard";
import type { AuthenticatedUser } from "../auth/authenticated-user";
import { TOKEN_VERIFIER } from "../auth/token-verifier";
import { UsersRepository } from "../auth/users.repository";
import { MembershipService } from "../casos/membership.service";
import { AllExceptionsFilter } from "../common/filters/all-exceptions.filter";
import { ItemsController } from "./items.controller";
import { ItemsRepository } from "./items.repository";
import { ItemsService } from "./items.service";
import type { CreateItemDto, Item, UpdateItemDto } from "./items.types";

const parteA: AuthenticatedUser = {
  id: "user-a",
  email: "a@b.com",
  rol: "parte",
};
const parteB: AuthenticatedUser = {
  id: "user-b",
  email: "b@b.com",
  rol: "parte",
};
const strangerC: AuthenticatedUser = {
  id: "user-c",
  email: "c@b.com",
  rol: "parte",
};

const sharedCasoId = "caso-shared";
const casoMembers = new Set([parteA.id, parteB.id]);

describe("/casos/:id/items and /items/:id end-to-end — RN-01 adversarial matrix", () => {
  function createStatefulItemsRepository() {
    const store: Item[] = [];
    let nextId = 1;
    return {
      createOwn: jest.fn(
        async (dto: CreateItemDto, casoId: string, callerId: string) => {
          const item = {
            id: `item-${nextId++}`,
            caso_id: casoId,
            parte_id: callerId,
            categoria: dto.categoria,
            nombre: dto.nombre,
            descripcion: dto.descripcion ?? null,
            valor_min: dto.valor_min ?? null,
            valor_max: dto.valor_max ?? null,
            puede_ceder: dto.puede_ceder ?? false,
            condiciones_cesion: dto.condiciones_cesion ?? null,
            privado: true,
            created_at: "now",
            updated_at: "now",
          } as unknown as Item;
          store.push(item);
          return item;
        },
      ),
      findOwn: jest.fn(async (casoId: string, callerId: string) =>
        store.filter(
          (item) => item.caso_id === casoId && item.parte_id === callerId,
        ),
      ),
      findOwnById: jest.fn(async (itemId: string, callerId: string) =>
        store.find((item) => item.id === itemId && item.parte_id === callerId),
      ),
      updateOwn: jest.fn(
        async (itemId: string, callerId: string, patch: UpdateItemDto) => {
          const index = store.findIndex(
            (item) => item.id === itemId && item.parte_id === callerId,
          );
          if (index === -1) {
            return undefined;
          }
          store[index] = { ...store[index], ...patch };
          return store[index];
        },
      ),
      updateOwnWithLock: jest.fn(
        async (
          itemId: string,
          callerId: string,
          computePatch: (current: Item) => UpdateItemDto,
        ) => {
          const index = store.findIndex(
            (item) => item.id === itemId && item.parte_id === callerId,
          );
          if (index === -1) {
            return undefined;
          }
          const patch = computePatch(store[index]);
          store[index] = { ...store[index], ...patch };
          return store[index];
        },
      ),
    };
  }

  async function bootstrapApp(
    itemsRepository: ReturnType<typeof createStatefulItemsRepository>,
  ) {
    const usersRepository = {
      findAuthById: (id: string) =>
        Promise.resolve(
          [parteA, parteB, strangerC].find((user) => user.id === id),
        ),
    };
    const assertMembership = jest.fn(
      async (casoId: string, callerId: string) => {
        if (casoId === sharedCasoId && casoMembers.has(callerId)) {
          return {
            rol_en_caso: callerId === parteA.id ? "parte_a" : "parte_b",
          };
        }
        throw new HttpException(
          { code: "caso_not_found", message: "Case not found" },
          404,
        );
      },
    );

    const moduleReference = await Test.createTestingModule({
      controllers: [ItemsController],
      providers: [
        ItemsService,
        { provide: ItemsRepository, useValue: itemsRepository },
        { provide: MembershipService, useValue: { assertMembership } },
        { provide: UsersRepository, useValue: usersRepository },
        {
          provide: TOKEN_VERIFIER,
          useValue: {
            verify: (token: string) => Promise.resolve({ sub: token }),
          },
        },
        AuthGuard,
        { provide: APP_GUARD, useExisting: AuthGuard },
        { provide: APP_FILTER, useClass: AllExceptionsFilter },
      ],
    }).compile();

    const app = moduleReference.createNestApplication();
    await app.init();
    return app;
  }

  let app: INestApplication;
  let itemsRepository: ReturnType<typeof createStatefulItemsRepository>;

  beforeEach(async () => {
    itemsRepository = createStatefulItemsRepository();
    app = await bootstrapApp(itemsRepository);
  });

  afterEach(async () => {
    await app.close();
  });

  it("rejects an unauthenticated create attempt with 401", async () => {
    const response = await request(app.getHttpServer())
      .post(`/casos/${sharedCasoId}/items`)
      .send({ categoria: "bienes", nombre: "Auto" });

    expect(response.status).toBe(401);
  });

  it("rejects a non-member's create attempt with 404", async () => {
    const response = await request(app.getHttpServer())
      .post(`/casos/${sharedCasoId}/items`)
      .set("Authorization", `Bearer ${strangerC.id}`)
      .send({ categoria: "bienes", nombre: "Auto" });

    expect(response.status).toBe(404);
  });

  it("rejects a non-member's list attempt with 404", async () => {
    const response = await request(app.getHttpServer())
      .get(`/casos/${sharedCasoId}/items`)
      .set("Authorization", `Bearer ${strangerC.id}`);

    expect(response.status).toBe(404);
  });

  it("a member creates a private item scoped to themselves", async () => {
    const response = await request(app.getHttpServer())
      .post(`/casos/${sharedCasoId}/items`)
      .set("Authorization", `Bearer ${parteA.id}`)
      .send({ categoria: "bienes", nombre: "Auto de A" });

    expect(response.status).toBe(201);
    expect(response.body.parte_id).toBe(parteA.id);
    expect(response.body.caso_id).toBe(sharedCasoId);
  });

  it("ADVERSARIAL: party A's list contains zero of party B's items in the same case", async () => {
    await request(app.getHttpServer())
      .post(`/casos/${sharedCasoId}/items`)
      .set("Authorization", `Bearer ${parteA.id}`)
      .send({ categoria: "bienes", nombre: "Auto de A" });
    await request(app.getHttpServer())
      .post(`/casos/${sharedCasoId}/items`)
      .set("Authorization", `Bearer ${parteA.id}`)
      .send({ categoria: "economico", nombre: "Ahorros de A" });
    const bResponse = await request(app.getHttpServer())
      .post(`/casos/${sharedCasoId}/items`)
      .set("Authorization", `Bearer ${parteB.id}`)
      .send({
        categoria: "personalizado",
        nombre: "Secreto de B",
        valor_min: "999",
      });

    const aListResponse = await request(app.getHttpServer())
      .get(`/casos/${sharedCasoId}/items`)
      .set("Authorization", `Bearer ${parteA.id}`);

    expect(aListResponse.status).toBe(200);
    expect(aListResponse.body).toHaveLength(2);
    expect(
      aListResponse.body.some((item: Item) => item.id === bResponse.body.id),
    ).toBe(false);
    expect(
      aListResponse.body.some((item: Item) => item.nombre === "Secreto de B"),
    ).toBe(false);
    expect(
      aListResponse.body.some((item: Item) => item.valor_min === "999"),
    ).toBe(false);

    const bListResponse = await request(app.getHttpServer())
      .get(`/casos/${sharedCasoId}/items`)
      .set("Authorization", `Bearer ${parteB.id}`);

    expect(bListResponse.status).toBe(200);
    expect(bListResponse.body).toHaveLength(1);
    expect(bListResponse.body[0].nombre).toBe("Secreto de B");
  });

  it("ADVERSARIAL: party B cannot GET party A's item by id — identical 404 to a non-existent id", async () => {
    const createResponse = await request(app.getHttpServer())
      .post(`/casos/${sharedCasoId}/items`)
      .set("Authorization", `Bearer ${parteA.id}`)
      .send({ categoria: "bienes", nombre: "Auto de A" });
    const aItemId = createResponse.body.id;

    const foreignAttempt = await request(app.getHttpServer())
      .get(`/items/${aItemId}`)
      .set("Authorization", `Bearer ${parteB.id}`);
    const nonExistentAttempt = await request(app.getHttpServer())
      .get("/items/does-not-exist")
      .set("Authorization", `Bearer ${parteB.id}`);

    expect(foreignAttempt.status).toBe(404);
    expect(nonExistentAttempt.status).toBe(404);
    expect(foreignAttempt.body).toEqual(nonExistentAttempt.body);
  });

  it("ADVERSARIAL: party B cannot PATCH party A's item by id — value stays unchanged", async () => {
    const createResponse = await request(app.getHttpServer())
      .post(`/casos/${sharedCasoId}/items`)
      .set("Authorization", `Bearer ${parteA.id}`)
      .send({ categoria: "bienes", nombre: "Auto de A" });
    const aItemId = createResponse.body.id;

    const patchAttempt = await request(app.getHttpServer())
      .patch(`/items/${aItemId}`)
      .set("Authorization", `Bearer ${parteB.id}`)
      .send({ nombre: "Secuestrado por B" });

    expect(patchAttempt.status).toBe(404);

    const ownerView = await request(app.getHttpServer())
      .get(`/items/${aItemId}`)
      .set("Authorization", `Bearer ${parteA.id}`);

    expect(ownerView.status).toBe(200);
    expect(ownerView.body.nombre).toBe("Auto de A");
  });

  it("rejects a non-member C's GET and PATCH on any item in the case with 404", async () => {
    const createResponse = await request(app.getHttpServer())
      .post(`/casos/${sharedCasoId}/items`)
      .set("Authorization", `Bearer ${parteA.id}`)
      .send({ categoria: "bienes", nombre: "Auto de A" });
    const aItemId = createResponse.body.id;

    const getAttempt = await request(app.getHttpServer())
      .get(`/items/${aItemId}`)
      .set("Authorization", `Bearer ${strangerC.id}`);
    const patchAttempt = await request(app.getHttpServer())
      .patch(`/items/${aItemId}`)
      .set("Authorization", `Bearer ${strangerC.id}`)
      .send({ nombre: "Robado por C" });

    expect(getAttempt.status).toBe(404);
    expect(patchAttempt.status).toBe(404);
  });

  it("an owner successfully updates their own item", async () => {
    const createResponse = await request(app.getHttpServer())
      .post(`/casos/${sharedCasoId}/items`)
      .set("Authorization", `Bearer ${parteA.id}`)
      .send({ categoria: "bienes", nombre: "Auto de A" });
    const aItemId = createResponse.body.id;

    const patchResponse = await request(app.getHttpServer())
      .patch(`/items/${aItemId}`)
      .set("Authorization", `Bearer ${parteA.id}`)
      .send({ nombre: "Auto renovado" });

    expect(patchResponse.status).toBe(200);
    expect(patchResponse.body.nombre).toBe("Auto renovado");
  });

  it("rejects a PATCH with an invalid categoria with 400", async () => {
    const createResponse = await request(app.getHttpServer())
      .post(`/casos/${sharedCasoId}/items`)
      .set("Authorization", `Bearer ${parteA.id}`)
      .send({ categoria: "bienes", nombre: "Auto de A" });
    const aItemId = createResponse.body.id;

    const patchResponse = await request(app.getHttpServer())
      .patch(`/items/${aItemId}`)
      .set("Authorization", `Bearer ${parteA.id}`)
      .send({ categoria: "not-a-real-categoria" });

    expect(patchResponse.status).toBe(400);
  });

  it("rejects a PATCH with an empty nombre with 400", async () => {
    const createResponse = await request(app.getHttpServer())
      .post(`/casos/${sharedCasoId}/items`)
      .set("Authorization", `Bearer ${parteA.id}`)
      .send({ categoria: "bienes", nombre: "Auto de A" });
    const aItemId = createResponse.body.id;

    const patchResponse = await request(app.getHttpServer())
      .patch(`/items/${aItemId}`)
      .set("Authorization", `Bearer ${parteA.id}`)
      .send({ nombre: "" });

    expect(patchResponse.status).toBe(400);
  });

  it("rejects an empty PATCH body with 400, leaving the item unchanged", async () => {
    const createResponse = await request(app.getHttpServer())
      .post(`/casos/${sharedCasoId}/items`)
      .set("Authorization", `Bearer ${parteA.id}`)
      .send({ categoria: "bienes", nombre: "Auto de A" });
    const aItemId = createResponse.body.id;

    const patchResponse = await request(app.getHttpServer())
      .patch(`/items/${aItemId}`)
      .set("Authorization", `Bearer ${parteA.id}`)
      .send({});

    expect(patchResponse.status).toBe(400);
    expect(patchResponse.body.error.code).toBe("no_updatable_fields");

    const ownerView = await request(app.getHttpServer())
      .get(`/items/${aItemId}`)
      .set("Authorization", `Bearer ${parteA.id}`);
    expect(ownerView.body.nombre).toBe("Auto de A");
  });

  it("rejects a PATCH containing only non-allowlisted keys with 400, leaving the item unchanged", async () => {
    const createResponse = await request(app.getHttpServer())
      .post(`/casos/${sharedCasoId}/items`)
      .set("Authorization", `Bearer ${parteA.id}`)
      .send({ categoria: "bienes", nombre: "Auto de A" });
    const aItemId = createResponse.body.id;

    const patchResponse = await request(app.getHttpServer())
      .patch(`/items/${aItemId}`)
      .set("Authorization", `Bearer ${parteA.id}`)
      .send({ foo: "bar" });

    expect(patchResponse.status).toBe(400);

    const ownerView = await request(app.getHttpServer())
      .get(`/items/${aItemId}`)
      .set("Authorization", `Bearer ${parteA.id}`);
    expect(ownerView.body.nombre).toBe("Auto de A");
  });

  it("rejects a mass-assignment-only PATCH with 400, leaving parte_id unchanged", async () => {
    const createResponse = await request(app.getHttpServer())
      .post(`/casos/${sharedCasoId}/items`)
      .set("Authorization", `Bearer ${parteA.id}`)
      .send({ categoria: "bienes", nombre: "Auto de A" });
    const aItemId = createResponse.body.id;

    const patchResponse = await request(app.getHttpServer())
      .patch(`/items/${aItemId}`)
      .set("Authorization", `Bearer ${parteA.id}`)
      .send({ parte_id: parteB.id });

    expect(patchResponse.status).toBe(400);

    const ownerView = await request(app.getHttpServer())
      .get(`/items/${aItemId}`)
      .set("Authorization", `Bearer ${parteA.id}`);
    expect(ownerView.body.parte_id).toBe(parteA.id);
  });

  it("WARNING 2 closed: rejects a partial PATCH whose effective range merged with persisted state violates RN-02", async () => {
    const createResponse = await request(app.getHttpServer())
      .post(`/casos/${sharedCasoId}/items`)
      .set("Authorization", `Bearer ${parteA.id}`)
      .send({
        categoria: "bienes",
        nombre: "Auto de A",
        valor_min: "50",
        valor_max: "2000",
      });
    const aItemId = createResponse.body.id;

    const patchResponse = await request(app.getHttpServer())
      .patch(`/items/${aItemId}`)
      .set("Authorization", `Bearer ${parteA.id}`)
      .send({ valor_min: "9999" });

    expect(patchResponse.status).toBe(400);

    const ownerView = await request(app.getHttpServer())
      .get(`/items/${aItemId}`)
      .set("Authorization", `Bearer ${parteA.id}`);

    expect(ownerView.body.valor_min).toBe("50");
  });
});
