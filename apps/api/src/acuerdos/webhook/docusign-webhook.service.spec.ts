import { Logger } from "@nestjs/common";
import type { AcuerdosRepository } from "../acuerdos.repository";
import type { FirmasRepository } from "../firmas.repository";
import { DocusignWebhookService } from "./docusign-webhook.service";

describe("DocusignWebhookService", () => {
  function buildService(overrides?: {
    findByEnvelopeAndEmail?: jest.Mock;
    updateStatus?: jest.Mock;
    allSignedForAcuerdo?: jest.Mock;
    markFirmado?: jest.Mock;
  }) {
    const firmasRepository = {
      findByEnvelopeAndEmail:
        overrides?.findByEnvelopeAndEmail ??
        jest.fn().mockResolvedValue(undefined),
      updateStatus: overrides?.updateStatus ?? jest.fn(),
      allSignedForAcuerdo:
        overrides?.allSignedForAcuerdo ?? jest.fn().mockResolvedValue(false),
    } as unknown as FirmasRepository;
    const acuerdosRepository = {
      markFirmado: overrides?.markFirmado ?? jest.fn(),
    } as unknown as AcuerdosRepository;
    return {
      service: new DocusignWebhookService(firmasRepository, acuerdosRepository),
      firmasRepository,
      acuerdosRepository,
    };
  }

  it("updates the matching firma's docusign_status for the envelope and recipient", async () => {
    const findByEnvelopeAndEmail = jest.fn().mockResolvedValue({
      id: "firma-1",
      acuerdo_id: "acuerdo-1",
      docusign_status: "pending",
    });
    const updateStatus = jest.fn().mockResolvedValue(undefined);
    const { service } = buildService({ findByEnvelopeAndEmail, updateStatus });

    await service.applyEvent({
      envelopeId: "envelope-1",
      recipientEmail: "a@example.com",
      status: "sent",
      event: "recipient-sent",
    });

    expect(findByEnvelopeAndEmail).toHaveBeenCalledWith(
      "envelope-1",
      "a@example.com",
    );
    expect(updateStatus).toHaveBeenCalledWith("firma-1", "sent");
  });

  it("marks the acuerdo firmado only when all party firmas are signed", async () => {
    const findByEnvelopeAndEmail = jest.fn().mockResolvedValue({
      id: "firma-1",
      acuerdo_id: "acuerdo-1",
      docusign_status: "pending",
    });
    const updateStatus = jest.fn().mockResolvedValue(undefined);
    const allSignedForAcuerdo = jest.fn().mockResolvedValue(true);
    const markFirmado = jest.fn().mockResolvedValue(undefined);
    const { service } = buildService({
      findByEnvelopeAndEmail,
      updateStatus,
      allSignedForAcuerdo,
      markFirmado,
    });

    await service.applyEvent({
      envelopeId: "envelope-1",
      recipientEmail: "a@example.com",
      status: "signed",
      event: "recipient-completed",
    });

    expect(allSignedForAcuerdo).toHaveBeenCalledWith("acuerdo-1");
    expect(markFirmado).toHaveBeenCalledWith("acuerdo-1");
  });

  it("does not mark firmado when at least one other party's firma is still pending", async () => {
    const findByEnvelopeAndEmail = jest.fn().mockResolvedValue({
      id: "firma-1",
      acuerdo_id: "acuerdo-1",
      docusign_status: "pending",
    });
    const updateStatus = jest.fn().mockResolvedValue(undefined);
    const allSignedForAcuerdo = jest.fn().mockResolvedValue(false);
    const markFirmado = jest.fn();
    const { service } = buildService({
      findByEnvelopeAndEmail,
      updateStatus,
      allSignedForAcuerdo,
      markFirmado,
    });

    await service.applyEvent({
      envelopeId: "envelope-1",
      recipientEmail: "a@example.com",
      status: "signed",
      event: "recipient-completed",
    });

    expect(markFirmado).not.toHaveBeenCalled();
  });

  it("is idempotent: a duplicate event already at the target status causes no mutation", async () => {
    const findByEnvelopeAndEmail = jest.fn().mockResolvedValue({
      id: "firma-1",
      acuerdo_id: "acuerdo-1",
      docusign_status: "signed",
    });
    const updateStatus = jest.fn();
    const allSignedForAcuerdo = jest.fn();
    const markFirmado = jest.fn();
    const { service } = buildService({
      findByEnvelopeAndEmail,
      updateStatus,
      allSignedForAcuerdo,
      markFirmado,
    });

    await service.applyEvent({
      envelopeId: "envelope-1",
      recipientEmail: "a@example.com",
      status: "signed",
      event: "recipient-completed",
    });

    expect(updateStatus).not.toHaveBeenCalled();
    expect(allSignedForAcuerdo).not.toHaveBeenCalled();
    expect(markFirmado).not.toHaveBeenCalled();
  });

  it("logs a warning and does not update status when a late 'sent' event arrives after 'signed' is already stored", async () => {
    const warnSpy = jest.spyOn(Logger.prototype, "warn").mockImplementation();
    const findByEnvelopeAndEmail = jest.fn().mockResolvedValue({
      id: "firma-1",
      acuerdo_id: "acuerdo-1",
      docusign_status: "signed",
    });
    const updateStatus = jest.fn();
    const allSignedForAcuerdo = jest.fn();
    const markFirmado = jest.fn();
    const { service } = buildService({
      findByEnvelopeAndEmail,
      updateStatus,
      allSignedForAcuerdo,
      markFirmado,
    });

    await service.applyEvent({
      envelopeId: "envelope-1",
      recipientEmail: "a@example.com",
      status: "sent",
      event: "recipient-sent",
    });

    expect(updateStatus).not.toHaveBeenCalled();
    expect(allSignedForAcuerdo).not.toHaveBeenCalled();
    expect(markFirmado).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("envelope-1"));
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("signed"));
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("sent"));
  });

  it("logs a warning and does not update status when 'signed' arrives after 'declined' is already stored", async () => {
    const warnSpy = jest.spyOn(Logger.prototype, "warn").mockImplementation();
    const findByEnvelopeAndEmail = jest.fn().mockResolvedValue({
      id: "firma-1",
      acuerdo_id: "acuerdo-1",
      docusign_status: "declined",
    });
    const updateStatus = jest.fn();
    const { service } = buildService({ findByEnvelopeAndEmail, updateStatus });

    await service.applyEvent({
      envelopeId: "envelope-1",
      recipientEmail: "a@example.com",
      status: "signed",
      event: "recipient-completed",
    });

    expect(updateStatus).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
  });

  it("no-ops silently when the envelope/recipient pair is unknown", async () => {
    const findByEnvelopeAndEmail = jest.fn().mockResolvedValue(undefined);
    const updateStatus = jest.fn();
    const { service } = buildService({ findByEnvelopeAndEmail, updateStatus });

    await service.applyEvent({
      envelopeId: "unknown-envelope",
      recipientEmail: "ghost@example.com",
      status: "signed",
      event: "recipient-completed",
    });

    expect(updateStatus).not.toHaveBeenCalled();
  });
});
