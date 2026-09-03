import type { GeocodingProvider } from "../../../ports/GeocodingProvider.js";
import type { GeocodeCandidate } from "../../../core/address/types.js";

/**
 * Provider determinístico para testes — nenhum teste depende de rede.
 */
export class FakeGeocodingProvider implements GeocodingProvider {
  private responses = new Map<string, GeocodeCandidate[]>();
  private failWith: Error | undefined;

  private key(text: string): string {
    return text.trim().toLowerCase();
  }

  setResponseFor(text: string, candidates: GeocodeCandidate[]): void {
    this.responses.set(this.key(text), candidates);
  }

  setFailure(error: Error): void {
    this.failWith = error;
  }

  async search(text: string): Promise<GeocodeCandidate[]> {
    if (this.failWith) throw this.failWith;
    return this.responses.get(this.key(text)) ?? [];
  }
}
