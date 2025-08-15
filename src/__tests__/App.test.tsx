import { render } from '@testing-library/react';
// test-only lightweight providers to avoid import.meta usage
import React from 'react'
import { WagmiProvider, createConfig } from 'wagmi'
import { http, defineChain } from 'viem'

const initMock = jest.fn().mockReturnValue({ cleanup: jest.fn() });
jest.mock('../game', () => ({ initializeGame: initMock }));

import App from '../App';

const testChain = defineChain({
  id: 31337,
  name: 'Local',
  nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['http://localhost:8545'] }, public: { http: ['http://localhost:8545'] } },
  testnet: true,
})
const testConfig = createConfig({
  chains: [testChain],
  transports: { [testChain.id]: http('http://localhost:8545') },
  ssr: true,
})

function TestProviders({ children }: { children: React.ReactNode }) {
  return <WagmiProvider config={testConfig}>{children}</WagmiProvider>
}

it('initializes game on mount', () => {
  render(
    <TestProviders>
      <App />
    </TestProviders>
  );
  expect(initMock).toHaveBeenCalled();
});

it('renders without crashing with WalletProvider', () => {
  const { unmount } = render(
    <TestProviders>
      <App />
    </TestProviders>
  );
  unmount();
});

// Note: markup.html content is mocked to an empty string in tests,
// so we don't assert on DOM generated from the raw HTML.
