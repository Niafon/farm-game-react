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
      </div>
    </div>
  );
}

export default Shop;

