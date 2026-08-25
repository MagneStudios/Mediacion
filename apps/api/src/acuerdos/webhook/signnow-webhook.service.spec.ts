import { Logger } from "@nestjs/common";
import type { HttpSignnowClient } from "../signnow/http-signnow-client";
import type { DocusignWebhookService } from "./docusign-webhook.service";
import {
  mapSignnowDocumentToSignerStatuses,
  SignnowWebhookService,
} from "./signnow-webhook.service";

function buildService(overrides?: {
  getDocument?: jest.Mock;
  applyEvent?: jest.Mock;
}) {
  const getDocument =
    overrides?.getDocument ??
    jest.fn().mockResolvedValue({ requests: [], field_invites: [] });
  const applyEvent = overrides?.applyEvent ?? jest.fn();
  const service = new SignnowWebhookService(
    { getDocument } as unknown as HttpSignnowClient,
    { applyEvent } as unknown as DocusignWebhookService,
  );
  return { service, getDocument, applyEvent };
}

describe("mapSignnowDocumentToSignerStatuses", () => {
  it("maps a freeform request with a signature_id to signed and without one to sent", () => {
    const statuses = mapSignnowDocumentToSignerStatuses({
      requests: [
        { signer_email: "a@example.com", signature_id: "sig-1" },
        { signer_email: "b@example.com", signature_id: null },
      ],
    });

    expect(statuses).toEqual([
      { recipientEmail: "a@example.com", status: "signed" },
      { recipientEmail: "b@example.com", status: "sent" },
    ]);
  });

  it("maps field_invites statuses: created/pending to sent, viewed to delivered, fulfilled to signed, declined to declined", () => {
    const statuses = mapSignnowDocumentToSignerStatuses({
      field_invites: [
        { email: "a@example.com", status: "created" },
        { email: "b@example.com", status: "pending" },
        { email: "c@example.com", status: "opened" },
        { email: "d@example.com", status: "fulfilled" },
        { email: "e@example.com", status: "declined" },
      ],
    });

    expect(statuses).toEqual([
      { recipientEmail: "a@example.com", status: "sent" },
      { recipientEmail: "b@example.com", status: "sent" },
      { recipientEmail: "c@example.com", status: "delivered" },
      { recipientEmail: "d@example.com", status: "signed" },
      { recipientEmail: "e@example.com", status: "declined" },
    ]);
  });

  it("lets a field_invite refine the status of the same signer's freeform request", () => {
    const statuses = mapSignnowDocumentToSignerStatuses({
      requests: [{ signer_email: "a@example.com", signature_id: null }],
      field_invites: [{ email: "a@example.com", status: "fulfilled" }],
    });

    expect(statuses).toEqual([
      { recipientEmail: "a@example.com", status: "signed" },
    ]);
  });

  it("never downgrades a signed freeform request with a lower-precedence field_invite", () => {
    const statuses = mapSignnowDocumentToSignerStatuses({
      requests: [{ signer_email: "a@example.com", signature_id: "sig-1" }],
      field_invites: [{ email: "a@example.com", status: "pending" }],
    });

    expect(statuses).toEqual([
      { recipientEmail: "a@example.com", status: "signed" },
    ]);
  });

  it("keeps the higher-precedence delivered status over a later sent field_invite", () => {
    const statuses = mapSignnowDocumentToSignerStatuses({
      field_invites: [
        { email: "a@example.com", status: "opened" },
        { email: "a@example.com", status: "created" },
      ],
    });

    expect(statuses).toEqual([
      { recipientEmail: "a@example.com", status: "delivered" },
    ]);
  });

  it("maps expired, cancelled, revoked and skipped field_invites to voided", () => {
    const statuses = mapSignnowDocumentToSignerStatuses({
      field_invites: [
        { email: "a@example.com", status: "expired" },
        { email: "b@example.com", status: "cancelled" },
        { email: "c@example.com", status: "revoked" },
        { email: "d@example.com", status: "skipped" },
      ],
    });

    expect(statuses).toEqual([
      { recipientEmail: "a@example.com", status: "voided" },
      { recipientEmail: "b@example.com", status: "voided" },
      { recipientEmail: "c@example.com", status: "voided" },
      { recipientEmail: "d@example.com", status: "voided" },
    ]);
  });

  it("lets a terminal field_invite override an already signed request", () => {
    const statuses = mapSignnowDocumentToSignerStatuses({
      requests: [{ signer_email: "a@example.com", signature_id: "sig-1" }],
      field_invites: [{ email: "a@example.com", status: "declined" }],
    });

    expect(statuses).toEqual([
      { recipientEmail: "a@example.com", status: "declined" },
    ]);
  });

  it("warns and defaults to sent for an unknown field_invite status", () => {
    const warnSpy = jest
      .spyOn(Logger.prototype, "warn")
      .mockImplementation(() => undefined);

    const statuses = mapSignnowDocumentToSignerStatuses({
      field_invites: [{ email: "a@example.com", status: "mystery-status" }],
    });

    expect(statuses).toEqual([
      { recipientEmail: "a@example.com", status: "sent" },
    ]);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        'Unknown signNow field_invite status "mystery-status"',
      ),
    );
    jest.restoreAllMocks();
  });

  it("does not warn for known field_invite statuses", () => {
    const warnSpy = jest
      .spyOn(Logger.prototype, "warn")
      .mockImplementation(() => undefined);

    mapSignnowDocumentToSignerStatuses({
      field_invites: [
        { email: "a@example.com", status: "created" },
        { email: "b@example.com", status: "fulfilled" },
        { email: "c@example.com", status: "expired" },
      ],
    });

    expect(warnSpy).not.toHaveBeenCalled();
    jest.restoreAllMocks();
  });

  it("merges request and field_invite entries for the same email with different casing", () => {
    const statuses = mapSignnowDocumentToSignerStatuses({
      requests: [{ signer_email: "A@Example.COM", signature_id: null }],
      field_invites: [{ email: "a@example.com", status: "fulfilled" }],
    });

    expect(statuses).toEqual([
      { recipientEmail: "a@example.com", status: "signed" },
    ]);
  });

  it("ignores entries without an email and returns an empty list for an empty document", () => {
    expect(mapSignnowDocumentToSignerStatuses({})).toEqual([]);
    expect(
      mapSignnowDocumentToSignerStatuses({
        requests: [{ signature_id: "sig-1" }],
        field_invites: [{ status: "fulfilled" }],
      }),
    ).toEqual([]);
  });
});

describe("SignnowWebhookService", () => {
  it("re-fetches the document and applies one event per signer through the existing status logic", async () => {
    const getDocument = jest.fn().mockResolvedValue({
      requests: [
        { signer_email: "a@example.com", signature_id: "sig-1" },
        { signer_email: "b@example.com", signature_id: "sig-2" },
      ],
    });
    const applyEvent = jest.fn().mockResolvedValue(undefined);
    const { service } = buildService({ getDocument, applyEvent });

    await service.processCallback({
      meta: { event: "document.complete" },
      content: { document_id: "document-1" },
    });

    expect(getDocument).toHaveBeenCalledWith("document-1");
    expect(applyEvent).toHaveBeenCalledTimes(2);
    expect(applyEvent).toHaveBeenNthCalledWith(1, {
      envelopeId: "document-1",
      recipientEmail: "a@example.com",
      status: "signed",
      event: "document.complete",
    });
    expect(applyEvent).toHaveBeenNthCalledWith(2, {
      envelopeId: "document-1",
      recipientEmail: "b@example.com",
      status: "signed",
      event: "document.complete",
    });
  });

  it("resolves the document id from top-level fields when content is absent", async () => {
    const getDocument = jest
      .fn()
      .mockResolvedValue({ requests: [], field_invites: [] });
    const { service } = buildService({ getDocument });

    await service.processCallback({
      event: "document.update",
      entity_id: "document-9",
    });

    expect(getDocument).toHaveBeenCalledWith("document-9");
  });

  it("ignores callbacks without any document id, never calling signNow", async () => {
    jest.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
    const getDocument = jest.fn();
    const applyEvent = jest.fn();
    const { service } = buildService({ getDocument, applyEvent });

    await service.processCallback({});

    expect(getDocument).not.toHaveBeenCalled();
    expect(applyEvent).not.toHaveBeenCalled();
    jest.restoreAllMocks();
  });

  it("propagates signNow document fetch failures so the webhook responds with an error", async () => {
    const getDocument = jest
      .fn()
      .mockRejectedValue(
        new Error("signNow document fetch failed with status 404"),
      );
    const { service } = buildService({ getDocument });

    await expect(
      service.processCallback({ content: { document_id: "document-1" } }),
    ).rejects.toThrow("signNow document fetch failed with status 404");
  });

  it("applies delivered and declined statuses derived from field_invites", async () => {
    const getDocument = jest.fn().mockResolvedValue({
      field_invites: [
        { email: "a@example.com", status: "opened" },
        { email: "b@example.com", status: "declined" },
      ],
    });
    const applyEvent = jest.fn().mockResolvedValue(undefined);
    const { service } = buildService({ getDocument, applyEvent });

    await service.processCallback({
      meta: { event: "document.update" },
      content: { document_id: "document-1" },
    });

    expect(applyEvent).toHaveBeenCalledWith({
      envelopeId: "document-1",
      recipientEmail: "a@example.com",
      status: "delivered",
      event: "document.update",
    });
    expect(applyEvent).toHaveBeenCalledWith({
      envelopeId: "document-1",
      recipientEmail: "b@example.com",
      status: "declined",
      event: "document.update",
    });
  });
});
