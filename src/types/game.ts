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

export type CropType = 'wheat' | 'tomato' | 'cucumber' | 'hops';

export interface GardenBed {
  stage: BedStage;
  nextAction: BedAction | null;
  timerActive: boolean;
  timerEnd?: number;
  isActionInProgress?: boolean;
  crop?: CropType; // which crop is currently growing in this bed (undefined means wheat by default)
}

export interface GameState {
  beds: GardenBed[];
  inventory: Record<string, number>;
  firstTime: boolean;
  expansionPurchased: boolean;
  walletAddress?: string;
  brewingMachinePurchased?: boolean;
}

