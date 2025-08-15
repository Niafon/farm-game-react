import InventoryView from './InventoryView'
import ShopView from './ShopView'
import WalletPanel from './WalletPanel'
import WalletIconButton from './WalletIconButton'
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
      <WalletIconButton />
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
          {/* Secret sun/moon toggle */}
          <button className="sky-orb" id="sky-orb" aria-label="Sun">☀️</button>
          <div className="clouds" aria-hidden="true">
            <div className="cloud cloud--1">☁️</div>
            <div className="cloud cloud--2">☁️</div>
            <div className="cloud cloud--3">☁️</div>
            <div className="cloud cloud--4">☁️</div>
          </div>

          {/* Beds stay above waves regardless of scroll */}
          <div className="garden-beds" id="garden-beds" />
          {/* ASCII grass fields (left/right), leaving center clear for beds */}
          <pre id="ascii-grass-left" aria-hidden="true" style={{ position: 'fixed', bottom: 120, left: 0, width: 'calc(50vw - 180px)', textAlign: 'left', color: 'var(--grass-color)', fontFamily: 'monospace', whiteSpace: 'pre', pointerEvents: 'none', zIndex: 0 }}>{`
~  ~   ~~   ~  ~~   ~   ~ ~    ~~    ~  ~~   ~
  ~~  ~   ~~   ~  ~~   ~    ~~   ~  ~~   ~  ~ 
~   ~~    ~  ~~   ~   ~~  ~   ~~   ~   ~~   ~ 
  ~   ~  ~~   ~  ~~   ~   ~   ~  ~~   ~  ~~   
`}</pre>
          <pre id="ascii-grass-right" aria-hidden="true" style={{ position: 'fixed', bottom: 120, right: 0, width: 'calc(50vw - 180px)', textAlign: 'right', color: 'var(--grass-color)', fontFamily: 'monospace', whiteSpace: 'pre', pointerEvents: 'none', zIndex: 0 }}>{`
~  ~   ~~   ~  ~~   ~   ~ ~    ~~    ~  ~~   ~
  ~~  ~   ~~   ~  ~~   ~    ~~   ~  ~~   ~  ~ 
~   ~~    ~  ~~   ~   ~~  ~   ~~   ~   ~~   ~ 
  ~   ~  ~~   ~  ~~   ~   ~   ~  ~~   ~  ~~   
`}</pre>
        </div>
      </div>

		<div className="trees" aria-hidden="true">
			<div className="tree">
				<pre className="canopy breeze-1">{`   cce*88oo
 C8O8*8Q8P*0b o8oo
d0B*9*O8P*UOpug09*D
C0*900*89PBC0PL*S0BB*
 Cgg*bU8*U0*00d*U0dcb
   60*U   /p   gc*U*dpP
     \\//    /d*uUP*
      \\/////`}</pre>
				<pre className="trunk">{`       |||||
       |||||
  ....//||||\\....\\../\\//.....`}</pre>
			</div>

			<div className="tree">
				<pre className="canopy breeze-2">{`    cce*88oo
  C8O8*8Q8P*0b o8oo
 dOB*9*O8P*UOpug09*D
  Cgg*bU8*U0*00d*U0dcb
    6O*U  /p  gc*U*dpP
      \\//  /d*uUP*
        \\////`}</pre>
				<pre className="trunk">{`         |||||
         |||||
 ...././||||\\..../\\/....`}</pre>
			</div>

			<div className="tree">
				<pre className="canopy breeze-3">{`     cce*88oo
   C8O8*8Q8P*0b o8oo
  dOB*9*O8P*UOpug09*D
   CO*900*89PBC0PL*S0BB*
     6O*U  /p  gc*U*dpP
        \\//  /d*uUP*
          \\///`}</pre>
				<pre className="trunk">{`          ||||
          ||||
  ...//||||\\..;'/\\/..../`}</pre>
			</div>

			{/* Extra trees */}
			<div className="tree">
				<pre className="canopy breeze-1">{`      *o88oo
    C8Q8*8P*0b oo
   d0B*9*08*UOpg09*D
    Cg*bU8*U0*0d*U0db
      6O*U /p gc*U*dp
        \\// /d*uU
          \\///`}</pre>
				<pre className="trunk">{`        ||||
        ||||
   ...//||||\\..../\\/..`}</pre>
			</div>
			<div className="tree">
				<pre className="canopy breeze-2">{`       cce*8oo
     C8O8*Q8P*b o8o
   dOB*9*O8P*UOpug*
     Cgg*bU8*U0*0db
       6O*U /p gc*U
         \\// /d*
          \\//`}</pre>
				<pre className="trunk">{`         |||
         |||
   ..//||||\\.../\\/..`}</pre>
			</div>
		</div>

		{/* Reserve extra space for future expansion elements */}
		<div id="expansion-reserve" style={{ position: 'fixed', right: '4vw', top: '20vh', width: 200, height: 120, pointerEvents: 'none' }} aria-hidden="true" />

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


