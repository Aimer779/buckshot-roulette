export interface RoundConfig {
  playerHP: number;
  dealerHP: number;
  shellCount: number;
  itemCount: number;
}

export const ROUND_CONFIG: Record<number, RoundConfig> = {
  1: { playerHP: 2, dealerHP: 2, shellCount: 3, itemCount: 1 },
  2: { playerHP: 4, dealerHP: 4, shellCount: 5, itemCount: 2 },
  3: { playerHP: 6, dealerHP: 6, shellCount: 7, itemCount: 3 },
};
