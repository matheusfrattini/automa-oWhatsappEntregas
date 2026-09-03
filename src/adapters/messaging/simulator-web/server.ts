import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { App } from "../../../app/composeApp.js";
import { wireConversationChannel } from "../../../app/wireConversation.js";
import { resumeToBot } from "../../../core/conversation/resumeToBot.js";
import { logger } from "../../logging/logger.js";
import { WebMessagingChannel } from "./WebMessagingChannel.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INDEX_HTML_PATH = path.resolve(__dirname, "public/index.html");

async function readJsonBody(req: import("node:http").IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const raw = Buffer.concat(chunks).toString("utf-8");
  return raw.length > 0 ? JSON.parse(raw) : {};
}

export function startWebSimulator(app: App): void {
  const channel = new WebMessagingChannel();
  wireConversationChannel(channel, app);
  const port = app.config.webSimulatorPort;

  const server = createServer((req, res) => {
    void handleRequest(req, res).catch((err) => {
      logger.error("Erro no servidor do simulador web", { error: err instanceof Error ? err.message : String(err) });
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "internal_error" }));
    });
  });

  async function handleRequest(
    req: import("node:http").IncomingMessage,
    res: import("node:http").ServerResponse,
  ): Promise<void> {
    const url = new URL(req.url ?? "/", `http://localhost:${port}`);

    if (req.method === "GET" && url.pathname === "/") {
      const html = await readFile(INDEX_HTML_PATH, "utf-8");
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/messages") {
      const body = (await readJsonBody(req)) as { customerId?: string; text?: string };
      if (!body.customerId || !body.text) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "customerId and text are required" }));
        return;
      }
      const replies = await channel.receiveAndCollect(body.customerId, body.text);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ replies }));
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/handoffs") {
      const handoffs = await app.conversationRepository.listHandoff();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ customerIds: handoffs.map((h) => h.customerId) }));
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/resume") {
      const body = (await readJsonBody(req)) as { customerId?: string };
      if (!body.customerId) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "customerId is required" }));
        return;
      }
      const context = await app.conversationRepository.get(body.customerId);
      if (!context) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "conversation not found" }));
        return;
      }
      await app.conversationRepository.save(resumeToBot(context));
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "not_found" }));
  }

  server.listen(port, () => {
    logger.info(`Simulador web rodando em http://localhost:${port}`);
  });
}
