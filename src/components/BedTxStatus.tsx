import React, { useEffect, useState } from 'react'

type GardenBed = {
  isActionInProgress?: boolean
}

function BedTxStatusBase({ index }: { index: number }) {
  const [inProgress, setInProgress] = useState<boolean>(false)
  const [confirmed, setConfirmed] = useState<boolean>(false)

  useEffect(() => {
    const onBedUpdate = (e: Event) => {
      const ce = e as CustomEvent<{ index: number; bed: GardenBed }>
      if (ce.detail?.index !== index) return
      const bed = ce.detail.bed
      if (bed.isActionInProgress) {
        setInProgress(true)
        setConfirmed(false)
      } else if (inProgress) {
        setInProgress(false)
        setConfirmed(true)
        const t = setTimeout(() => setConfirmed(false), 1200)
        return () => clearTimeout(t)
      }
    }
    window.addEventListener('bed:update', onBedUpdate as EventListener)
    return () => window.removeEventListener('bed:update', onBedUpdate as EventListener)
  }, [index, inProgress])

  if (inProgress) return <div className="tx-status" aria-live="polite">⏳ Pending</div>
  if (confirmed) return <div className="tx-status" aria-live="polite">✅ Confirmed</div>
  return null
}

const BedTxStatus = React.memo(BedTxStatusBase)
export default BedTxStatus



