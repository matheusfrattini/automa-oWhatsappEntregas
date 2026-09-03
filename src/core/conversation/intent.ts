export interface RequestedItem {
  /** Texto cru do item, como o cliente escreveu — resolução contra o catálogo é feita à parte. */
  text: string;
  quantity: number;
}

export type ParsedIntent =
  | { type: "add_items"; items: RequestedItem[] }
  | { type: "remove_item"; text: string }
  | { type: "confirm" }
  | { type: "cancel" }
  | { type: "select_option"; index: number }
  | { type: "request_human" }
  | { type: "out_of_scope"; reason: string }
  | { type: "unclear" };
