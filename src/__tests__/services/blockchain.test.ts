import { ensureNetwork } from '../../services/blockchain';
import * as blockchain from '../../services/blockchain';

jest.mock('../../config', () => ({
  MONAD_CHAIN_ID: '0x1',
  MONAD_CHAIN_NAME: 'Monad Testnet',
  MONAD_RPC_URL: 'https://rpc.monad.test'
}));

describe('ensureNetwork', () => {
  test.each([
    ['already on correct network', '0x1', undefined],
    ['wrong network triggers error', '0x2', 'Wrong network. Please switch to Monad.'],
  ])('%s', async (_name, current, expectedError) => {
    const provider = { request: jest.fn().mockResolvedValueOnce(current) } as any;
    if (expectedError) {
      const spy = jest.spyOn(blockchain, 'switchOrAddChain').mockRejectedValueOnce(new Error('fail'));
      await expect(ensureNetwork(provider)).rejects.toThrow(expectedError);
      spy.mockRestore();
    } else {
      await expect(ensureNetwork(provider)).resolves.toBeUndefined();
    }
  });
});
