import type { Database } from "@mediacion/db-types";
import type { Insertable } from "kysely";

describe("Database Kysely column typing", () => {
  it("allows inserting a plan without its DB-generated columns", () => {
    const planInsert: Insertable<Database["planes"]> = {
      nombre: "Plan Basico",
      limite_carpetas: 5,
      limite_casos: 10,
      limite_iteraciones_ia: 20,
      precio: 999,
    };

    expect(planInsert).toEqual({
      nombre: "Plan Basico",
      limite_carpetas: 5,
      limite_casos: 10,
      limite_iteraciones_ia: 20,
      precio: 999,
    });
  });
});
