import { BedAction, BedStage, type GardenBed } from '../types/game'

export function deriveNextAction(bed: GardenBed | undefined): BedAction | null {
  if (!bed) return null
  if (bed.timerActive && bed.stage !== BedStage.Ready) return null
  switch (bed.stage) {
    case BedStage.Empty: return BedAction.Plant
    case BedStage.Seed: return BedAction.Water
    case BedStage.Growing: return BedAction.Harvest
    case BedStage.Ready: return BedAction.Harvest
    default: return null
  }
}

export function plantEmoji(stage: BedStage): string {
  switch (stage) {
    case BedStage.Empty: return '🟫'
    case BedStage.Seed: return '🌱'
    case BedStage.Growing: return '🌽'
    case BedStage.Ready: return '🌾'
    default: return '🟫'
  }
}

export function getPlantAriaLabel(stage: BedStage, next: BedAction | null): string {
  const stageText = (
    stage === BedStage.Empty ? 'Empty bed' :
    stage === BedStage.Seed ? 'Seed planted' :
    stage === BedStage.Growing ? 'Growing' :
    'Ready to harvest'
  )
  const nextText = next ? `, next action ${next}` : ''
  return `${stageText}${nextText}`
}


