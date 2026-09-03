import type { IncomingMessage, MessagingChannel } from "../../../ports/MessagingChannel.js";

/**
 * Canal de simulação via HTTP. Implementa só a porta MessagingChannel — o
 * servidor HTTP (server.ts) é quem decide como expor isso como API REST.
 *
 * Como HTTP é request/response e a porta é assíncrona/"empurrada", usamos um
 * buffer por cliente: sendMessage() enfileira, e receiveAndCollect() processa
 * uma mensagem e devolve tudo que foi enfileirado durante o processamento.
 * Isso é um detalhe deste adapter — não faz parte da porta MessagingChannel.
 */
export class WebMessagingChannel implements MessagingChannel {
  private handler: ((message: IncomingMessage) => Promise<void>) | undefined;
  private readonly outbox = new Map<string, string[]>();

  onMessage(handler: (message: IncomingMessage) => Promise<void>): void {
    this.handler = handler;
  }

  async sendMessage(recipientId: string, text: string): Promise<void> {
    const queue = this.outbox.get(recipientId) ?? [];
    queue.push(text);
    this.outbox.set(recipientId, queue);
  }

  async receiveAndCollect(senderId: string, text: string): Promise<string[]> {
    if (!this.handler) throw new Error("WebMessagingChannel: no handler registered");
    this.outbox.delete(senderId);
    await this.handler({ senderId, text, timestamp: new Date() });
    const replies = this.outbox.get(senderId) ?? [];
    this.outbox.delete(senderId);
    return replies;
  }
}
