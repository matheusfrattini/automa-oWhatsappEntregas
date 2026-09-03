import type {
  OptimizationRequest,
  OptimizedRoute,
  RouteOptimizer,
} from "../../../ports/RouteOptimizer.js";
import { RouteOptimizationIncompleteError } from "../../../core/errors.js";
import { requestJson, type HttpClientOptions } from "../../http/httpClient.js";

/**
 * Formato confirmado em:
 * - VROOM API.md (https://github.com/VROOM-Project/vroom/blob/master/docs/API.md):
 *   jobs[].id é inteiro; vehicles[].start/end são [lon,lat]; routes[].steps[] tem
 *   distance/duration CUMULATIVOS desde o início da rota (não por trecho).
 * - openrouteservice-py optimization.py (wrapper oficial ORS): POST /optimization,
 *   body { jobs, vehicles, options: { g: <bool> } }.
 */
interface OrsOptimizationStep {
  type: "start" | "job" | "end" | "break";
  job?: number;
  distance?: number;
  duration?: number;
}

interface OrsOptimizationRoute {
  vehicle: number;
  distance: number;
  duration: number;
  steps: OrsOptimizationStep[];
}

interface OrsOptimizationResponse {
  code: number;
  routes: OrsOptimizationRoute[];
  unassigned: Array<{ id: number }>;
}

export interface OrsOptimizationConfig {
  apiKey: string;
  baseUrl: string;
  profile?: string;
}

const VEHICLE_ID = 1;

export class OrsRouteOptimizer implements RouteOptimizer {
  constructor(
    private readonly config: OrsOptimizationConfig,
    private readonly httpOptions: HttpClientOptions = {},
  ) {}

  async optimize(request: OptimizationRequest): Promise<OptimizedRoute> {
    // VROOM exige job.id numérico — mapeamos id de negócio (string) <-> índice numérico.
    const idByNumericId = new Map<number, string>();
    request.deliveries.forEach((delivery, index) => {
      idByNumericId.set(index + 1, delivery.id);
    });

    const body = {
      jobs: request.deliveries.map((delivery, index) => ({
        id: index + 1,
        location: [delivery.location.lon, delivery.location.lat],
      })),
      vehicles: [
        {
          id: VEHICLE_ID,
          profile: this.config.profile ?? "driving-car",
          start: [request.depot.lon, request.depot.lat],
          ...(request.roundTrip ? { end: [request.depot.lon, request.depot.lat] } : {}),
        },
      ],
    };

    const url = `${this.config.baseUrl}/optimization`;
    const data = await requestJson<OrsOptimizationResponse>(
      url,
      {
        method: "POST",
        headers: {
          Authorization: this.config.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
      this.httpOptions,
    );

    if (data.unassigned.length > 0) {
      const unassignedOrderIds = data.unassigned.map(
        (u) => idByNumericId.get(u.id) ?? `unknown-${u.id}`,
      );
      throw new RouteOptimizationIncompleteError(unassignedOrderIds);
    }

    const route = data.routes[0];
    if (!route) {
      throw new Error("ORS optimization response missing routes[0]");
    }

    const jobSteps = route.steps.filter((step) => step.type === "job");
    const stops = jobSteps.map((step, index) => {
      const deliveryId = idByNumericId.get(step.job!);
      if (!deliveryId) {
        throw new Error(`ORS optimization returned unknown job id: ${step.job}`);
      }
      return {
        deliveryId,
        sequence: index + 1,
        distanceFromStartMeters: step.distance ?? 0,
        durationFromStartSeconds: step.duration ?? 0,
      };
    });

    return {
      stops,
      totalDistanceMeters: route.distance,
      totalDurationSeconds: route.duration,
    };
  }
}
