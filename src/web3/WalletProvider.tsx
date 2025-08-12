import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { BrowserProvider, Contract, Eip1193Provider, JsonRpcSigner } from 'ethers';
import { isSafeProvider, loadEthers, connectWallet as connectWithHelpers, getInjectedProvider } from '../services/blockchain';
import { friendlyMessageForError, normalizeEip1193Error } from './errors';
import CONTRACT_ABI from '../services/abi';
import { CONTRACT_ADDRESS } from '../config';
import { buildSiweMessage, generateNonce, signSiweMessage } from './siwe';

type WalletStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export type WalletContextValue = {
  status: WalletStatus;
  address?: string;
  chainId?: string;
  provider?: BrowserProvider;
  signer?: JsonRpcSigner;
  contract?: Contract;
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
  const [provider, setProvider] = useState<BrowserProvider | undefined>(undefined);
  const [signer, setSigner] = useState<JsonRpcSigner | undefined>(undefined);
  const [contract, setContract] = useState<Contract | undefined>(undefined);
  const [balanceWei, setBalanceWei] = useState<bigint | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  const ethRef = useRef<Eip1193Provider | undefined>(undefined);
  const connectInFlight = useRef<Promise<void> | null>(null);

  const refreshBalance = useCallback(async () => {
    if (!provider || !address) return;
    try {
      const bal = await provider.getBalance(address);
      setBalanceWei(bal);
    } catch (e) {
      // do not set error state for balance failures
      console.warn('Failed to fetch balance', e);
    }
  }, [provider, address]);

  const connect = useCallback(async () => {
    if (status === 'connecting' || status === 'connected') {
      return connectInFlight.current ?? Promise.resolve();
    }
    setError(undefined);
    setStatus('connecting');
    const job = (async () => {
      try {
        const eth = getInjectedProvider();
        if (!isSafeProvider(eth) || !eth) {
          throw new Error('Wallet provider not available');
        }
        const safeEth = eth as Eip1193Provider;
        ethRef.current = safeEth;
        const ethers = await loadEthers();
        const { account, signer, provider, contract } = await connectWithHelpers(ethers, safeEth);
        // SIWE flow as part of connect (frontend-only; see README for server validation)
        const network = await provider.getNetwork();
        const chainId = Number(network.chainId);
        const nonce = generateNonce();
        const siweMessage = buildSiweMessage({
          domain: window.location.host,
          address: account,
          uri: window.location.origin,
          chainId,
          statement: 'Sign in to FarmGame on Monad',
          nonce,
        });
        await signSiweMessage(signer, siweMessage);
        setAddress(account);
        setSigner(signer);
        setProvider(provider);
        if (contract) setContract(contract);
        const chainHex = await safeEth.request({ method: 'eth_chainId' });
        setChainId(typeof chainHex === 'string' ? chainHex : String(chainHex));
        setStatus('connected');
        await refreshBalance();
      } catch (e) {
        const norm = normalizeEip1193Error(e as { code?: number; message?: string; data?: unknown; name?: string });
        const msg = friendlyMessageForError(norm);
        // eslint-disable-next-line no-console
        console.warn('Wallet connect failed', norm);
        setError(msg);
        setStatus('error');
      } finally {
        connectInFlight.current = null;
      }
    })();
    connectInFlight.current = job;
    return job;
  }, [refreshBalance, status]);

  const disconnect = useCallback(() => {
    setStatus('disconnected');
    setAddress(undefined);
    setProvider(undefined);
    setSigner(undefined);
    setContract(undefined);
    setBalanceWei(undefined);
    setChainId(undefined);
    setError(undefined);
  }, []);

  const switchNetwork = useCallback(async () => {
    // Intentionally no-op to avoid automatic network switching per requirements
    const eth = ethRef.current ?? ((window as unknown as { ethereum?: Eip1193Provider }).ethereum as Eip1193Provider | undefined);
    if (!eth) return;
    const newChain = await eth.request({ method: 'eth_chainId' });
    setChainId(typeof newChain === 'string' ? newChain : String(newChain));
  }, []);

  // Passive attach: detect existing accounts on mount without prompting
  useEffect(() => {
    const eth = getInjectedProvider();
    if (!isSafeProvider(eth)) return;
    const safeEth = eth as Eip1193Provider;
    ethRef.current = safeEth;
    (async () => {
      try {
        const accounts = (await safeEth.request({ method: 'eth_accounts' })) as string[];
        if (accounts && accounts.length > 0) {
          setStatus('connecting');
          const ethers = await loadEthers();
          const browserProvider = new ethers.BrowserProvider(safeEth);
          const signer = await browserProvider.getSigner();
          setAddress(accounts[0]);
          setSigner(signer);
          setProvider(browserProvider);
          // Create contract instance on passive attach only if address configured
          if (CONTRACT_ADDRESS && !/^0x0{40}$/i.test(CONTRACT_ADDRESS)) {
            try {
              const c = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
              setContract(c as unknown as Contract);
            } catch (err) {
              console.warn('Failed to create contract on passive attach', err);
            }
          } else {
            setContract(undefined);
          }
          const chainHex = await safeEth.request({ method: 'eth_chainId' });
          setChainId(typeof chainHex === 'string' ? chainHex : String(chainHex));
          setStatus('connected');
          await refreshBalance();
        }
      } catch (e) {
        const norm = normalizeEip1193Error(e as { code?: number; message?: string; data?: unknown; name?: string });
        console.warn('Passive wallet attach failed', norm);
      }
    })();
  }, []);

  // Listen for account and chain changes
  useEffect(() => {
    const eth = ethRef.current;
    if (!eth) return;
    const handleAccountsChanged = (accs: unknown) => {
      const list = accs as string[];
      if (!list || list.length === 0) {
        disconnect();
      } else {
        setAddress(list[0]);
        void refreshBalance();
      }
    };
    const handleChainChanged = (newChain: unknown) => {
      setChainId(typeof newChain === 'string' ? newChain : String(newChain));
      void refreshBalance();
    };
    // @ts-expect-error EIP-1193 typing for on/off is not guaranteed
    eth.on?.('accountsChanged', handleAccountsChanged);
    // @ts-expect-error EIP-1193 typing for on/off is not guaranteed
    eth.on?.('chainChanged', handleChainChanged);
    return () => {
      // @ts-expect-error EIP-1193 typing for on/off is not guaranteed
      eth.removeListener?.('accountsChanged', handleAccountsChanged);
      // @ts-expect-error EIP-1193 typing for on/off is not guaranteed
      eth.removeListener?.('chainChanged', handleChainChanged);
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

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used within WalletProvider');
  return ctx;
}


