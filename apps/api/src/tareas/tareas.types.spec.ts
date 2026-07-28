import type { Tarea, tareaViewColumns } from "./tareas.types";

type AllowlistedColumn = (typeof tareaViewColumns)[number];
type TareaKeysBeyondAllowlist = Exclude<keyof Tarea, AllowlistedColumn>;
type AllowlistColumnsMissingFromTarea = Exclude<AllowlistedColumn, keyof Tarea>;
type AssertNever<T extends never> = T;
type TareaColumnsMatchAllowlist = AssertNever<
  TareaKeysBeyondAllowlist | AllowlistColumnsMissingFromTarea
>;

describe("Tarea", () => {
  it("exposes exactly the tareaViewColumns allowlist — compile guard", () => {
    const guard: TareaColumnsMatchAllowlist extends never ? true : false = true;
    expect(guard).toBe(true);
  });
});
