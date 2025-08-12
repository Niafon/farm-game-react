import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BedAction, BedStage, type GameState, type GardenBed } from '../types/game';
import { calculateTimeLeft, formatTime } from '../utils/time';
import { throttle } from '../utils/throttle';
import { createRateLimiter } from '../utils/rateLimit';
import { connectWallet, ensureNetwork, isSafeProvider, loadEthers } from '../services/blockchain';

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
  const [gameState, setGameState] = useLocalGameState();
  const [modal, setModal] = useState<{ open: boolean; message: string } | null>(null);
  const [isDark, setIsDark] = useState(false);
  const allowAction = useMemo(() => createRateLimiter(MAX_ACTIONS_PER_MINUTE, RATE_LIMIT_DELAY), []);
  const contractRef = useRef<any>(null);
  const stateDeltaHandlerRef = useRef<((player: string) => Promise<void> | void) | null>(null);

  useEffect(() => {
    const onResize = throttle(() => {}, 200);
    window.addEventListener('resize', onResize, { passive: true } as AddEventListenerOptions);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const connect = useCallback(async () => {
    const ethProvider = (window as any).ethereum as any;
    if (!ethProvider) {
      setModal({ open: true, message: 'Ethereum provider not found' });
      return;
    }
    if (!isSafeProvider(ethProvider)) {
      setModal({ open: true, message: 'Unsafe provider' });
      return;
    }
    try {
      const ethers = await loadEthers();
      await ensureNetwork(ethProvider);
      const { account, contract } = await connectWallet(ethers, ethProvider);
      contractRef.current = contract;
      setGameState((s) => ({ ...s, walletAddress: account }));
      stateDeltaHandlerRef.current = async (player: string) => {
        if (player.toLowerCase() !== account.toLowerCase()) return;
        await refreshFromChain();
      };
      (contract as any).on('StateDelta', stateDeltaHandlerRef.current);
      await refreshFromChain();
      setModal({ open: true, message: 'Wallet connected!' });
    } catch (e) {
      setModal({ open: true, message: 'Wallet connection failed' });
    }
  }, [setGameState]);

  const refreshFromChain = useCallback(async () => {
    if (!contractRef.current || !gameState.walletAddress) return;
    try {
      let data: string | null = null;
      try {
        data = await contractRef.current.getFullState(gameState.walletAddress);
      } catch {}
      if (!data) {
        data = await contractRef.current.getGameState(gameState.walletAddress);
      }
      if (data) {
        const state = JSON.parse(data) as GameState;
        setGameState((s) => ({
          beds: state.beds || [],
          inventory: state.inventory || {},
          firstTime: false,
          expansionPurchased: Boolean(state.expansionPurchased),
          walletAddress: s.walletAddress,
        }));
      }
    } catch {}
  }, [gameState.walletAddress, setGameState]);

  useEffect(() => {
    return () => {
      if (contractRef.current && stateDeltaHandlerRef.current) {
        try {
          (contractRef.current as any).off('StateDelta', stateDeltaHandlerRef.current);
        } catch {}
      }
    };
  }, []);

  const performAction = useCallback(
    async (id: string, bed: GardenBed) => {
      if (!allowAction()) return;
      const index = parseInt(id.split('-')[1]);
      if (Number.isNaN(index)) return;
      if (!bed.nextAction || bed.timerActive || bed.isActionInProgress) return;

      if (contractRef.current) {
        try {
          await ensureNetwork((window as any).ethereum);
          let tx: any;
          if (bed.nextAction === BedAction.Plant) tx = await contractRef.current.plant(index);
          else if (bed.nextAction === BedAction.Water) tx = await contractRef.current.water(index);
          else if (bed.nextAction === BedAction.Harvest) tx = await contractRef.current.harvest(index);
          if (tx?.wait) await tx.wait();
          await refreshFromChain();
        } catch {
          setModal({ open: true, message: 'Action failed. Please try again.' });
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
    [allowAction, refreshFromChain, setGameState]
  );

  const exchangeWheat = useCallback(async () => {
    if (contractRef.current) {
      try {
        const wheatCount = gameState.inventory.wheat || 0;
        if (wheatCount < 10) {
          setModal({ open: true, message: 'Not enough wheat to trade' });
          return;
        }
        await ensureNetwork((window as any).ethereum);
        const count = Math.floor(wheatCount / 10);
        const tx = await contractRef.current.exchangeWheat(count * 10);
        await tx.wait();
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
  }, [gameState.inventory.wheat, refreshFromChain, setGameState]);

  const buyExpansion = useCallback(async () => {
    if (contractRef.current) {
      try {
        await ensureNetwork((window as any).ethereum);
        const tx = await contractRef.current.buyExpansion();
        await tx.wait();
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
  }, [gameState.inventory.coins, refreshFromChain, setGameState]);

  const toggleTheme = useCallback(() => {
    setIsDark((d) => !d);
  }, []);

  const closeModal = useCallback(() => setModal({ open: false, message: '' }), []);

  const firstTime = gameState.firstTime;

  const dismissWelcome = useCallback(() => {
    if (firstTime) setGameState((s) => ({ ...s, firstTime: false }));
  }, [firstTime, setGameState]);

  const timers = useMemo(() => {
    return gameState.beds.map((b) => (b.timerActive && b.timerEnd ? calculateTimeLeft(b.timerEnd) : 0));
  }, [gameState.beds]);

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

