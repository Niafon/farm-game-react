import type { EIP1193Provider as Eip1193Provider } from 'viem';
import { MONAD_CHAIN_ID, MONAD_CHAIN_NAME, MONAD_RPC_URL } from '../config';

export function isSafeProvider(provider?: Eip1193Provider): boolean {
  if (!provider) return false;
  const eth = provider as unknown as { request?: unknown };
  return typeof eth.request === 'function';
}

/**
 * EIP-6963 discovery types and helpers
 */
export type Eip6963ProviderDetail = {
  info: {
    uuid: string; // provider identity
    name: string;
    icon: string; // data URL
    rdns?: string;
  };
  provider: Eip1193Provider;
};

let discoveredProviders: Eip6963ProviderDetail[] | null = null;
const PREFERRED_PROVIDER_KEY = 'wallet:preferred:provider';

export function getPreferredProviderId(): string | null {
  try {
    return localStorage.getItem(PREFERRED_PROVIDER_KEY);
  } catch {
    return null;
  }
}

export function setPreferredProviderId(id: string): void {
  try {
    localStorage.setItem(PREFERRED_PROVIDER_KEY, id);
  } catch {}
}

export async function discoverEip6963Providers(timeoutMs = 200): Promise<Eip6963ProviderDetail[]> {
  if (discoveredProviders) return discoveredProviders;
  discoveredProviders = [];
  const results: Eip6963ProviderDetail[] = [];
  const handler = (e: Event) => {
    const ce = e as CustomEvent<Eip6963ProviderDetail>;
    if (!ce?.detail) return;
    results.push(ce.detail);
  };
  try {
    window.addEventListener('eip6963:announceProvider', handler as EventListener);
    window.dispatchEvent(new Event('eip6963:requestProvider'));
  } catch {
    // Some wallet extensions may freeze overrides; ignore
  }
  await new Promise((r) => setTimeout(r, timeoutMs));
  try {
    window.removeEventListener('eip6963:announceProvider', handler as EventListener);
  } catch {}
  // De-duplicate by uuid
  const uniq = new Map<string, Eip6963ProviderDetail>();
  for (const d of results) uniq.set(d.info.uuid, d);
  discoveredProviders = Array.from(uniq.values());
  return discoveredProviders;
}

/**
 * Returns the injected provider to use, respecting EIP-6963 and user preference.
 * If multiple providers are available and no preference stored, throws a special Error
 * with name 'ProviderSelectionRequired' to allow UI to prompt the user.
 */
export async function getInjectedProvider(): Promise<Eip1193Provider | undefined> {
  const providers = await discoverEip6963Providers();
  if (providers.length === 0) {
    const eth = (window as unknown as { ethereum?: Eip1193Provider }).ethereum;
    return eth && isSafeProvider(eth) ? eth : undefined;
  }
  if (providers.length === 1) return providers[0].provider;
  const preferred = getPreferredProviderId();
  const chosen = preferred ? providers.find((p) => p.info.uuid === preferred) : undefined;
  if (chosen) return chosen.provider;
  const err = new Error('Multiple wallet providers detected');
  (err as any).name = 'ProviderSelectionRequired';
  (err as any).providers = providers.map((p) => p.info);
  throw err;
}

export async function ensureNetwork(provider: Eip1193Provider): Promise<void> {
  const expectedHex = toHexChainId();
  const current = await provider.request({ method: 'eth_chainId' });
  const currentHex = typeof current === 'string' ? current.toLowerCase() : `0x${Number(current).toString(16)}`;
  if (currentHex === expectedHex) return;
  try {
    await switchOrAddChain(provider);
  } catch {
    const e = new Error('Wrong network. Please switch to Monad.');
    (e as any).code = 4902;
    throw e;
  }
  const after = await provider.request({ method: 'eth_chainId' });
  const afterHex = typeof after === 'string' ? after.toLowerCase() : `0x${Number(after).toString(16)}`;
  if (afterHex !== expectedHex) {
    const e = new Error('Wrong network. Please switch to Monad.');
    (e as any).code = 4902;
    throw e;
  }
}

function toHexChainId(): string {
  if (!MONAD_CHAIN_ID) return '0x0';
  const raw = MONAD_CHAIN_ID.toString();
  if (raw.startsWith('0x')) return raw.toLowerCase();
  const n = parseInt(raw, 10);
  return `0x${n.toString(16)}`;
}

export async function switchOrAddChain(eth: Eip1193Provider): Promise<void> {
  const chainIdHex = toHexChainId();
  try {
    await eth.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: chainIdHex }],
    } as any);
    return;
  } catch (err) {
    const e = err as { code?: number };
    // 4902: Unrecognized chain, try adding
    if (e?.code === 4902) {
      await eth.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: chainIdHex,
          chainName: MONAD_CHAIN_NAME || 'Monad Testnet',
          rpcUrls: [MONAD_RPC_URL].filter(Boolean),
          nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
        }],
      } as any);
      return;
    }
    throw err;
  }
}


