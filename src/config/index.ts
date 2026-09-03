import "dotenv/config";

export interface DeliveryWindowConfig {
  id: "12h" | "16h";
  /** Horário de saída da leva, formato HH:mm, hora local do timezone configurado. */
  time: string;
  /** Horário de corte: pedidos confirmados até este horário entram nesta leva. */
  cutoff: string;
}

export interface AppConfig {
  timezone: string;
  shipping: {
    baseFeeCents: number;
    pricePerKmCents: number;
    maxDeliveryRadiusKm: number;
  };
  store: {
    address: string;
    lat: number;
    lon: number;
  };
  windows: DeliveryWindowConfig[];
  messagingAdapter: string;
  ors: {
    apiKey: string;
    baseUrl: string;
    profile: string;
    geocodingBoundaryCountry: string;
    timeoutMs: number;
    retries: number;
  };
  address: {
    minConfidence: number;
    maxCandidates: number;
  };
}

function requireEnvNumber(env: NodeJS.ProcessEnv, name: string, fallback?: number): number {
  const raw = env[name];
  if (raw === undefined || raw === "") {
    if (fallback !== undefined) return fallback;
    throw new Error(`Missing required env var: ${name}`);
  }
  const value = Number(raw);
  if (Number.isNaN(value)) {
    throw new Error(`Env var ${name} must be a number, got "${raw}"`);
  }
  return value;
}

function requireEnvString(env: NodeJS.ProcessEnv, name: string, fallback?: string): string {
  const raw = env[name];
  if (raw === undefined || raw === "") {
    if (fallback !== undefined) return fallback;
    throw new Error(`Missing required env var: ${name}`);
  }
  return raw;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    timezone: env.TIMEZONE ?? "America/Sao_Paulo",
    shipping: {
      baseFeeCents: requireEnvNumber(env, "SHIPPING_BASE_FEE_CENTS"),
      pricePerKmCents: requireEnvNumber(env, "SHIPPING_PRICE_PER_KM_CENTS"),
      maxDeliveryRadiusKm: requireEnvNumber(env, "SHIPPING_MAX_DELIVERY_RADIUS_KM"),
    },
    store: {
      address: requireEnvString(env, "STORE_ADDRESS"),
      lat: requireEnvNumber(env, "STORE_LAT"),
      lon: requireEnvNumber(env, "STORE_LON"),
    },
    windows: [
      {
        id: "12h",
        time: requireEnvString(env, "WINDOW_12H_TIME", "12:00"),
        cutoff: requireEnvString(env, "WINDOW_12H_CUTOFF", "11:40"),
      },
      {
        id: "16h",
        time: requireEnvString(env, "WINDOW_16H_TIME", "16:00"),
        cutoff: requireEnvString(env, "WINDOW_16H_CUTOFF", "15:40"),
      },
    ],
    messagingAdapter: env.MESSAGING_ADAPTER ?? "simulator-cli",
    ors: {
      apiKey: env.ORS_API_KEY ?? "",
      baseUrl: env.ORS_BASE_URL ?? "https://api.openrouteservice.org",
      profile: env.ORS_PROFILE ?? "driving-car",
      geocodingBoundaryCountry: env.ORS_GEOCODING_BOUNDARY_COUNTRY ?? "BR",
      timeoutMs: requireEnvNumber(env, "ORS_TIMEOUT_MS", 5000),
      retries: requireEnvNumber(env, "ORS_RETRIES", 2),
    },
    address: {
      minConfidence: requireEnvNumber(env, "ADDRESS_MIN_CONFIDENCE", 0.4),
      maxCandidates: requireEnvNumber(env, "ADDRESS_MAX_CANDIDATES", 3),
    },
  };
}
