import BedContent from './BedContent'
import BedOverlay from './BedOverlay'

import React from 'react'

function BedBase({ index }: { index: number }) {
  return (
    <div className="garden-bed" id={`bed-${index}`}>
      <BedContent index={index} />
      <div id={`react-action-${index}`}>
        <BedOverlay index={index} />
      </div>
    </div>
  )
}

const Bed = React.memo(BedBase)
export default Bed



