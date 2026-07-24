import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import { Kysely } from "kysely";
import { ConfigModule } from "../config/config.module";
import { DatabaseModule } from "./database.module";
import { KYSELY } from "./database.tokens";

describe("DatabaseModule", () => {
  describe("with an overridden KYSELY provider", () => {
    let moduleReference: TestingModule;
    const fakeKysely = { fake: true };

    beforeAll(async () => {
      moduleReference = await Test.createTestingModule({
        imports: [DatabaseModule],
      })
        .overrideProvider(KYSELY)
        .useValue(fakeKysely)
        .compile();
    });

    afterAll(async () => {
      await moduleReference.close();
    });

    it("resolves the overridden value without connecting to a database", () => {
      expect(moduleReference.get(KYSELY)).toBe(fakeKysely);
    });
  });

  describe("with the default provider", () => {
    let moduleReference: TestingModule;

    beforeAll(async () => {
      moduleReference = await Test.createTestingModule({
        imports: [ConfigModule, DatabaseModule],
      }).compile();
    });

    afterAll(async () => {
      await moduleReference.close();
    });

    it("builds a real Kysely instance without connecting", () => {
      expect(moduleReference.get(KYSELY)).toBeInstanceOf(Kysely);
    });
  });
});
