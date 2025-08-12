import { BedAction, BedStage, type GardenBed } from '../types/game';

interface GardenBedProps {
  id: string;
  bed: GardenBed;
  onAction: (id: string, bed: GardenBed) => void;
}

export function GardenBed({ id, bed, onAction }: GardenBedProps) {
  const getPlantEmoji = (stage: BedStage): string => {
    switch (stage) {
      case BedStage.Empty:
        return '🟫';
      case BedStage.Seed:
        return '🌱';
      case BedStage.Growing:
        return '🌽';
      case BedStage.Ready:
        return '🌾';
      default:
        return '🟫';
    }
  };

  const getActionEmoji = (action: BedAction): string => {
    switch (action) {
      case BedAction.Plant:
        return '🌰';
      case BedAction.Water:
        return '💧';
      case BedAction.Harvest:
        return '🔪';
      default:
        return '❓';
    }
  };

  const getPlantAriaLabel = (stage: BedStage, next: BedAction | null): string => {
    const stageText =
      stage === BedStage.Empty
        ? 'Empty bed'
        : stage === BedStage.Seed
        ? 'Seed planted'
        : stage === BedStage.Growing
        ? 'Growing'
        : 'Ready to harvest';
    const nextText = next ? `, next action ${next}` : '';
    return `${stageText}${nextText}`;
  };

  const getActionAriaLabel = (action: BedAction): string => {
    switch (action) {
      case BedAction.Plant:
        return 'Plant seed';
      case BedAction.Water:
        return 'Water plant';
      case BedAction.Harvest:
        return 'Harvest crop';
      default:
        return 'Action';
    }
  };

  return (
    <div className="garden-bed" id={id}>
      <div className="bed-ascii">
        {`+----------------------------+
|                            |
|   ~~~~~~~~~~~~~~~~~~~~~~   |
|   ~~~~~~~~~~~~~~~~~~~~~~   |
|   ~~~~~~~~~~~~~~~~~~~~~~   |
|   ~~~~~~~~~~~~~~~~~~~~~~   |
|   ~~~~~~~~~~~~~~~~~~~~~~   |
|                            |
+----------------------------+`}
      </div>
      <div
        className="plant"
        role="button"
        tabIndex={0}
        aria-label={getPlantAriaLabel(bed.stage, bed.nextAction)}
        onClick={() => {
          if (bed.nextAction && !bed.timerActive && !bed.isActionInProgress) onAction(id, bed);
        }}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && bed.nextAction && !bed.timerActive && !bed.isActionInProgress) {
            e.preventDefault();
            onAction(id, bed);
          }
        }}
      >
        {getPlantEmoji(bed.stage)}
      </div>
      {bed.nextAction && !bed.timerActive && (
        <div
          className="action-icon"
          role="button"
          aria-label={getActionAriaLabel(bed.nextAction)}
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            if (!bed.isActionInProgress) onAction(id, bed);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              e.stopPropagation();
              if (!bed.isActionInProgress) onAction(id, bed);
            }
          }}
        >
          {getActionEmoji(bed.nextAction)}
        </div>
      )}
    </div>
  );
}

export default GardenBed;

