import { HttpMercadoPagoClient } from "./http-mercado-pago-client";

const preferencesUrl = "https://api.mercadopago.com/checkout/preferences";
const paymentsUrl = "https://api.mercadopago.com/v1/payments";

function buildClient(): HttpMercadoPagoClient {
  return new HttpMercadoPagoClient({
    mpAccessToken: "mp-access-token",
  } as never);
}

describe("HttpMercadoPagoClient", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("createPreference", () => {
    it("posts a preference request built from the plan price with a Bearer token", async () => {
      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            id: "preference-1",
            init_point: "https://mp.example.com/checkout/preference-1",
          }),
      });
      jest.spyOn(globalThis, "fetch").mockImplementation(fetchMock as never);
      const client = buildClient();

      const result = await client.createPreference({
        suscripcionId: "sus-1",
        planNombre: "plus",
        precio: 19.99,
      });

      expect(result).toEqual({
        id: "preference-1",
        initPoint: "https://mp.example.com/checkout/preference-1",
      });
      expect(fetchMock).toHaveBeenCalledWith(
        preferencesUrl,
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer mp-access-token",
            "Content-Type": "application/json",
          }),
        }),
      );
      const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body as string);
      expect(requestBody).toEqual(
        expect.objectContaining({
          external_reference: "sus-1",
          items: [
            expect.objectContaining({ title: "plus", unit_price: 19.99 }),
          ],
        }),
      );
    });

    it("bounds the request with an application-level abort timeout", async () => {
      const timeoutSpy = jest.spyOn(AbortSignal, "timeout");
      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({ id: "preference-1", init_point: "https://x" }),
      });
      jest.spyOn(globalThis, "fetch").mockImplementation(fetchMock as never);
      const client = buildClient();

      await client.createPreference({
        suscripcionId: "sus-1",
        planNombre: "plus",
        precio: 19.99,
      });

      expect(timeoutSpy).toHaveBeenCalled();
      expect(fetchMock).toHaveBeenCalledWith(
        preferencesUrl,
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
    });

    it("throws explicitly when Mercado Pago responds with a non-ok status", async () => {
      const fetchMock = jest.fn().mockResolvedValue({
        ok: false,
        status: 502,
        json: () => Promise.resolve({}),
      });
      jest.spyOn(globalThis, "fetch").mockImplementation(fetchMock as never);
      const client = buildClient();

      await expect(
        client.createPreference({
          suscripcionId: "sus-1",
          planNombre: "plus",
          precio: 19.99,
        }),
      ).rejects.toThrow(
        "Mercado Pago preference creation failed with status 502",
      );
    });

    it("throws explicitly when the response has no init_point", async () => {
      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: "preference-1" }),
      });
      jest.spyOn(globalThis, "fetch").mockImplementation(fetchMock as never);
      const client = buildClient();

      await expect(
        client.createPreference({
          suscripcionId: "sus-1",
          planNombre: "plus",
          precio: 19.99,
        }),
      ).rejects.toThrow("Mercado Pago response did not include an init_point");
    });
  });

  describe("getPayment", () => {
    it("fetches a payment by id with a Bearer token and maps the response", async () => {
      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 123456,
            status: "approved",
            external_reference: "sus-1",
            transaction_amount: 19.99,
          }),
      });
      jest.spyOn(globalThis, "fetch").mockImplementation(fetchMock as never);
      const client = buildClient();

      const result = await client.getPayment("123456");

      expect(result).toEqual({
        id: "123456",
        status: "approved",
        externalReference: "sus-1",
        transactionAmount: 19.99,
      });
      expect(fetchMock).toHaveBeenCalledWith(
        `${paymentsUrl}/123456`,
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({
            Authorization: "Bearer mp-access-token",
          }),
        }),
      );
    });

    it("maps a missing external_reference to null", async () => {
      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 123456,
            status: "pending",
            transaction_amount: 19.99,
          }),
      });
      jest.spyOn(globalThis, "fetch").mockImplementation(fetchMock as never);
      const client = buildClient();

      const result = await client.getPayment("123456");

      expect(result.externalReference).toBeNull();
    });

    it("throws explicitly when Mercado Pago responds with a non-ok status", async () => {
      const fetchMock = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: () => Promise.resolve({}),
      });
      jest.spyOn(globalThis, "fetch").mockImplementation(fetchMock as never);
      const client = buildClient();

      await expect(client.getPayment("123456")).rejects.toThrow(
        "Mercado Pago payment lookup failed with status 404",
      );
    });

    it("rejects cleanly when fetch fails with a network error", async () => {
      const fetchMock = jest
        .fn()
        .mockRejectedValue(new TypeError("fetch failed"));
      jest.spyOn(globalThis, "fetch").mockImplementation(fetchMock as never);
      const client = buildClient();

      await expect(client.getPayment("123456")).rejects.toThrow("fetch failed");
    });
  });
});
