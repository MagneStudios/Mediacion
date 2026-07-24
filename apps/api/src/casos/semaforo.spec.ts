import { computeSemaforo } from "./semaforo";

describe("computeSemaforo", () => {
  const now = new Date("2026-07-24T12:00:00.000Z");

  it("returns 'rojo' when plazo has already passed", () => {
    const plazo = new Date("2026-07-24T00:00:00.000Z");

    expect(computeSemaforo(plazo, now)).toBe("rojo");
  });

  it("returns 'verde' when plazo is far in the future", () => {
    const plazo = new Date("2026-08-24T12:00:00.000Z");

    expect(computeSemaforo(plazo, now)).toBe("verde");
  });

  it("returns 'amarillo' when plazo is imminent but not yet passed", () => {
    const plazo = new Date("2026-07-25T18:00:00.000Z");

    expect(computeSemaforo(plazo, now)).toBe("amarillo");
  });

  it("returns null when plazo is null", () => {
    expect(computeSemaforo(null, now)).toBeNull();
  });

  it("returns 'rojo' when plazo is exactly 24h away", () => {
    const plazo = new Date("2026-07-25T12:00:00.000Z");

    expect(computeSemaforo(plazo, now)).toBe("rojo");
  });

  it("returns 'amarillo' when plazo is exactly 72h away", () => {
    const plazo = new Date("2026-07-27T12:00:00.000Z");

    expect(computeSemaforo(plazo, now)).toBe("amarillo");
  });
});
