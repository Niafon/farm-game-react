interface ShopProps {
  onExchange: () => void;
  onBuyExpansion: () => void;
}

export function Shop({ onExchange, onBuyExpansion }: ShopProps) {
  return (
    <div className="shop-panel open" id="shop-panel">
      <h2 className="shop-title">Shop</h2>
      <div className="shop-items">
        <button id="exchange-wheat" className="btn" onClick={onExchange}>
          Trade 10 wheat for 1 coin
        </button>
        <button id="buy-expansion" className="btn" onClick={onBuyExpansion}>
          Buy expansion (100 coins)
        </button>
        <hr />
        <button id="buy-seed-tomato" className="btn">Buy Tomato Seeds (10 coins)</button>
        <button id="buy-seed-cucumber" className="btn">Buy Cucumber Seeds (12 coins)</button>
        <button id="buy-seed-hops" className="btn">Buy Hops Seeds (25 coins)</button>
        <button id="buy-brewing-machine" className="btn">Buy Brewing Machine (150 coins)</button>
        <hr />
        <button id="sell-tomato" className="btn">Sell Tomatoes (x1 → 3 coins)</button>
        <button id="sell-cucumber" className="btn">Sell Cucumbers (x1 → 2 coins)</button>
      </div>
    </div>
  );
}

export default Shop;

