import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig, type AppConfig } from "../config/index.js";
import { JsonCatalogRepository } from "../adapters/persistence/json/JsonCatalogRepository.js";
import { OrsGeocodingProvider } from "../adapters/geocoding/ors/OrsGeocodingProvider.js";
import { OfflineGeocodingProvider } from "../adapters/geocoding/offline/OfflineGeocodingProvider.js";
import { OrsRoutingProvider } from "../adapters/routing-provider/ors/OrsRoutingProvider.js";
import { OfflineRoutingProvider } from "../adapters/routing-provider/offline/OfflineRoutingProvider.js";
import { OrsRouteOptimizer } from "../adapters/route-optimizer/ors/OrsRouteOptimizer.js";
import { OfflineRouteOptimizer } from "../adapters/route-optimizer/offline/OfflineRouteOptimizer.js";
import { RuleBasedIntentParser } from "../adapters/intent-parser/rule-based/RuleBasedIntentParser.js";
import { SystemClock } from "../adapters/clock/SystemClock.js";
import { openDatabase } from "../adapters/persistence/sqlite/openDatabase.js";
import { SqliteOrderRepository } from "../adapters/persistence/sqlite/SqliteOrderRepository.js";
import { SqliteConversationRepository } from "../adapters/persistence/sqlite/SqliteConversationRepository.js";
import { logger } from "../adapters/logging/logger.js";
import type { CatalogRepository } from "../ports/CatalogRepository.js";
import type { GeocodingProvider } from "../ports/GeocodingProvider.js";
import type { RoutingProvider } from "../ports/RoutingProvider.js";
import type { RouteOptimizer } from "../ports/RouteOptimizer.js";
import type { OrderRepository } from "../ports/OrderRepository.js";
import type { ConversationRepository } from "../ports/ConversationRepository.js";
import type { IntentParser } from "../ports/IntentParser.js";
import type { Clock } from "../ports/Clock.js";

export interface App {
  config: AppConfig;
  catalogRepository: CatalogRepository;
  geocoding: GeocodingProvider;
  routing: RoutingProvider;
  routeOptimizer: RouteOptimizer;
  orderRepository: OrderRepository;
  conversationRepository: ConversationRepository;
  intentParser: IntentParser;
  clock: Clock;
}

/**
 * Composition root: único lugar do sistema que conhece tanto o núcleo quanto
 * os adapters concretos. Decide real (ORS) vs offline (simulado) com base em
 * ORS_API_KEY estar configurada — nunca no meio do núcleo.
 */
export function composeApp(): App {
  const config = loadConfig();

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const catalogPath = path.resolve(__dirname, "../../data/catalog.json");
  const catalogRepository = new JsonCatalogRepository(catalogPath);

  const hasOrsKey = config.ors.apiKey.length > 0;
  if (!hasOrsKey) {
    logger.warn(
      "ORS_API_KEY não configurada — usando geocoding/roteirização/otimização OFFLINE (aproximados por linha reta). " +
        "Não use isso como referência real de frete ou rota. Configure ORS_API_KEY no .env para usar o ORS de verdade.",
    );
  }

  const httpOptions = { timeoutMs: config.ors.timeoutMs, retries: config.ors.retries };

  const geocoding: GeocodingProvider = hasOrsKey
    ? new OrsGeocodingProvider(
        {
          apiKey: config.ors.apiKey,
          baseUrl: config.ors.baseUrl,
          boundaryCountry: config.ors.geocodingBoundaryCountry,
        },
        httpOptions,
      )
    : new OfflineGeocodingProvider({ lat: config.store.lat, lon: config.store.lon });

  const routing: RoutingProvider = hasOrsKey
    ? new OrsRoutingProvider(
        { apiKey: config.ors.apiKey, baseUrl: config.ors.baseUrl, profile: config.ors.profile },
        httpOptions,
      )
    : new OfflineRoutingProvider();

  const routeOptimizer: RouteOptimizer = hasOrsKey
    ? new OrsRouteOptimizer(
        { apiKey: config.ors.apiKey, baseUrl: config.ors.baseUrl, profile: config.ors.profile },
        httpOptions,
      )
    : new OfflineRouteOptimizer();

  const db = openDatabase(config.dbPath);
  const orderRepository = new SqliteOrderRepository(db);
  const conversationRepository = new SqliteConversationRepository(db);

  return {
    config,
    catalogRepository,
    geocoding,
    routing,
    routeOptimizer,
    orderRepository,
    conversationRepository,
    intentParser: new RuleBasedIntentParser(),
    clock: new SystemClock(),
  };
}
