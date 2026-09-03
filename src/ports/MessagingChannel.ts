export interface IncomingMessage {
  senderId: string;
  text: string;
  timestamp: Date;
}

/**
 * Porta de canal de mensagens. O núcleo só fala com isso — nunca com WhatsApp,
 * Twilio, ou o simulador diretamente. Trocar o adapter é escrever outra
 * implementação desta interface e mudar MESSAGING_ADAPTER no .env.
 */
export interface MessagingChannel {
  onMessage(handler: (message: IncomingMessage) => Promise<void>): void;
  sendMessage(recipientId: string, text: string): Promise<void>;
}
