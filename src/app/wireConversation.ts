import { randomUUID } from "node:crypto";
import type { IncomingMessage, MessagingChannel } from "../ports/MessagingChannel.js";
import { handleMessage, type ConversationDeps } from "../core/conversation/handleMessage.js";
import { createConversation } from "../core/conversation/types.js";
import { logger } from "../adapters/logging/logger.js";
import type { App } from "./composeApp.js";

/**
 * Serializa o processamento por cliente: sem isso, duas mensagens da mesma
 * conversa chegando quase juntas (ex: um adapter que não espera a anterior
 * terminar antes de entregar a próxima) fariam um "get" ler o estado antes do
 * "save" da mensagem anterior terminar, perdendo carrinho/estado no meio do
 * caminho. Mensagens de clientes diferentes continuam correndo em paralelo.
 */
function createPerCustomerQueue() {
  const queues = new Map<string, Promise<unknown>>();
  return function withCustomerLock<T>(customerId: string, task: () => Promise<T>): Promise<T> {
    const previous = queues.get(customerId) ?? Promise.resolve();
    const next = previous.then(task, task);
    queues.set(
      customerId,
      next.catch(() => undefined),
    );
    return next;
  };
}

/**
 * Liga um MessagingChannel (qualquer adapter) ao núcleo de conversa. É o único
 * lugar que conhece tanto o canal quanto a orquestração — o canal não sabe
 * nada sobre carrinho/pedido, e o núcleo não sabe nada sobre o canal.
 */
export function wireConversationChannel(channel: MessagingChannel, app: App): void {
  const withCustomerLock = createPerCustomerQueue();

  channel.onMessage((message) => withCustomerLock(message.senderId, () => processMessage(message)));

  async function processMessage(message: IncomingMessage): Promise<void> {
    try {
      const existing = await app.conversationRepository.get(message.senderId);
      const context = existing ?? createConversation(message.senderId);
      const catalog = await app.catalogRepository.listAll();

      const deps: ConversationDeps = {
        intentParser: app.intentParser,
        geocoding: app.geocoding,
        routing: app.routing,
        orderRepository: app.orderRepository,
        clock: app.clock,
        config: app.config,
        catalog,
        generateOrderId: () => randomUUID(),
      };

      const result = await handleMessage(context, message.text, deps);
      await app.conversationRepository.save(result.context);

      for (const reply of result.replies) {
        await channel.sendMessage(message.senderId, reply);
      }
    } catch (err) {
      logger.error("Falha inesperada ao processar mensagem", {
        customerId: message.senderId,
        error: err instanceof Error ? err.message : String(err),
      });
      await channel.sendMessage(
        message.senderId,
        "Tive um problema técnico aqui. Vou chamar um atendente para te ajudar.",
      );
    }
  }
}
