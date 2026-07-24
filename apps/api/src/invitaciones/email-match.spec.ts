import { emailsMatch } from "./email-match";

describe("emailsMatch", () => {
  it("matches identical emails", () => {
    expect(emailsMatch("A@B.com", "a@b.com")).toBe(true);
  });

  it("rejects a null email_destino", () => {
    expect(emailsMatch(null, "a@b.com")).toBe(false);
  });

  it("rejects a different email", () => {
    expect(emailsMatch("a@b.com", "c@d.com")).toBe(false);
  });
});
