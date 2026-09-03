import type { GeocodingProvider } from "../../ports/GeocodingProvider.js";
import { GeocodingUnavailableError } from "../errors.js";
import type { AddressResolution } from "./types.js";

export interface AddressResolutionConfig {
  /** Candidatos abaixo desta confiança (0..1) são descartados por não serem plausíveis. */
  minConfidence: number;
  /** Máximo de opções apresentadas ao cliente quando há mais de um candidato plausível. */
  maxCandidates: number;
}

/**
 * Geocodifica um endereço em texto livre e retorna candidatos plausíveis.
 * Não decide sozinho qual é o endereço certo — isso exige confirmação explícita
 * do cliente (camada de conversa). Se a chamada ao provider falhar, propaga
 * GeocodingUnavailableError (nunca inventa coordenada).
 */
export async function resolveAddress(
  geocoding: GeocodingProvider,
  text: string,
  config: AddressResolutionConfig,
): Promise<AddressResolution> {
  let candidates;
  try {
    candidates = await geocoding.search(text);
  } catch (cause) {
    throw new GeocodingUnavailableError(cause);
  }

  const plausible = candidates
    .filter((c) => c.confidence >= config.minConfidence)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, config.maxCandidates);

  if (plausible.length === 0) {
    return { status: "not_found" };
  }

  return { status: "candidates", candidates: plausible };
}
