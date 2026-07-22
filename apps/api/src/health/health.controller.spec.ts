import { Test } from "@nestjs/testing";
import { HealthController } from "./health.controller";

describe("HealthController", () => {
  it("returns status ok", async () => {
    const moduleReference = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();

    const healthController = moduleReference.get(HealthController);

    expect(healthController.getHealth()).toEqual({ status: "ok" });
  });
});
