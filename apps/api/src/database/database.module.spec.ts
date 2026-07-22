import { Test } from "@nestjs/testing";
import { Kysely } from "kysely";
import { DatabaseModule } from "./database.module";
import { KYSELY } from "./database.tokens";

describe("DatabaseModule", () => {
  it("resolves an overridden KYSELY provider without connecting to a database", async () => {
    const fakeKysely = { fake: true };

    const moduleReference = await Test.createTestingModule({
      imports: [DatabaseModule],
    })
      .overrideProvider(KYSELY)
      .useValue(fakeKysely)
      .compile();

    const resolvedKysely = moduleReference.get(KYSELY);

    expect(resolvedKysely).toBe(fakeKysely);
  });

  it("builds a real Kysely instance from the default provider without connecting", async () => {
    const moduleReference = await Test.createTestingModule({
      imports: [DatabaseModule],
    }).compile();

    const resolvedKysely = moduleReference.get(KYSELY);

    expect(resolvedKysely).toBeInstanceOf(Kysely);
  });
});
