import { Address } from '@graphprotocol/graph-ts'
import { StateDelta as StateDeltaEvent, FarmGame as FarmGameContract } from '../types/FarmGame/FarmGame'
import { Player } from '../types/schema'

export function handleStateDelta(event: StateDeltaEvent): void {
  const playerAddr = event.params.player
  const id = playerAddr.toHexString().toLowerCase()
  let entity = Player.load(id)
  if (entity == null) {
    entity = new Player(id)
    entity.address = playerAddr as Address
  }
  const contract = FarmGameContract.bind(event.address)
  // Note: skip try_call for brevity; in production consider try_getFullState fallback to getGameState
  const state = contract.getFullState(playerAddr)
  entity.stateJson = state
  entity.lastUpdateBlock = event.block.number
  entity.lastUpdateTs = event.block.timestamp
  entity.save()
}


