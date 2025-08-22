import { useCallback, useEffect, useMemo, useState } from 'react';
import { BedAction, BedStage, type GameState, type GardenBed } from '../types/game';
import { calculateTimeLeft, formatTime } from '../utils/time';
import { throttle } from '../utils/throttle';
import { createRateLimiter } from '../utils/rateLimit';
import { ensureNetwork, isSafeProvider } from '../services/blockchain';
import { readFullState, useFarmContract } from '../services/contract';
import { FARM_ABI } from '../services/abi';
import { CONTRACT_ADDRESS } from '../config';
import { useAccount } from 'wagmi';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { watchContractEvent } from '@wagmi/core';
import { wagmiConfig } from '../web3/wagmi';

const RATE_LIMIT_DELAY = 500;
const MAX_ACTIONS_PER_MINUTE = 30;

function useLocalGameState(): [GameState, React.Dispatch<React.SetStateAction<GameState>>] {
  const [state, setState] = useState<GameState>(() => {
    const saved = localStorage.getItem('farmGameAsciiEmojiState');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as GameState;
        parsed.beds.forEach((bed) => {
          if (bed.timerActive && bed.timerEnd && Date.now() >= bed.timerEnd) {
            bed.timerActive = false;
            if (bed.stage === BedStage.Seed) {
              bed.stage = BedStage.Seed;
              bed.nextAction = BedAction.Water;
            } else if (bed.stage === BedStage.Growing) {
              bed.stage = BedStage.Ready;
              bed.nextAction = BedAction.Harvest;
            }
          }
        });
        return parsed;
      } catch {}
    }
    return {
      beds: [
        { stage: BedStage.Empty, nextAction: BedAction.Plant, timerActive: false },
        { stage: BedStage.Empty, nextAction: BedAction.Plant, timerActive: false },
        { stage: BedStage.Empty, nextAction: BedAction.Plant, timerActive: false },
      ],
      inventory: {},
      firstTime: true,
      expansionPurchased: false,
    };
  });
  useEffect(() => {
    localStorage.setItem('farmGameAsciiEmojiState', JSON.stringify(state));
  }, [state]);
  return [state, setState];
}

export function useGameEngine() {
  const { writePlant, writeWater, writeHarvest, writeExchangeWheat, writeBuyExpansion } = useFarmContract();
  const [gameState, setGameState] = useLocalGameState();
  const [modal, setModal] = useState<{ open: boolean; message: string } | null>(null);
  const [isDark, setIsDark] = useState(false);
  const allowAction = useMemo(() => createRateLimiter(MAX_ACTIONS_PER_MINUTE, RATE_LIMIT_DELAY), []);
  const { address } = useAccount();
  const queryClient = useQueryClient();

  // Lightweight runtime shape guard for chain state
  function isValidChainState(input: unknown): input is { beds: any[]; inventory?: Record<string, number>; expansionPurchased?: boolean } {
    if (!input || typeof input !== 'object') return false;
    const obj = input as Record<string, unknown>;
    if (!Array.isArray(obj.beds)) return false;
    if ('inventory' in obj && (typeof obj.inventory !== 'object' || obj.inventory === null)) return false;
    return true;
  }

  useEffect(() => {
    const onResize = throttle(() => {}, 200);
    window.addEventListener('resize', onResize, { passive: true } as AddEventListenerOptions);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const connect = useCallback(async () => {
    const eth = (window as any).ethereum as any;
    if (!eth || !isSafeProvider(eth)) {
      setModal({ open: true, message: 'Wallet provider not found' });
      return;
    }
    try {
      await ensureNetwork(eth);
      // Откроем модал RainbowKit из движка
      try { window.dispatchEvent(new CustomEvent('rk:openConnect')); } catch {}
    } catch {
      setModal({ open: true, message: 'Wrong network. Please switch to Monad.' });
    }
  }, [setModal]);

  const refreshFromChain = useCallback(async () => {
    const player = (address || gameState.walletAddress) as `0x${string}` | undefined;
    if (!player) return;
    await queryClient.invalidateQueries({ queryKey: ['chainState', player] });
  }, [address, gameState.walletAddress, queryClient]);

  // Centralized on-chain state via TanStack Query
  const playerAddr = (address || gameState.walletAddress) as `0x${string}` | undefined;
  const chainStateQuery = useQuery({
    queryKey: ['chainState', playerAddr],
    queryFn: async () => {
      if (!playerAddr) return null as GameState | null;
      const json = await readFullState(playerAddr);
      const parsed = JSON.parse(json);
      if (!isValidChainState(parsed)) return null;
      const s = parsed as { beds: any[]; inventory?: Record<string, number>; expansionPurchased?: boolean };
      return {
        beds: s.beds as unknown as GameState['beds'],
        inventory: s.inventory || {},
        firstTime: false,
        expansionPurchased: Boolean(s.expansionPurchased),
        walletAddress: playerAddr,
      } satisfies GameState;
    },
    enabled: Boolean(playerAddr),
    staleTime: 15_000,
  });

  // Reflect fetched chain state into local fallback state
  useEffect(() => {
    if (chainStateQuery.data) setGameState(chainStateQuery.data);
  }, [chainStateQuery.data, setGameState]);

  useEffect(() => {
    // при смене аккаунта из wagmi обновим адрес в локальном состоянии
    if (address) setGameState((s) => ({ ...s, walletAddress: address }));
    }, [address, setGameState]);

  const performAction = useCallback(
    async (id: string, bed: GardenBed) => {
      if (!allowAction()) return;
      const index = parseInt(id.split('-')[1]);
      if (Number.isNaN(index)) return;
      if (index < 0 || index >= gameState.beds.length) return;
      if (!bed.nextAction || bed.timerActive || bed.isActionInProgress) return;

      if (address) {
        try {
          await ensureNetwork((window as any).ethereum);
          const actionFn =
            bed.nextAction === BedAction.Plant
              ? writePlant
              : bed.nextAction === BedAction.Water
                ? writeWater
                : writeHarvest;
          await actionFn(index, {
            onStart: () => {
              try {
                window.dispatchEvent(
                  new CustomEvent('wallet:message', { detail: { level: 'info', message: 'Отправка транзакции…' } }),
                )
              } catch {}
            },
            onMined: () => {
              try {
                window.dispatchEvent(
                  new CustomEvent('wallet:message', { detail: { level: 'info', message: 'Транзакция подтверждена' } }),
                )
              } catch {}
            },
            onError: (msg) => {
              try {
                window.dispatchEvent(
                  new CustomEvent('wallet:message', { detail: { level: 'error', message: msg } }),
                )
              } catch {}
            },
          })
          await refreshFromChain()
        } catch {
          setModal({ open: true, message: 'Action failed. Please try again.' })
        }
      } else {
        // local fallback
        setGameState((s) => {
          const copy = structuredClone(s) as GameState;
          const b = copy.beds[index];
          if (bed.nextAction === BedAction.Plant) {
            b.stage = BedStage.Seed;
            b.nextAction = null;
            b.timerActive = true;
            b.timerEnd = Date.now() + 10_000;
          } else if (bed.nextAction === BedAction.Water) {
            b.stage = BedStage.Growing;
            b.nextAction = null;
            b.timerActive = true;
            b.timerEnd = Date.now() + 10_000;
          } else if (bed.nextAction === BedAction.Harvest) {
            b.stage = BedStage.Empty;
            b.nextAction = BedAction.Plant;
            b.timerActive = false;
            copy.inventory.wheat = (copy.inventory.wheat || 0) + 1;
          }
          return copy;
        });
      }
    },
    [address, allowAction, refreshFromChain, setGameState, gameState.beds.length, writePlant, writeWater, writeHarvest]
  );

  const exchangeWheat = useCallback(async () => {
    if (address) {
      try {
        const wheatCount = gameState.inventory.wheat || 0;
        if (wheatCount < 10) {
          setModal({ open: true, message: 'Not enough wheat to trade' });
          return;
        }
        await ensureNetwork((window as any).ethereum);
        const count = Math.floor(wheatCount / 10);
        await writeExchangeWheat(count * 10, {
          onStart: () => {
            try {
              window.dispatchEvent(
                new CustomEvent('wallet:message', { detail: { level: 'info', message: 'Отправка обмена…' } }),
              )
            } catch {}
          },
          onMined: () => {
            try {
              window.dispatchEvent(
                new CustomEvent('wallet:message', { detail: { level: 'info', message: 'Обмен подтвержден' } }),
              )
            } catch {}
          },
          onError: (msg) => {
            try {
              window.dispatchEvent(
                new CustomEvent('wallet:message', { detail: { level: 'error', message: msg } }),
              )
            } catch {}
          },
        })
        await refreshFromChain();
        setModal({ open: true, message: `You traded ${count * 10} wheat for ${count} coin(s)!` });
      } catch {
        setModal({ open: true, message: 'Exchange failed' });
      }
    } else {
      const wheatCount = gameState.inventory.wheat || 0;
      if (wheatCount < 10) {
        setModal({ open: true, message: 'Not enough wheat to trade' });
        return;
      }
      const count = Math.floor(wheatCount / 10);
      setGameState((s) => {
        const copy = structuredClone(s) as GameState;
        copy.inventory.wheat -= count * 10;
        copy.inventory.coins = (copy.inventory.coins || 0) + count;
        return copy;
      });
      setModal({ open: true, message: `You traded ${count * 10} wheat for ${count} coin(s)!` });
    }
  }, [address, gameState.inventory.wheat, refreshFromChain, setGameState, writeExchangeWheat]);

  const buyExpansion = useCallback(async () => {
    if (address) {
      try {
        await ensureNetwork((window as any).ethereum);
        await writeBuyExpansion({
          onStart: () => {
            try {
              window.dispatchEvent(
                new CustomEvent('wallet:message', { detail: { level: 'info', message: 'Покупка расширения…' } }),
              )
            } catch {}
          },
          onMined: () => {
            try {
              window.dispatchEvent(
                new CustomEvent('wallet:message', { detail: { level: 'info', message: 'Расширение куплено' } }),
              )
            } catch {}
          },
          onError: (msg) => {
            try {
              window.dispatchEvent(
                new CustomEvent('wallet:message', { detail: { level: 'error', message: msg } }),
              )
            } catch {}
          },
        })
        await refreshFromChain();
        setModal({ open: true, message: 'Expansion purchased! New beds added.' });
      } catch {
        setModal({ open: true, message: 'Buy expansion failed' });
      }
    } else {
      if (!gameState.inventory.coins || gameState.inventory.coins < 100) {
        setModal({ open: true, message: 'Not enough coins to buy expansion.' });
        return;
      }
      setGameState((s) => {
        const copy = structuredClone(s) as GameState;
        copy.inventory.coins -= 100;
        copy.expansionPurchased = true;
        for (let i = 0; i < 3; i++) {
          copy.beds.unshift({ stage: BedStage.Empty, nextAction: BedAction.Plant, timerActive: false });
        }
        return copy;
      });
      setModal({ open: true, message: 'Expansion purchased! New beds added.' });
    }
  }, [address, gameState.inventory.coins, refreshFromChain, setGameState, writeBuyExpansion]);

  const toggleTheme = useCallback(() => {
    setIsDark((d) => !d);
    // Single source of truth on body class; avoid side-effects that can block scroll
    const body = document.body;
    const willBeDark = !body.classList.contains('dark-mode');
    body.classList.toggle('dark-mode', willBeDark);
    const waves = document.querySelector('.waves') as HTMLElement | null;
    waves?.classList.toggle('dark-wave', willBeDark);
    // no toast, no extra animations — секретная смена темы
  }, []);

  const closeModal = useCallback(() => setModal({ open: false, message: '' }), []);

  const firstTime = gameState.firstTime;

  const dismissWelcome = useCallback(() => {
    if (firstTime) setGameState((s) => ({ ...s, firstTime: false }));
  }, [firstTime, setGameState]);

  const timers = useMemo(() => {
    return gameState.beds.map((b) => (b.timerActive && b.timerEnd ? calculateTimeLeft(b.timerEnd) : 0));
  }, [gameState.beds]);

  // Subscribe to StateDelta events to refresh chain state
  useEffect(() => {
    if (!address) return;
    try {
      const addr = CONTRACT_ADDRESS as `0x${string}`;
      const unwatch = watchContractEvent(wagmiConfig, {
        address: addr,
        abi: FARM_ABI as any,
        eventName: 'StateDelta' as any,
        onLogs: () => { try { void refreshFromChain(); } catch {} },
      });
      return () => { try { unwatch?.(); } catch {} };
    } catch {
      return;
    }
  }, [address, refreshFromChain]);

  return {
    gameState,
    setGameState,
    modal,
    closeModal,
    isDark,
    toggleTheme,
    connect,
    performAction,
    exchangeWheat,
    buyExpansion,
    dismissWelcome,
    timers,
    formatTime,
  } as const;
}

export default useGameEngine;

