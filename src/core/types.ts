/**
 * Dinheiro é sempre um inteiro em centavos. Nunca usar float para valores monetários.
 */
export type Cents = number;

export interface Coordinates {
  lat: number;
  lon: number;
}
