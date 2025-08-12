import BedContent from './BedContent'
import BedOverlay from './BedOverlay'

export default function Bed({ index }: { index: number }) {
  return (
    <div className="garden-bed" id={`bed-${index}`}>
      <BedContent index={index} />
      <div id={`react-action-${index}`}>
        <BedOverlay index={index} />
      </div>
    </div>
  )
}



