import { describe, expect, it } from "vitest";
import { assignDeliveryWindow } from "../../src/core/delivery-window/assignWindow.js";
import type { DeliveryWindowConfig } from "../../src/config/index.js";

const windows: DeliveryWindowConfig[] = [
  { id: "12h", time: "12:00", cutoff: "11:40" },
  { id: "16h", time: "16:00", cutoff: "15:40" },
];
const config = { timezone: "America/Sao_Paulo", windows };

// Horários em UTC que correspondem aos horários locais de São Paulo (UTC-3, sem horário de verão).
function spTime(dateISO: string, hh: number, mm: number, ss = 0): Date {
  return new Date(`${dateISO}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}-03:00`);
}

describe("assignDeliveryWindow", () => {
  it("11h39 entra na leva das 12h do mesmo dia", () => {
    const result = assignDeliveryWindow(spTime("2026-09-03", 11, 39), config);
    expect(result).toEqual({ date: "2026-09-03", slot: "12h" });
  });

  it("11h40 (exatamente no corte) ainda entra na leva das 12h — corte inclusivo", () => {
    const result = assignDeliveryWindow(spTime("2026-09-03", 11, 40, 0), config);
    expect(result).toEqual({ date: "2026-09-03", slot: "12h" });
  });

  it("11h41 já não entra mais na leva das 12h — vai para a leva das 16h", () => {
    const result = assignDeliveryWindow(spTime("2026-09-03", 11, 41), config);
    expect(result).toEqual({ date: "2026-09-03", slot: "16h" });
  });

  it("15h39 entra na leva das 16h do mesmo dia", () => {
    const result = assignDeliveryWindow(spTime("2026-09-03", 15, 39), config);
    expect(result).toEqual({ date: "2026-09-03", slot: "16h" });
  });

  it("15h40 (exatamente no corte) ainda entra na leva das 16h — corte inclusivo", () => {
    const result = assignDeliveryWindow(spTime("2026-09-03", 15, 40, 0), config);
    expect(result).toEqual({ date: "2026-09-03", slot: "16h" });
  });

  it("15h41 já não entra mais na leva das 16h — vai para a leva das 12h do dia seguinte", () => {
    const result = assignDeliveryWindow(spTime("2026-09-03", 15, 41), config);
    expect(result).toEqual({ date: "2026-09-04", slot: "12h" });
  });

  it("madrugada (ex: 02h00) entra na leva das 12h do mesmo dia", () => {
    const result = assignDeliveryWindow(spTime("2026-09-03", 2, 0), config);
    expect(result).toEqual({ date: "2026-09-03", slot: "12h" });
  });
});
