import { describe, expect, it, vi } from "vitest";
import { HttpRequestError, requestJson } from "../../src/adapters/http/httpClient.js";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

describe("requestJson", () => {
  it("retorna o JSON quando a resposta é ok", async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(200, { ok: true }));
    const result = await requestJson<{ ok: boolean }>("https://example.com", {}, { fetchFn });
    expect(result).toEqual({ ok: true });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("retenta em erro 500 e sucede na segunda tentativa", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(new Response("boom", { status: 500 }))
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }));
    const sleepFn = vi.fn().mockResolvedValue(undefined);

    const result = await requestJson<{ ok: boolean }>(
      "https://example.com",
      {},
      { fetchFn, sleepFn, retries: 2 },
    );

    expect(result).toEqual({ ok: true });
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(sleepFn).toHaveBeenCalledTimes(1);
  });

  it("desiste após esgotar as tentativas em erro 500 persistente", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response("boom", { status: 500 }));
    const sleepFn = vi.fn().mockResolvedValue(undefined);

    await expect(
      requestJson("https://example.com", {}, { fetchFn, sleepFn, retries: 2 }),
    ).rejects.toThrow(HttpRequestError);
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });

  it("não retenta em erro 4xx (exceto 429)", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response("bad request", { status: 400 }));
    const sleepFn = vi.fn().mockResolvedValue(undefined);

    await expect(
      requestJson("https://example.com", {}, { fetchFn, sleepFn, retries: 2 }),
    ).rejects.toThrow(HttpRequestError);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("retenta em 429", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(new Response("slow down", { status: 429 }))
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }));
    const sleepFn = vi.fn().mockResolvedValue(undefined);

    const result = await requestJson<{ ok: boolean }>(
      "https://example.com",
      {},
      { fetchFn, sleepFn, retries: 2 },
    );
    expect(result).toEqual({ ok: true });
  });

  it("retenta em falha de rede (fetch rejeita) e eventualmente propaga o erro", async () => {
    const networkError = new Error("network down");
    const fetchFn = vi.fn().mockRejectedValue(networkError);
    const sleepFn = vi.fn().mockResolvedValue(undefined);

    await expect(
      requestJson("https://example.com", {}, { fetchFn, sleepFn, retries: 1 }),
    ).rejects.toThrow("network down");
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });
});
