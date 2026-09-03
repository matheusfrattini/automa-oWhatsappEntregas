import { DateTime } from "luxon";
import type { DeliveryWindowConfig } from "../../config/index.js";
import type { DeliveryWindowAssignment } from "./types.js";

function atTimeOnSameDay(reference: DateTime, hhmm: string): DateTime {
  const [hour, minute] = hhmm.split(":").map(Number);
  return reference.set({ hour, minute, second: 0, millisecond: 0 });
}

/**
 * Decide em qual leva um pedido confirmado em `confirmedAt` entra, com base nos
 * horários de corte configurados. Corte é inclusivo: confirmar exatamente no
 * horário de corte ainda entra naquela leva.
 *
 * Regra (conforme confirmado): corte da leva das 12h é 11h40, corte da leva das
 * 16h é 15h40. Depois das 15h40, o pedido entra na leva das 12h do dia seguinte.
 */
export function assignDeliveryWindow(
  confirmedAt: Date,
  config: { timezone: string; windows: DeliveryWindowConfig[] },
): DeliveryWindowAssignment {
  const zoned = DateTime.fromJSDate(confirmedAt, { zone: config.timezone });

  const window12h = config.windows.find((w) => w.id === "12h");
  const window16h = config.windows.find((w) => w.id === "16h");
  if (!window12h || !window16h) {
    throw new Error("Delivery window config must include both 12h and 16h windows");
  }

  const cutoff12h = atTimeOnSameDay(zoned, window12h.cutoff);
  const cutoff16h = atTimeOnSameDay(zoned, window16h.cutoff);

  if (zoned <= cutoff12h) {
    return { date: zoned.toISODate()!, slot: "12h" };
  }
  if (zoned <= cutoff16h) {
    return { date: zoned.toISODate()!, slot: "16h" };
  }

  const nextDay = zoned.plus({ days: 1 });
  return { date: nextDay.toISODate()!, slot: "12h" };
}
