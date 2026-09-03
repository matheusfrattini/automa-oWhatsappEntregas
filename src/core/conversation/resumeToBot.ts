import type { ConversationContext } from "./types.js";

/**
 * Ação do humano: devolve a conversa para o bot depois de um handoff.
 * Mantém carrinho/endereço/estado de onde a conversa parou — só desliga o
 * modo "atendimento humano".
 */
export function resumeToBot(context: ConversationContext): ConversationContext {
  const { handoffReason, ...rest } = context;
  return { ...rest, isHandoff: false, consecutiveUnclearCount: 0 };
}
