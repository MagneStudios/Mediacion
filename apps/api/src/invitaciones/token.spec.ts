import { generateToken } from "./token";

describe("generateToken", () => {
  it("produces a url-safe base64 token with no padding characters", () => {
    const token = generateToken();

    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(token.length).toBeGreaterThanOrEqual(40);
  });

  it("produces a different token on every call", () => {
    const first = generateToken();
    const second = generateToken();

    expect(first).not.toBe(second);
  });
});
