import { composeApp } from "../app/composeApp.js";
import { startCliSimulator } from "../adapters/messaging/simulator-cli/startCliSimulator.js";
import { startWebSimulator } from "../adapters/messaging/simulator-web/server.js";

/**
 * Único ponto de entrada. O canal ativo é escolhido por MESSAGING_ADAPTER —
 * trocar de canal é mudar essa env var (e, para um canal novo, escrever o
 * adapter e adicionar um `case` aqui; o núcleo nunca muda).
 */
async function main(): Promise<void> {
  const app = composeApp();

  switch (app.config.messagingAdapter) {
    case "simulator-cli":
      await startCliSimulator(app);
      return;
    case "simulator-web":
      startWebSimulator(app);
      return;
    default:
      throw new Error(
        `MESSAGING_ADAPTER desconhecido: "${app.config.messagingAdapter}". Use "simulator-cli" ou "simulator-web".`,
      );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
