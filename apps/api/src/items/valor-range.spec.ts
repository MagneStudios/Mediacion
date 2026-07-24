import { HttpException } from "@nestjs/common";
import { assertValidRange } from "./valor-range";

describe("assertValidRange", () => {
  it("rejects a numeric valor_min greater than valor_max", () => {
    let thrown: unknown;
    try {
      assertValidRange("500", "100");
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(HttpException);
    expect((thrown as HttpException).getStatus()).toBe(400);
    expect((thrown as HttpException).getResponse()).toEqual({
      code: "invalid_input",
      message: "valor_min must be <= valor_max",
    });
  });

  it("accepts a numeric valor_min equal to valor_max", () => {
    expect(() => assertValidRange("100", "100")).not.toThrow();
  });

  it("accepts a numeric valor_min less than valor_max", () => {
    expect(() => assertValidRange("100", "500")).not.toThrow();
  });

  it("accepts non-numeric values as-is without comparison", () => {
    expect(() => assertValidRange("flexible", "negotiable")).not.toThrow();
  });

  it("accepts when one side is non-numeric and the other numeric", () => {
    expect(() => assertValidRange("100", "negotiable")).not.toThrow();
  });

  it("accepts when both sides are null or undefined", () => {
    expect(() => assertValidRange(null, undefined)).not.toThrow();
  });
});
