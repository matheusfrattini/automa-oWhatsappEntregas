import { randomUUID } from "node:crypto";
import { composeApp } from "../app/composeApp.js";
import { assignDeliveryWindow } from "../core/delivery-window/assignWindow.js";
import { buildDeliveryManifest } from "../core/routing/buildDeliveryManifest.js";
import { calculateShipping } from "../core/shipping/calculateShipping.js";
import type { Order } from "../core/orders/types.js";
import type { OrderForRouting } from "../core/routing/types.js";

/**
 * Popula alguns pedidos de exemplo na leva atual e imprime a rota otimizada
 * do dia, para ver o fluxo inteiro funcionando sem digitar pedidos manualmente
 * no simulador.
 */
async function main(): Promise<void> {
  const app = composeApp();
  const catalog = await app.catalogRepository.listAvailable();
  const paoFrances = catalog.find((i) => i.id === "pao-frances")!;
  const leite = catalog.find((i) => i.id === "leite-integral")!;
  const ovos = catalog.find((i) => i.id === "ovos-brancos")!;
  const queijo = catalog.find((i) => i.id === "queijo-minas")!;
  const bolo = catalog.find((i) => i.id === "bolo-fuba")!;

  const now = app.clock.now();
  const window = assignDeliveryWindow(now, app.config);

  const exampleOrders: Array<{ customerId: string; addressLabel: string; coordinates: { lat: number; lon: number }; items: Array<{ item: typeof paoFrances; quantity: number }> }> = [
    {
      customerId: "seed-cliente-1",
      addressLabel: "Rua Augusta, 1200 - Consolação, São Paulo - SP (endereço de exemplo)",
      coordinates: { lat: app.config.store.lat + 0.01, lon: app.config.store.lon + 0.008 },
      items: [{ item: paoFrances, quantity: 6 }, { item: leite, quantity: 2 }],
    },
    {
      customerId: "seed-cliente-2",
      addressLabel: "Alameda Santos, 800 - Jardim Paulista, São Paulo - SP (endereço de exemplo)",
      coordinates: { lat: app.config.store.lat - 0.015, lon: app.config.store.lon + 0.012 },
      items: [{ item: ovos, quantity: 1 }, { item: queijo, quantity: 1 }],
    },
    {
      customerId: "seed-cliente-3",
      addressLabel: "Rua Oscar Freire, 500 - Jardins, São Paulo - SP (endereço de exemplo)",
      coordinates: { lat: app.config.store.lat + 0.005, lon: app.config.store.lon - 0.02 },
      items: [{ item: bolo, quantity: 2 }, { item: leite, quantity: 1 }],
    },
  ];

  const savedOrders: Order[] = [];

  for (const example of exampleOrders) {
    const lines = example.items.map(({ item, quantity }) => ({
      itemId: item.id,
      name: item.name,
      unit: item.unit,
      quantity,
      unitPriceCents: item.priceCents,
      lineTotalCents: item.priceCents * quantity,
    }));
    const subtotalCents = lines.reduce((sum, l) => sum + l.lineTotalCents, 0);

    let shippingCents: number;
    let distanceMeters: number;
    try {
      const quote = await calculateShipping(
        app.routing,
        { lat: app.config.store.lat, lon: app.config.store.lon },
        example.coordinates,
        app.config.shipping,
      );
      shippingCents = quote.shippingCents;
      distanceMeters = quote.distanceMeters;
    } catch (err) {
      console.error(`Falha ao calcular frete para ${example.customerId}, pulando:`, err);
      continue;
    }

    const order: Order = {
      id: randomUUID(),
      customerId: example.customerId,
      items: lines,
      subtotalCents,
      shippingCents,
      totalCents: subtotalCents + shippingCents,
      addressLabel: example.addressLabel,
      addressCoordinates: example.coordinates,
      distanceMeters,
      window,
      confirmedAt: now.toISOString(),
    };

    await app.orderRepository.save(order);
    savedOrders.push(order);
    console.log(`Pedido de exemplo criado: ${order.id} (${example.customerId}) — total ${(order.totalCents / 100).toFixed(2)} BRL`);
  }

  console.log(`\nLeva: ${window.date} - ${window.slot}\n`);

  const ordersForRouting: OrderForRouting[] = savedOrders.map((order) => ({
    orderId: order.id,
    addressLabel: order.addressLabel,
    coordinates: order.addressCoordinates,
    items: order.items.map((line) => ({ name: line.name, quantity: line.quantity, unit: line.unit })),
  }));

  if (ordersForRouting.length === 0) {
    console.log("Nenhum pedido de exemplo pôde ser roteirizado.");
    return;
  }

  const manifest = await buildDeliveryManifest(
    ordersForRouting,
    app.routeOptimizer,
    { lat: app.config.store.lat, lon: app.config.store.lon },
  );

  console.log("Manifesto de entrega (rota otimizada):\n");
  for (const stop of manifest.stops) {
    console.log(`${stop.sequence}. ${stop.addressLabel}`);
    for (const item of stop.items) {
      console.log(`   - ${item.quantity}x ${item.name}`);
    }
    console.log(
      `   Trecho: ${(stop.distanceFromPrevMeters / 1000).toFixed(2)} km, ${Math.round(stop.durationFromPrevSeconds / 60)} min`,
    );
  }
  console.log(
    `\nTotal: ${(manifest.totalDistanceMeters / 1000).toFixed(2)} km, ${Math.round(manifest.totalDurationSeconds / 60)} min`,
  );
  console.log(`Navegação: ${manifest.navigationLink}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
