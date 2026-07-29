import { Logger } from "@nestjs/common";
import type { TareasService } from "../../tareas/tareas.service";
import type { AcuerdosRepository } from "../acuerdos.repository";
import type { FirmasRepository } from "../firmas.repository";
import { DocusignWebhookService } from "./docusign-webhook.service";

const acuerdoRow = {
  id: "acuerdo-1",
  caso_id: "caso-1",
  contenido: { contenido: { meetingPoint: [], narrative: null } },
};

describe("DocusignWebhookService", () => {
  function buildService(overrides?: {
    findByEnvelopeAndEmail?: jest.Mock;
    updateStatus?: jest.Mock;
    allSignedForAcuerdo?: jest.Mock;
    markFirmado?: jest.Mock;
    findById?: jest.Mock;
    generateForAcuerdo?: jest.Mock;
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
      findById: overrides?.findById ?? jest.fn().mockResolvedValue(acuerdoRow),
    } as unknown as AcuerdosRepository;
    const tareasService = {
      generateForAcuerdo:
        overrides?.generateForAcuerdo ?? jest.fn().mockResolvedValue([]),
    } as unknown as TareasService;
    return {
      service: new DocusignWebhookService(
        firmasRepository,
        acuerdosRepository,
        tareasService,
      ),
      firmasRepository,
      acuerdosRepository,
      tareasService,
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

  it("is idempotent: a duplicate event already at the target status mutates neither the firma nor the acuerdo", async () => {
    const findByEnvelopeAndEmail = jest.fn().mockResolvedValue({
      id: "firma-1",
      acuerdo_id: "acuerdo-1",
      docusign_status: "signed",
    });
    const updateStatus = jest.fn();
    const markFirmado = jest.fn();
    const generateForAcuerdo = jest.fn();
    const { service } = buildService({
      findByEnvelopeAndEmail,
      updateStatus,
      allSignedForAcuerdo: jest.fn().mockResolvedValue(false),
      markFirmado,
      generateForAcuerdo,
    });

    await service.applyEvent({
      envelopeId: "envelope-1",
      recipientEmail: "a@example.com",
      status: "signed",
      event: "recipient-completed",
    });

    expect(updateStatus).not.toHaveBeenCalled();
    expect(markFirmado).not.toHaveBeenCalled();
    expect(generateForAcuerdo).not.toHaveBeenCalled();
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

  it("generates the RN-14 accionables once the acuerdo is fully signed", async () => {
    const findByEnvelopeAndEmail = jest.fn().mockResolvedValue({
      id: "firma-1",
      acuerdo_id: "acuerdo-1",
      docusign_status: "pending",
    });
    const generateForAcuerdo = jest.fn().mockResolvedValue([]);
    const { service } = buildService({
      findByEnvelopeAndEmail,
      updateStatus: jest.fn().mockResolvedValue(undefined),
      allSignedForAcuerdo: jest.fn().mockResolvedValue(true),
      markFirmado: jest.fn().mockResolvedValue(undefined),
      generateForAcuerdo,
    });

    await service.applyEvent({
      envelopeId: "envelope-1",
      recipientEmail: "a@example.com",
      status: "signed",
      event: "recipient-completed",
    });

    expect(generateForAcuerdo).toHaveBeenCalledWith(
      "acuerdo-1",
      "caso-1",
      acuerdoRow.contenido,
    );
  });

  it("does not generate accionables while a firma is still pending", async () => {
    const generateForAcuerdo = jest.fn();
    const { service } = buildService({
      findByEnvelopeAndEmail: jest.fn().mockResolvedValue({
        id: "firma-1",
        acuerdo_id: "acuerdo-1",
        docusign_status: "pending",
      }),
      updateStatus: jest.fn().mockResolvedValue(undefined),
      allSignedForAcuerdo: jest.fn().mockResolvedValue(false),
      generateForAcuerdo,
    });

    await service.applyEvent({
      envelopeId: "envelope-1",
      recipientEmail: "a@example.com",
      status: "signed",
      event: "recipient-completed",
    });

    expect(generateForAcuerdo).not.toHaveBeenCalled();
  });

  it("logs and swallows a generation failure so DocuSign is not asked to retry the signature", async () => {
    const errorSpy = jest.spyOn(Logger.prototype, "error").mockImplementation();
    const markFirmado = jest.fn().mockResolvedValue(undefined);
    const { service } = buildService({
      findByEnvelopeAndEmail: jest.fn().mockResolvedValue({
        id: "firma-1",
        acuerdo_id: "acuerdo-1",
        docusign_status: "pending",
      }),
      updateStatus: jest.fn().mockResolvedValue(undefined),
      allSignedForAcuerdo: jest.fn().mockResolvedValue(true),
      markFirmado,
      generateForAcuerdo: jest
        .fn()
        .mockRejectedValue(new Error("insert failed")),
    });

    await expect(
      service.applyEvent({
        envelopeId: "envelope-1",
        recipientEmail: "a@example.com",
        status: "signed",
        event: "recipient-completed",
      }),
    ).resolves.toBeUndefined();

    expect(markFirmado).toHaveBeenCalledWith("acuerdo-1");
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("acuerdo-1"),
      expect.any(Error),
    );
  });

  it("skips generation when the signed acuerdo can no longer be read", async () => {
    const generateForAcuerdo = jest.fn();
    const { service } = buildService({
      findByEnvelopeAndEmail: jest.fn().mockResolvedValue({
        id: "firma-1",
        acuerdo_id: "acuerdo-1",
        docusign_status: "pending",
      }),
      updateStatus: jest.fn().mockResolvedValue(undefined),
      allSignedForAcuerdo: jest.fn().mockResolvedValue(true),
      markFirmado: jest.fn().mockResolvedValue(undefined),
      findById: jest.fn().mockResolvedValue(undefined),
      generateForAcuerdo,
    });

    await service.applyEvent({
      envelopeId: "envelope-1",
      recipientEmail: "a@example.com",
      status: "signed",
      event: "recipient-completed",
    });

    expect(generateForAcuerdo).not.toHaveBeenCalled();
  });

  it("repairs a previously failed generation when DocuSign redelivers the same signed event", async () => {
    const generateForAcuerdo = jest.fn().mockResolvedValue([]);
    const updateStatus = jest.fn();
    const { service } = buildService({
      findByEnvelopeAndEmail: jest.fn().mockResolvedValue({
        id: "firma-1",
        acuerdo_id: "acuerdo-1",
        docusign_status: "signed",
      }),
      updateStatus,
      allSignedForAcuerdo: jest.fn().mockResolvedValue(true),
      generateForAcuerdo,
    });

    await service.applyEvent({
      envelopeId: "envelope-1",
      recipientEmail: "a@example.com",
      status: "signed",
      event: "recipient-completed",
    });

    expect(updateStatus).not.toHaveBeenCalled();
    expect(generateForAcuerdo).toHaveBeenCalledWith(
      "acuerdo-1",
      "caso-1",
      acuerdoRow.contenido,
    );
  });

  it("does not generate on a redelivered non-signed event", async () => {
    const generateForAcuerdo = jest.fn();
    const { service } = buildService({
      findByEnvelopeAndEmail: jest.fn().mockResolvedValue({
        id: "firma-1",
        acuerdo_id: "acuerdo-1",
        docusign_status: "sent",
      }),
      generateForAcuerdo,
    });

    await service.applyEvent({
      envelopeId: "envelope-1",
      recipientEmail: "a@example.com",
      status: "sent",
      event: "recipient-sent",
    });

    expect(generateForAcuerdo).not.toHaveBeenCalled();
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
