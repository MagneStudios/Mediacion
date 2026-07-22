import { UsersRepository } from "./users.repository";

describe("UsersRepository", () => {
  function createFakeKysely(row: unknown) {
    const executeTakeFirst = jest.fn().mockResolvedValue(row);
    const where = jest.fn().mockReturnValue({ executeTakeFirst });
    const select = jest.fn().mockReturnValue({ where });
    const selectFrom = jest.fn().mockReturnValue({ select });
    return { selectFrom, select, where, executeTakeFirst };
  }

  it("selects id, email and rol by id", async () => {
    const row = { id: "user-1", email: "a@b.com", rol: "admin" };
    const fakeKysely = createFakeKysely(row);
    const repository = new UsersRepository(fakeKysely as never);

    const result = await repository.findAuthById("user-1");

    expect(fakeKysely.selectFrom).toHaveBeenCalledWith("usuarios");
    expect(fakeKysely.select).toHaveBeenCalledWith(["id", "email", "rol"]);
    expect(fakeKysely.where).toHaveBeenCalledWith("id", "=", "user-1");
    expect(result).toEqual(row);
  });

  it("returns undefined when no row matches", async () => {
    const fakeKysely = createFakeKysely(undefined);
    const repository = new UsersRepository(fakeKysely as never);

    const result = await repository.findAuthById("missing-user");

    expect(result).toBeUndefined();
  });
});
