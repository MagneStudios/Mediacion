import { findOffensiveTerms } from "./ofensivo-match";

const terminos = ["idiota", "estupido", "hijo de"];

describe("findOffensiveTerms", () => {
  it("finds a term written exactly as the list has it", () => {
    expect(findOffensiveTerms("sos un idiota", terminos)).toEqual(["idiota"]);
  });

  it("ignores case and accents, so the list does not enumerate variants", () => {
    expect(findOffensiveTerms("sos un ESTÚPIDO", terminos)).toEqual([
      "estupido",
    ]);
  });

  it("matches a multi-word term as consecutive whole words", () => {
    expect(findOffensiveTerms("es un hijo de vecino", terminos)).toEqual([
      "hijo de",
    ]);
  });

  it("does not match a term inside a longer innocent word", () => {
    expect(findOffensiveTerms("idiotarium no es un insulto", terminos)).toEqual(
      [],
    );
    expect(findOffensiveTerms("sos un semiidiota", terminos)).toEqual([]);
  });

  it("sees through punctuation glued to the word", () => {
    expect(findOffensiveTerms("callate, idiota!", terminos)).toEqual([
      "idiota",
    ]);
  });

  it("returns every distinct term found, without repeating one", () => {
    const found = findOffensiveTerms("idiota, idiota y estupido", terminos);

    expect(found.sort()).toEqual(["estupido", "idiota"]);
  });

  it("accepts clean text", () => {
    expect(
      findOffensiveTerms("Propongo revisar el cronograma", terminos),
    ).toEqual([]);
  });

  it("accepts anything when the list is empty, instead of blocking everything", () => {
    expect(findOffensiveTerms("sos un idiota", [])).toEqual([]);
  });

  it("skips blank entries in the list rather than matching every text", () => {
    expect(findOffensiveTerms("texto limpio", ["", "   "])).toEqual([]);
  });

  it("handles empty input", () => {
    expect(findOffensiveTerms("", terminos)).toEqual([]);
    expect(findOffensiveTerms("   ", terminos)).toEqual([]);
  });
});
