import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { EIP1193Provider as Eip1193Provider } from 'viem';
import { isSafeProvider, getInjectedProvider, setPreferredProviderId, switchOrAddChain } from '../services/blockchain';
import { MONAD_CHAIN_ID } from '../config';
import { friendlyMessageForError, normalizeEip1193Error } from './errors';
// CONTRACT_ABI and CONTRACT_ADDRESS are no longer needed here; reads/writes go through @wagmi/core
import { buildSiweMessage, generateNonce, fetchServerNonce, verifySiweOnServer, fetchMe, serverLogout } from './siwe';
import { signMessage } from '@wagmi/core';
import { wagmiConfig } from './wagmi';
import { trackWalletEvent } from '../services/sentry';

type WalletStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export type WalletContextValue = {
  status: WalletStatus;
  address?: string;
  chainId?: string;
  provider?: unknown;
  signer?: unknown;
  contract?: unknown;
  balanceWei?: bigint;
  error?: string;
  connect: () => Promise<void>;
  disconnect: () => void;
  refreshBalance: () => Promise<void>;
  switchNetwork: () => Promise<void>;
};

const WalletContext = createContext<WalletContextValue | undefined>(undefined);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<WalletStatus>('disconnected');
  const [address, setAddress] = useState<string | undefined>(undefined);
  const [chainId, setChainId] = useState<string | undefined>(undefined);
  const [provider, setProvider] = useState<unknown>(undefined);
  const [signer, setSigner] = useState<unknown>(undefined);
  const [contract, setContract] = useState<unknown>(undefined);
  const [balanceWei, setBalanceWei] = useState<bigint | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  const ethRef = useRef<Eip1193Provider | undefined>(undefined);
  const connectInFlight = useRef<Promise<void> | null>(null);

  const refreshBalance = useCallback(async () => {
    // Defer balance reads to wagmi hooks elsewhere; keep no-op to avoid extra providers
    return;
  }, []);

  const connect = useCallback(async () => {
    if (status === 'connecting' || status === 'connected') {
      return connectInFlight.current ?? Promise.resolve();
    }
    setError(undefined);
    setStatus('connecting');
    
    // Track connection attempt
    trackWalletEvent('connect_attempt');
    
    const job = (async () => {
      try {
        const eth = await getInjectedProvider();
        if (!isSafeProvider(eth) || !eth) {
          throw new Error('Wallet provider not available');
        }
        const safeEth = eth as Eip1193Provider;
        ethRef.current = safeEth;
        const [account] = await safeEth.request({ method: 'eth_requestAccounts' }) as string[];
        // Enforce Monad only
        await switchOrAddChain(safeEth);
        const ch1 = await safeEth.request({ method: 'eth_chainId' });
        const chainId = Number(typeof ch1 === 'string' ? parseInt(ch1, 16) : ch1);
        const nonce = (await fetchServerNonce()) || generateNonce();
        const siweMessage = buildSiweMessage({
          domain: window.location.host,
          address: account,
          uri: window.location.origin,
          chainId,
          statement: 'Sign in to FarmGame on Monad',
          nonce,
        });
        const signature = await signMessage(wagmiConfig, { message: siweMessage, account: account as `0x${string}` });
        // Best-effort server verification if backend exists
        const ok = await verifySiweOnServer({ address: account, message: siweMessage, signature }).catch(() => false)
        if (ok) {
          const me = await fetchMe().catch(() => null)
          if (!me?.ok || (me?.address?.toLowerCase() !== account.toLowerCase())) {
            throw new Error('SIWE session mismatch')
          }
        }
        setAddress(account);
        setSigner(undefined);
        setProvider(undefined);
        setContract(undefined);
        const ch2 = await safeEth.request({ method: 'eth_chainId' });
        setChainId(typeof ch2 === 'string' ? ch2 : String(ch2));
        setStatus('connected');
        
        // Track successful connection
        trackWalletEvent('connect_success', {
          walletType: (safeEth as any)?.isMetaMask ? 'metamask' : 'unknown',
          chainId: typeof ch2 === 'string' ? ch2 : String(ch2)
        });
        
        await refreshBalance();
      } catch (e) {
        const norm = normalizeEip1193Error(e as { code?: number; message?: string; data?: unknown; name?: string });
        const msg = friendlyMessageForError(norm);
        console.warn('Wallet connect failed', norm);
        setError(msg);
        setStatus('error');
        
        // Track connection failure
        trackWalletEvent('connect_failed', {
          error: msg
        });
        // If multiple providers detected, surface selection event payload
        if ((e as any)?.name === 'ProviderSelectionRequired' && (e as any)?.providers) {
          try {
            const evt = new CustomEvent('wallet:providers', { detail: { providers: (e as any).providers } });
            window.dispatchEvent(evt);
          } catch {}
        }
        try {
          const evt = new CustomEvent('wallet:message', {
            detail: {
              level: norm.code === -32002 ? 'info' : (norm.code === 4001 ? 'warning' : 'error'),
              message: msg,
              code: norm.code,
            },
          });
          window.dispatchEvent(evt);
        } catch {}
      } finally {
        connectInFlight.current = null;
      }
    })();
    connectInFlight.current = job;
    return job;
  }, [refreshBalance, status]);

  const disconnect = useCallback(() => {
    void serverLogout();
    setStatus('disconnected');
    setAddress(undefined);
    setProvider(undefined);
    setSigner(undefined);
    setContract(undefined);
    setBalanceWei(undefined);
    setChainId(undefined);
    setError(undefined);
    
    // Track disconnection
    trackWalletEvent('disconnect');
  }, []);

  const switchNetwork = useCallback(async () => {
    const eth = ethRef.current ?? ((window as unknown as { ethereum?: Eip1193Provider }).ethereum as Eip1193Provider | undefined);
    if (!eth) return;
    await switchOrAddChain(eth);
    const newChain = await eth.request({ method: 'eth_chainId' });
    setChainId(typeof newChain === 'string' ? newChain : String(newChain));
  }, []);

  // Passive attach: detect existing accounts on mount without prompting
  useEffect(() => {
    let safeEth: Eip1193Provider | undefined;
    // Best-effort: do not throw on multi-provider here; only attach if singular
    (async () => {
      try {
        const eth = await getInjectedProvider();
        if (!isSafeProvider(eth)) return;
        safeEth = eth as Eip1193Provider;
        ethRef.current = safeEth;
      } catch {
        // If selection needed, ignore in passive attach
        return;
      }
      if (!safeEth) return;
      try {
        const accounts = (await safeEth.request({ method: 'eth_accounts' })) as string[];
        if (accounts && accounts.length > 0) {
          setStatus('connecting');
          setAddress(accounts[0]);
          setSigner(undefined);
          setProvider(undefined);
          setContract(undefined);
          const chainHex = await safeEth.request({ method: 'eth_chainId' });
          const currentHex = typeof chainHex === 'string' ? chainHex.toLowerCase() : String(chainHex);
          setChainId(currentHex);
          const expected = MONAD_CHAIN_ID?.toString?.() || '';
          const expectedHex = expected.startsWith('0x') ? expected.toLowerCase() : `0x${parseInt(expected || '0', 10).toString(16)}`;
          if (expectedHex && currentHex !== expectedHex) {
            // Do not auto-switch in passive mode; stay disconnected and notify UI
            setStatus('disconnected');
            setAddress(undefined);
            setProvider(undefined);
            setSigner(undefined);
            setContract(undefined);
            setBalanceWei(undefined);
            try {
              const evt = new CustomEvent('wallet:message', { detail: { level: 'warning', message: 'Переключите сеть на Monad чтобы продолжить.' } });
              window.dispatchEvent(evt);
            } catch {}
            return;
          }
          setStatus('connected');
          await refreshBalance();
        }
      } catch (e) {
        const norm = normalizeEip1193Error(e as { code?: number; message?: string; data?: unknown; name?: string });
        console.warn('Passive wallet attach failed', norm);
      }
    })();
  }, [refreshBalance]);

  // Allow external UI to set preferred provider id (from EIP-6963 list)
  useEffect(() => {
    const onPick = (e: Event) => {
      const ce = e as CustomEvent<{ uuid: string } | undefined>;
      if (!ce?.detail?.uuid) return;
      setPreferredProviderId(ce.detail.uuid);
    };
    const onOpenConnect = () => {
      try {
        const evt = new CustomEvent('rk:openConnect');
        window.dispatchEvent(evt);
      } catch {}
    };
    window.addEventListener('wallet:pickProvider', onPick as EventListener);
    window.addEventListener('wallet:openConnect', onOpenConnect as EventListener);
    return () => {
      window.removeEventListener('wallet:pickProvider', onPick as EventListener);
      window.removeEventListener('wallet:openConnect', onOpenConnect as EventListener);
    };
  }, []);

  // Listen for account and chain changes
  useEffect(() => {
    const eth = ethRef.current;
    if (!eth) return;
    const handleAccountsChanged = (accs: unknown) => {
      const list = accs as string[];
      if (!list || list.length === 0) {
        void serverLogout();
        disconnect();
      } else {
        const next = list[0]
        // If switched account, ensure server session is for this address
        void (async () => {
          const me = await fetchMe()
          if (!me?.ok || me.address?.toLowerCase() !== next.toLowerCase()) {
            await serverLogout().catch(() => {})
          }
        })()
        setAddress(next);
        void refreshBalance();
      }
    };
    const handleChainChanged = (newChain: unknown) => {
      const next = typeof newChain === 'string' ? newChain.toLowerCase() : String(newChain);
      setChainId(next);
      const expected = MONAD_CHAIN_ID?.toString?.() || '';
      const expectedHex = expected.startsWith('0x') ? expected.toLowerCase() : `0x${parseInt(expected || '0', 10).toString(16)}`;
      if (expectedHex && next !== expectedHex) {
        // Hard block on non-Monad networks
        try {
          const evt = new CustomEvent('wallet:message', { detail: { level: 'warning', message: 'Эта dApp работает только в сети Monad. Переключите сеть.' } });
          window.dispatchEvent(evt);
        } catch {}
        disconnect();
        return;
      }
      void refreshBalance();
    };
    const handleDisconnect = () => {
      disconnect();
    };
    (eth as any).on?.('accountsChanged', handleAccountsChanged as any);
    (eth as any).on?.('chainChanged', handleChainChanged as any);
    (eth as any).on?.('disconnect', handleDisconnect as any);
    return () => {
      (eth as any).removeListener?.('accountsChanged', handleAccountsChanged as any);
      (eth as any).removeListener?.('chainChanged', handleChainChanged as any);
      (eth as any).removeListener?.('disconnect', handleDisconnect as any);
    };
  }, [disconnect, refreshBalance]);

  const value = useMemo<WalletContextValue>(() => ({
    status,
    address,
    chainId,
    provider,
    signer,
    contract,
    balanceWei,
    error,
    connect,
    disconnect,
    refreshBalance,
    switchNetwork,
  }), [status, address, chainId, provider, signer, contract, balanceWei, error, connect, disconnect, refreshBalance, switchNetwork]);

  // Expose minimal bridge for non-React game engine and dispatch events
  useEffect(() => {
    (window as unknown as { walletBridge?: unknown }).walletBridge = {
      connect,
      disconnect,
      switchNetwork,
      refreshBalance,
      getState: () => ({ status, address, chainId, provider, signer, contract, balanceWei, error }),
    };
    const evt = new CustomEvent('wallet:update');
    window.dispatchEvent(evt);
  }, [status, address, chainId, provider, signer, contract, balanceWei, error, connect, disconnect, refreshBalance, switchNetwork]);

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used within WalletProvider');
  return ctx;
}


