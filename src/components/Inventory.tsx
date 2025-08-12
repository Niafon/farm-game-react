interface InventoryProps {
  items: Record<string, number>;
}

export function Inventory({ items }: InventoryProps) {
  const entries = Object.entries(items).filter(([, count]) => count > 0);
  return (
    <div className="inventory-panel open" id="inventory-panel">
      <h2 className="inventory-title">Inventory</h2>
      <div className="inventory-items" id="inventory-list">
        {entries.length === 0 ? (
          <p>Inventory is empty</p>
        ) : (
          entries.map(([item, count]) => (
            <div key={item} className="inventory-item">
              <span>{item === 'wheat' ? '🌾 Wheat' : item === 'coins' ? '💰 Coins' : item}</span>
              <span>{`x${count}`}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default Inventory;

