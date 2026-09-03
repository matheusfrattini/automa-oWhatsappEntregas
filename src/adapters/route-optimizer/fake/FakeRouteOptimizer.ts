import type {
  OptimizationRequest,
  OptimizedRoute,
  RouteOptimizer,
} from "../../../ports/RouteOptimizer.js";

/**
 * Provider determinístico para testes — nenhum teste depende de rede.
 */
export class FakeRouteOptimizer implements RouteOptimizer {
  private response: OptimizedRoute | undefined;
  private failWith: Error | undefined;
  private lastRequest: OptimizationRequest | undefined;

  setResponse(response: OptimizedRoute): void {
    this.response = response;
  }

  setFailure(error: Error): void {
    this.failWith = error;
  }

  getLastRequest(): OptimizationRequest | undefined {
    return this.lastRequest;
  }

  async optimize(request: OptimizationRequest): Promise<OptimizedRoute> {
    this.lastRequest = request;
    if (this.failWith) throw this.failWith;
    if (!this.response) {
      throw new Error("FakeRouteOptimizer: no response configured. Call setResponse.");
    }
    return this.response;
  }
}
