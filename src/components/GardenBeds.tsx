import type { GardenBed as GardenBedType } from '../types/game';
import { GardenBed } from './GardenBed';

interface GardenBedsProps {
  beds: GardenBedType[];
  onAction: (id: string, bed: GardenBedType) => void;
}

export function GardenBeds({ beds, onAction }: GardenBedsProps) {
  return (
    <div className="garden-beds" id="garden-beds">
      {beds.map((bed, i) => (
        <GardenBed key={i} id={`bed-${i}`} bed={bed} onAction={onAction} />
      ))}
    </div>
  );
}

export default GardenBeds;

