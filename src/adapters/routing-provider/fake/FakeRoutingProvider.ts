import type { RouteDistance, RoutingProvider } from "../../../ports/RoutingProvider.js";
import type { Coordinates } from "../../../core/types.js";

/**
 * Provider determinístico para testes — nenhum teste depende de rede.
 * Por padrão, retorna uma distância fixa configurável; pode ser configurado
 * para lançar erro (simular falha da API real) ou responder por par de coordenadas.
 */
export class FakeRoutingProvider implements RoutingProvider {
  private failWith: Error | undefined;
  private fixedResponse: RouteDistance | undefined;
  private responsesByKey = new Map<string, RouteDistance>();

  setFixedResponse(response: RouteDistance): void {
    this.fixedResponse = response;
  }

  setResponseFor(origin: Coordinates, destination: Coordinates, response: RouteDistance): void {
    this.responsesByKey.set(this.keyFor(origin, destination), response);
  }

  setFailure(error: Error): void {
    this.failWith = error;
  }

  clearFailure(): void {
    this.failWith = undefined;
  }

  private keyFor(origin: Coordinates, destination: Coordinates): string {
    return `${origin.lat},${origin.lon}->${destination.lat},${destination.lon}`;
  }

  async getRouteDistance(origin: Coordinates, destination: Coordinates): Promise<RouteDistance> {
    if (this.failWith) throw this.failWith;

    const specific = this.responsesByKey.get(this.keyFor(origin, destination));
    if (specific) return specific;

    if (this.fixedResponse) return this.fixedResponse;

    throw new Error(
      "FakeRoutingProvider: no response configured. Call setFixedResponse or setResponseFor.",
    );
  }
}
