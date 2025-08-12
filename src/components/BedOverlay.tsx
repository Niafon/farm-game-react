import BedActionIcon from './BedActionIcon'
import BedTimer from './BedTimer'
import BedTxStatus from './BedTxStatus'
import BedActionAnimation from './BedActionAnimation'

export default function BedOverlay({ index }: { index: number }) {
  return (
    <div className="bed-overlay">
      <div className="bed-left">
        <BedTxStatus index={index} />
      </div>
      <div className="bed-center">
        <BedActionIcon index={index} />
        <BedTimer index={index} />
      </div>
      <BedActionAnimation index={index} />
    </div>
  )
}



