import React from 'react';
import { render, screen } from '@testing-library/react';
import Inventory from '../../components/Inventory';

describe('Inventory component', () => {
  test.each([
    ['empty inventory', { wheat: 0, coins: 0 }, 'Inventory is empty'],
    ['single item', { wheat: 1, coins: 0 }, '🌾 Wheat'],
    ['maximum values', { wheat: Number.MAX_SAFE_INTEGER, coins: Number.MAX_SAFE_INTEGER }, `x${Number.MAX_SAFE_INTEGER}`],
  ])('renders %s correctly', (_name, items, expected) => {
    render(<Inventory items={items} />);
    expect(screen.getByText('Inventory')).toBeInTheDocument();
    if (_name === 'maximum values') {
      expect(screen.getAllByText(expected).length).toBeGreaterThan(0);
    } else {
      expect(screen.getByText(expected)).toBeInTheDocument();
    }
  });
});
