# Padaria — Atendimento e Logística via WhatsApp (simulado)

Sistema de atendimento e logística para uma padaria: um bot conversa com clientes,
monta pedidos a partir de um catálogo, calcula o frete e, no corte de cada janela
de entrega, gera a rota otimizada para o entregador.

Esta é uma base para produto real (camadas separadas, testes, configuração por
env, migrations), não uma demo descartável. Ainda **não** está integrado ao
WhatsApp de verdade — o canal desta fase é um simulador (CLI e web). Veja
[Canal de mensagens](#canal-de-mensagens) para o que falta para plugar o WhatsApp
Cloud API ou o Twilio.

## O que o sistema faz

- Conversa por texto (via simulador), monta um carrinho a partir de linguagem
  natural (regras/palavras-chave — sem custo, sem API de IA), lida com item
  ambíguo, item inexistente e alteração antes da confirmação.
- Geocodifica o endereço (ORS/Pelias), sempre pedindo confirmação explícita
  antes de fechar o pedido.
- Calcula o frete (`taxa_base + preço_por_km × distância rodada`) via ORS
  (directions), nunca inventando valor se a API falhar.
- Fecha o pedido com um snapshot congelado de preços/frete, atribuído a uma
  leva de entrega (12h ou 16h) pelo horário real de confirmação.
- No fechamento de uma leva, monta a rota otimizada (ORS optimization / VROOM)
  com ordem das paradas, distância/tempo por trecho e total, e link de
  navegação.
- Escala para atendimento humano quando: o cliente pede, o assunto é fora de
  escopo (reclamação, troca, cobrança, status/alteração de pedido fechado),
  o bot não entende depois de uma tentativa de esclarecimento, ou qualquer
  passo técnico falha.

## Como rodar

Requer **Node 22.5+** (usa o módulo nativo `node:sqlite`, sem dependência
externa de banco).

```bash
npm install
cp .env.example .env
npm test          # testes de unidade, sem rede
npm start         # inicia o simulador (canal definido por MESSAGING_ADAPTER)
npm run seed      # popula pedidos de exemplo e imprime a rota do dia
```

Sem uma `ORS_API_KEY` configurada, o sistema usa automaticamente providers
**offline** (distância em linha reta com fator de sinuosidade, geocoding
determinístico por hash do texto) — dá pra testar o fluxo inteiro sem chave,
mas isso **não é** uma distância/rota real. O sistema avisa isso no log ao
iniciar. Para usar o ORS de verdade, defina `ORS_API_KEY` no `.env`.

### Simular um dia inteiro de pedidos

1. `npm start` com `MESSAGING_ADAPTER=simulator-web` no `.env`, abra
   `http://localhost:3000`. A página permite abrir várias conversas em
   paralelo (um cliente por painel) e tem um painel de atendente para ver
   handoffs e devolver a conversa ao bot.
2. Ou `MESSAGING_ADAPTER=simulator-cli`: digite `<clienteId>: mensagem` no
   terminal (múltiplos ids simulam múltiplos clientes na mesma sessão).
   Comandos `/status <clienteId>` e `/resume <clienteId>` (devolve do
   atendimento humano pro bot) também funcionam.
3. `npm run seed` cria pedidos de exemplo direto no banco (sem precisar
   digitar no simulador) e já imprime a rota otimizada da leva atual.

## Canal de mensagens

O núcleo (conversa, carrinho, frete, roteirização) só conhece a interface
`MessagingChannel` (`src/ports/MessagingChannel.ts`) — nunca importa nada de
`src/adapters/messaging/*`. Trocar de canal é: escrever um novo arquivo em
`src/adapters/messaging/<nome>/`, e mudar `MESSAGING_ADAPTER` no `.env` (mais
um `case` no `switch` de `src/entrypoints/main.ts`, que é só uma seleção — o
núcleo não muda).

### O que falta para plugar o WhatsApp Cloud API (Meta) ou o Twilio

Não implementado nesta fase — só o caminho documentado:

- **Novo adapter** `src/adapters/messaging/whatsapp-cloud/WhatsAppCloudChannel.ts`
  implementando `MessagingChannel`:
  - `sendMessage(recipientId, text)`: `POST` para
    `https://graph.facebook.com/v20.0/<PHONE_NUMBER_ID>/messages` (Cloud API)
    ou para a API de mensagens do Twilio, com o token vindo de env var.
  - `onMessage(handler)`: guarda o handler; quem dispara é o webhook (abaixo).
- **Webhook HTTP**: um endpoint novo (ex: reaproveitando o servidor de
  `src/adapters/messaging/simulator-web/server.ts` como modelo, ou um
  processo dedicado) que:
  - Responde ao *handshake* de verificação do webhook (`GET` com
    `hub.challenge`, Cloud API) ou a validação de assinatura (Twilio).
  - Recebe o `POST` do provedor a cada mensagem, extrai
    `{ senderId, text, timestamp }` do payload específico do provedor, e
    chama o `handler` registrado.
- **O que muda**: só esse novo arquivo + a env var `MESSAGING_ADAPTER=whatsapp-cloud`
  (ou `twilio`) + credenciais novas no `.env` (`WHATSAPP_TOKEN`,
  `WHATSAPP_PHONE_NUMBER_ID`, etc. — a definir quando for implementar).
- **O que não muda**: `wireConversationChannel`, `handleMessage`, carrinho,
  frete, roteirização, repositórios — nada disso sabe que o canal mudou.

Critério de aceite que isso satisfaz: trocar o adapter é criar um arquivo novo
e mudar uma variável de ambiente.

## Catálogo

Nicho escolhido: **padaria**. Catálogo em `data/catalog.json` (nunca hardcoded
em código) — id, nome, descrição, preço em centavos, unidade de venda,
disponibilidade. Trocar item/preço é editar o JSON.

## Decisões arquiteturais e por quê

- **Node.js + TypeScript**: WhatsApp Cloud API/Twilio são webhook-HTTP —
  Node é o caminho mais direto pra isso. Tipagem estrutural do TS torna
  interfaces (`MessagingChannel`, `RoutingProvider`, `GeocodingProvider`) e
  fakes de teste triviais de escrever e verificar em compile-time.
- **Hexagonal (ports & adapters)**: `src/core` não importa nada de
  `src/adapters`. `src/app` é o único lugar (composition root) que conhece os
  dois lados e monta tudo.
- **Dinheiro em centavos (inteiro)**: nunca float. Arredondamento da parte
  variável do frete é `Math.round` (meio para cima) antes de somar a taxa
  base.
- **Timezone explícito** (`America/Sao_Paulo`, via `luxon`) em toda decisão de
  janela/corte — nunca `Date` ingênuo.
- **`node:sqlite`** (nativo do Node 22+) para persistência de pedidos e
  conversas: zero dependência externa, zero risco de build nativo (ao
  contrário de `better-sqlite3`), migrations simples com tabela de controle.
  Catálogo continua em JSON (não muda com frequência, não precisa de SQL).
- **Parser de intenção por regras/palavras-chave** (não LLM): decisão
  explícita do usuário — sem custo, sem API externa, determinístico para
  testes. Trade-off: entende bem menos variação de linguagem natural do que
  um LLM real; documentado como limitação conhecida.
- **Providers ORS atrás de interface própria** (`GeocodingProvider`,
  `RoutingProvider`, `RouteOptimizer`), com retry/timeout e cache em memória
  (mesmo endereço/par de coordenadas não gasta cota duas vezes). Fixture fake
  para testes — nenhum teste depende de rede. Formatos de request/response
  confirmados na documentação oficial (Pelias, VROOM, `openrouteservice-py`),
  nunca chutados.
- **Sem retorno à loja na rota** (`roundTrip: false` por padrão) e **corte
  em 11h40/15h40** (20 min antes da saída): decisões tomadas junto com o
  usuário, não sozinhas — ver histórico de commits.
- **Fila de processamento por cliente** (`wireConversation.ts`): mensagens da
  mesma conversa são serializadas (mensagens de clientes diferentes correm em
  paralelo) — sem isso, duas mensagens quase simultâneas da mesma pessoa
  poderiam ler o estado antes da anterior salvar, perdendo carrinho no meio do
  caminho. Bug real encontrado e corrigido durante o desenvolvimento.

## Limites do plano gratuito do ORS

Confirmado na documentação oficial (`openrouteservice.org/restrictions/`):
**Matrix** até 3.500 combinações origem×destino por requisição; **Optimization**
até 50 jobs e 3 veículos por requisição. Os limites de requisições por
minuto/dia do plano gratuito ficam no painel pós-login e não foram
confirmados nesta sessão (nenhuma chave de API disponível) — confirme no
[dashboard do ORS](https://api.openrouteservice.org/) antes de depender disso
em produção.

## Testes

`npm test` roda tudo sem rede (fakes para ORS e para o parser). Cobertura
inclui: cálculo de frete (raio máximo, distância zero, falha da API),
atribuição de janela pelo horário exato (`11h39`/`11h41`/`15h39`/`15h41`),
montagem de carrinho (item ambíguo, indisponível, inexistente, quantidade
inválida), parser de intenção, orquestração completa da conversa (incluindo
escalonamento), roteirização (VROOM/ORS) e persistência SQLite.

## Pontos de extensão conhecidos (não implementados de propósito)

- Consultar status de pedido e alterar/cancelar pedido fechado: o bot escala
  para humano nesses casos (ver `RuleBasedIntentParser`, padrões
  `OUT_OF_SCOPE_PATTERNS`). Não implementado "já que seria fácil" — é decisão
  explícita do escopo desta fase.
- Capacidade do veículo na otimização de rota: o parâmetro já existe
  (`OptimizationRequest.vehicleCapacity`) mas não é aplicado — um veículo, sem
  restrição, por enquanto.
- Adapter real do WhatsApp/Twilio: ver [Canal de mensagens](#canal-de-mensagens).
