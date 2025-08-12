export const BedStage = {
  Empty: 'empty',
  Seed: 'seed',
  Growing: 'growing',
  Ready: 'ready',
} as const;
export type BedStage = typeof BedStage[keyof typeof BedStage];

export const BedAction = {
  Plant: 'plant',
  Water: 'water',
  Harvest: 'harvest',
} as const;
export type BedAction = typeof BedAction[keyof typeof BedAction];

export interface GardenBed {
  stage: BedStage;
  nextAction: BedAction | null;
  timerActive: boolean;
  timerEnd?: number;
  isActionInProgress?: boolean;
}

export interface GameState {
  beds: GardenBed[];
  inventory: Record<string, number>;
  firstTime: boolean;
  expansionPurchased: boolean;
  walletAddress?: string;
}

