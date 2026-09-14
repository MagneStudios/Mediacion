import { agreementDocumentFilename } from "./acuerdo-export";

describe("agreementDocumentFilename", () => {
  it("names the export after the agreement id", () => {
    expect(agreementDocumentFilename("acuerdo-1")).toBe(
      "acuerdo-acuerdo-1.pdf",
    );
  });

  it("is a pdf, which is what SignNow receives and what the parties sign", () => {
    expect(agreementDocumentFilename("acuerdo-1").endsWith(".pdf")).toBe(true);
  });
});
