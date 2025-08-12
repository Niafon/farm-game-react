import { render } from '@testing-library/react';

const initMock = jest.fn().mockReturnValue({ cleanup: jest.fn() });
jest.mock('../game', () => ({ initializeGame: initMock }));

import App from '../App';

it('initializes game on mount', () => {
  render(<App />);
  expect(initMock).toHaveBeenCalled();
});

it('renders without crashing with WalletProvider', () => {
  const { unmount } = render(<App />);
  unmount();
});

// Note: markup.html content is mocked to an empty string in tests,
// so we don't assert on DOM generated from the raw HTML.
