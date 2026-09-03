import readline from "node:readline";
import type { App } from "../../../app/composeApp.js";
import { wireConversationChannel } from "../../../app/wireConversation.js";
import { resumeToBot } from "../../../core/conversation/resumeToBot.js";
import { CliMessagingChannel } from "./CliMessagingChannel.js";

export async function startCliSimulator(app: App): Promise<void> {
  const channel = new CliMessagingChannel();
  wireConversationChannel(channel, app);

  console.log('Simulador de WhatsApp (CLI). Formato: "<clienteId>: mensagem" — ex: "cliente1: quero 2 pães".');
  console.log('Comandos: "/resume <clienteId>" devolve a conversa ao bot; "/status <clienteId>" mostra o estado.');
  console.log("Ctrl+C para sair.\n");

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  // Processa uma linha de cada vez: sem isso, um arquivo de entrada (ou
  // colar várias linhas de uma vez) dispara todas as linhas antes da
  // primeira terminar de processar, e uma leitura de estado (ex: "/status")
  // pode correr na frente de uma mensagem anterior que ainda não salvou.
  let queue: Promise<void> = Promise.resolve();

  rl.on("line", (line) => {
    queue = queue.then(() => handleLine(line)).catch((err) => console.error("Erro:", err));
  });

  async function handleLine(rawLine: string): Promise<void> {
    const line = rawLine.trim();
    if (line.length === 0) return;

    if (line.startsWith("/resume ")) {
      const customerId = line.slice("/resume ".length).trim();
      const context = await app.conversationRepository.get(customerId);
      if (!context) {
        console.log(`Nenhuma conversa encontrada para "${customerId}".`);
        return;
      }
      await app.conversationRepository.save(resumeToBot(context));
      console.log(`Conversa de "${customerId}" devolvida ao bot.`);
      return;
    }

    if (line.startsWith("/status ")) {
      const customerId = line.slice("/status ".length).trim();
      const context = await app.conversationRepository.get(customerId);
      console.log(context ? JSON.stringify(context, null, 2) : `Nenhuma conversa encontrada para "${customerId}".`);
      return;
    }

    const separatorIndex = line.indexOf(":");
    if (separatorIndex === -1) {
      console.log('Formato inválido. Use "<clienteId>: mensagem".');
      return;
    }
    const senderId = line.slice(0, separatorIndex).trim();
    const text = line.slice(separatorIndex + 1).trim();
    if (!senderId || !text) {
      console.log('Formato inválido. Use "<clienteId>: mensagem".');
      return;
    }

    await channel.receive(senderId, text);
  }

  await new Promise<void>((resolve) => rl.on("close", resolve));
}
