import type { IncomingMessage, MessagingChannel } from "../../../ports/MessagingChannel.js";

/**
 * Canal de simulação via CLI. Implementa só a porta MessagingChannel — quem
 * decide como ler linhas do terminal é o entrypoint (src/entrypoints/cli.ts),
 * não este adapter.
 */
export class CliMessagingChannel implements MessagingChannel {
  private handler: ((message: IncomingMessage) => Promise<void>) | undefined;

  constructor(private readonly output: NodeJS.WritableStream = process.stdout) {}

  onMessage(handler: (message: IncomingMessage) => Promise<void>): void {
    this.handler = handler;
  }

  async sendMessage(recipientId: string, text: string): Promise<void> {
    this.output.write(`[bot -> ${recipientId}] ${text}\n`);
  }

  async receive(senderId: string, text: string): Promise<void> {
    if (!this.handler) throw new Error("CliMessagingChannel: no handler registered");
    await this.handler({ senderId, text, timestamp: new Date() });
  }
}
