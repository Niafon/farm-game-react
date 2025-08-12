import InventoryView from './InventoryView'
import ShopView from './ShopView'
import WalletPanel from './WalletPanel'
export default function StaticMarkup() {
  return (
    <>
      {/* Inventory */}
      <button className="inventory-toggle" id="inventory-toggle" aria-label="Open inventory">🎒</button>
      <div className="inventory-panel" id="inventory-panel">
        <h2 className="inventory-title">Inventory</h2>
        <div className="inventory-items" id="inventory-list">
          <InventoryView />
        </div>
      </div>

      {/* Wallet */}
      <button className="wallet-connect" id="wallet-connect" aria-label="Connect wallet">👛</button>
      <WalletPanel />

      {/* Shop */}
      <button className="shop-toggle" id="shop-toggle" aria-label="Open shop">🏪</button>
      <div className="shop-panel" id="shop-panel">
        <h2 className="shop-title">Shop</h2>
        <ShopView />
      </div>

      {/* Custom modal for messages */}
      <div className="custom-modal" id="custom-modal" role="dialog" aria-modal="true" aria-labelledby="custom-modal-message" aria-hidden="true">
        <div className="custom-modal-content" id="custom-modal-content" role="document">
          <p id="custom-modal-message"></p>
          <button className="custom-modal-button" id="custom-modal-button" aria-label="Close dialog">OK</button>
        </div>
      </div>

      <div className="game-container">
        <div className="farm-scene">
          <div className="clouds" aria-hidden="true">
            <div className="cloud cloud--1">☁️</div>
            <div className="cloud cloud--2">☁️</div>
            <div className="cloud cloud--3">☁️</div>
            <div className="cloud cloud--4">☁️</div>
          </div>

          {/* Beds stay above waves regardless of scroll */}
          <div className="garden-beds" id="garden-beds" />
        </div>
      </div>

      <div className="trees" aria-hidden="true">
        <div className="tree">   cce*88oo{"\n"}
  C8O8*8Q8P*Ob o8oo{"\n"}
 dOB*9*O8P*UOpugO9*D{"\n"}
 CO*9O0*89PBCOPL*SOBB*{"\n"}
  Cgg*bU8*UO*OOd*UOdcb{"\n"}
    6O*U  /p  gc*U*dpP{"\n"}
      \\\\//  /d*uUP*{"\n"}
        \\\\////{"\n"}
         |||//{"\n"}
         |||||{"\n"}
   .....//||||\\....\../\\//.....</div>

        <div className="tree">    cce*88oo{"\n"}
    C8O8*8Q8P*Ob o8oo{"\n"}
  dOB*9*O8P*UOpugO9*D{"\n"}
     6O*U  /p  gc*U*dpP{"\n"}
       \\\\//  /d*uUP*{"\n"}
         \\\\////{"\n"}
          |||//{"\n"}
 ...\|/...|||||....\|//../...</div>

        <div className="tree">     cce*88oo{"\n"}
     C8O8*8Q8P*Ob o8oo{"\n"}
   dOB*9*O8P*UOpugO9*D{"\n"}
  CO*9O0*89PBCOPL*SOBB*{"\n"}
   Cgg*bU8*UO*OOd*UOdcb{"\n"}
     6O*U  /p  gc*U*dpP{"\n"}
          |||||{"\n"}
    .....//||||\\..;'/'//....]/...</div>
      </div>

      <div className="waves"></div>

      {/* Extension block to keep scrolling */}
      <div className="page-extension"></div>

      <div className="modal" id="welcome-modal">
        <div className="modal-content">
          <h2>Welcome to ASCII Farm!</h2>
          <p>Take care of your plants, harvest the crops and enjoy!</p>
          <p>Stages of growth:</p>
          <p>🟫 → 🌱 → 🌽 → 🌾</p>
          <p>Each action takes 8 hours of real time.</p>
          <button className="btn" id="start-game">Start game</button>
        </div>
      </div>
    </>
  )
}


