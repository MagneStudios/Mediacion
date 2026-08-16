import { assertValidAcceptanceBody } from "./acceptance-payload";

describe("assertValidAcceptanceBody", () => {
  it("accepts an empty body as no marketing choice", () => {
    expect(assertValidAcceptanceBody({})).toEqual({});
    expect(assertValidAcceptanceBody(undefined)).toEqual({});
    expect(assertValidAcceptanceBody(null)).toEqual({});
  });

  it("keeps an explicit marketing choice, true or false", () => {
    expect(assertValidAcceptanceBody({ marketing: true })).toEqual({
      marketing: true,
    });
    expect(assertValidAcceptanceBody({ marketing: false })).toEqual({
      marketing: false,
    });
  });

  it.each(["ip", "user_agent", "document_version", "accepted_at"])(
    "rejects a payload that tries to forge %s",
    (field) => {
      expect(() => assertValidAcceptanceBody({ [field]: "forged" })).toThrow(
        expect.objectContaining({
          status: 400,
          response: expect.objectContaining({ code: "invalid_input" }),
        }),
      );
    },
  );

  it("rejects any unknown property", () => {
    expect(() =>
      assertValidAcceptanceBody({ marketing: true, extra: 1 }),
    ).toThrow(
      expect.objectContaining({
        response: expect.objectContaining({ code: "invalid_input" }),
      }),
    );
  });

  it("rejects a non boolean marketing", () => {
    expect(() => assertValidAcceptanceBody({ marketing: "si" })).toThrow(
      expect.objectContaining({
        response: expect.objectContaining({ code: "invalid_input" }),
      }),
    );
  });
});
