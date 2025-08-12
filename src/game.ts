/**
 * Game engine and blockchain integration for the ASCII farm.
 * Handles garden bed actions, inventory, wallet connection and
 * persistence of game state both locally and on-chain.
 */
import { BedAction, BedStage, type GameState, type GardenBed } from './types/game'

import type { BrowserProvider, Contract, Eip1193Provider, Signer } from 'ethers'
import React from 'react'
import { createRoot } from 'react-dom/client'
import { CONTRACT_ADDRESS } from './config'
// Timer formatting handled by React BedTimer
import { deriveNextAction } from './utils/bed'
import { throttle } from './utils/throttle'
import { createRateLimiter } from './utils/rateLimit'
import { loadEthers as loadEthersModule, ensureNetwork } from './services/blockchain'
import { Coalescer } from './utils/coalesce'
import { withBackoff } from './utils/backoff'

declare global {
    interface Window {
        ethereum?: Eip1193Provider
    }
}

import CONTRACT_ABI from './services/abi'
import Bed from './components/Bed'

// Security constants
const MAX_RETRIES = 3;
const RATE_LIMIT_DELAY = 500; // ms
const MAX_ACTIONS_PER_MINUTE = 30;


let instance: FarmGame | null = null;

/**
 * Bootstraps the FarmGame singleton and ensures it only
 * initializes after the DOM is ready.
 */
export function initializeGame(): FarmGame {
    const start = () => {
        if (!instance) {
            instance = new FarmGame();
        }
        return instance;
    };
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
    return instance!;
}

/**
 * Main gameplay controller. Manages UI interactions,
 * timing of bed actions and synchronization with the blockchain.
 */
class FarmGame {
    private gameState: GameState;
    private provider?: BrowserProvider;
    private signer?: Signer;
    private contract?: Contract;
    private onStateDeltaHandler?: (player: string) => Promise<void> | void;
    private useOnChainActions = true;
    private readonly scrollThreshold = 10;
    private scrollDownCount = 0;
    // Inventory DOM is managed by React
    // Removed: inventory list is managed fully by React
    private gardenBedsContainer: HTMLElement;
    private welcomeModal: HTMLElement;
    private startGameBtn: HTMLButtonElement;
    private exchangeButton: HTMLButtonElement;
    private expansionButton: HTMLButtonElement;
    private walletButton: HTMLButtonElement;
    private allowAction = createRateLimiter(MAX_ACTIONS_PER_MINUTE, RATE_LIMIT_DELAY);
    private isProcessingAction = false;
    private boundHandleScroll: () => void;
    private boundGenerateWaves: () => void;
    private boundExchangeWheat: () => void;
    private boundBuyExpansion: () => void;
    private boundConnectWallet: () => void;
    private throttledResize?: () => void;

    private lastChainSaveMs = 0;
    private chainSaveCooldownMs = 120000; // 2 minutes
    private lastFocusedElement: HTMLElement | null = null;
    private modalKeydownHandler?: (e: KeyboardEvent) => void;
    private bedsUseReact = false;
    private bedsInitialized = false;
    private stateCoalescer = new Coalescer();
    private pollIntervalId?: number;

    // Rate limiting and security checks
    private checkRateLimit = (): boolean => {
        return this.allowAction();
    };

    private deriveNextAction(bed: GardenBed): BedAction | null { return deriveNextAction(bed); }

    // security/network helpers moved to services/blockchain

    // Retry mechanism for blockchain operations
    private async retryOperation<T>(
        operation: () => Promise<T>,
        retries = MAX_RETRIES,
        baseDelayMs = 500
    ): Promise<T> {
        let attempt = 0;
        // eslint-disable-next-line no-constant-condition
        while (true) {
            try {
                return await operation();
            } catch (error) {
                if (attempt >= retries) throw error;
                const jitter = Math.floor(Math.random() * 100);
                const delay = baseDelayMs * (2 ** attempt) + jitter;
                await new Promise(resolve => setTimeout(resolve, delay));
                attempt++;
            }
        }
    }

    constructor() {
        this.gameState = this.loadGameState();
        // Inventory list is managed by React
        this.gardenBedsContainer = document.getElementById('garden-beds') as HTMLElement;
        this.welcomeModal = document.getElementById('welcome-modal') as HTMLElement;
        this.startGameBtn = document.getElementById('start-game') as HTMLButtonElement;
        this.exchangeButton = document.getElementById('exchange-wheat') as HTMLButtonElement;
        this.expansionButton = document.getElementById('buy-expansion') as HTMLButtonElement;
        this.walletButton = document.getElementById('wallet-connect') as HTMLButtonElement;

        // Bind methods to preserve context
        this.boundHandleScroll = this.handleScroll.bind(this);
        this.boundGenerateWaves = this.generateWaves.bind(this);
        this.boundExchangeWheat = this.exchangeWheat.bind(this);
        this.boundBuyExpansion = this.buyExpansion.bind(this);
        this.boundConnectWallet = this.connectWallet.bind(this);

        this.setupInventoryModule();
        this.setupShopModule();

        this.initializeGardenBeds();
        this.updateInventory();

        if (this.gameState.firstTime) {
            this.welcomeModal.classList.add('open');
            this.gameState.firstTime = false;
            this.saveGameState();
        }

        this.startGameBtn.addEventListener('click', () => {
            this.welcomeModal.classList.remove('open');
        });

        this.exchangeButton.addEventListener('click', this.boundExchangeWheat);
        this.expansionButton.addEventListener('click', this.boundBuyExpansion);
        this.walletButton.addEventListener('click', () => {
            const bridge = (window as unknown as { walletBridge?: any }).walletBridge;
            const addr = (bridge?.getState?.()?.address as string | undefined) ?? this.gameState.walletAddress;
            if (!addr && bridge?.connect) {
                void bridge.connect();
            }
            // No menu toggle per requirements
        });
        const disconnectBtn = document.getElementById('wallet-disconnect');
        disconnectBtn?.addEventListener('click', () => {
            const bridge = (window as unknown as { walletBridge?: any }).walletBridge;
            if (bridge?.disconnect) {
                bridge.disconnect();
            }
            // Ensure local cleanup always happens
            this.disconnectWallet();
        });
        window.addEventListener('scroll', this.boundHandleScroll, { passive: true } as AddEventListenerOptions);
        this.throttledResize = throttle(this.boundGenerateWaves, 200);
        window.addEventListener('resize', this.throttledResize, { passive: true } as AddEventListenerOptions);
        this.generateWaves();
        this.installDisconnectedGuards();

        // When any timer reaches 0, refresh state consistently
        window.addEventListener('timer:end', (e: Event) => {
            const ce = e as CustomEvent<{ index: number }>;
            const i = ce.detail?.index;
            if (typeof i !== 'number') return;
            if (this.useOnChainActions) {
                void (async () => {
                    await this.loadGameStateOnChain();
                    this.saveGameState();
                    this.emitBedUpdate(i);
                    this.updateInventory();
                })();
            } else {
                const bed = this.gameState.beds[i];
                if (bed) {
                    bed.timerActive = false;
                    if (bed.stage === BedStage.Seed) {
                        bed.nextAction = BedAction.Water;
                    } else if (bed.stage === BedStage.Growing) {
                        bed.stage = BedStage.Ready;
                        bed.nextAction = BedAction.Harvest;
                    }
                    this.saveGameState();
                    this.emitBedUpdate(i);
                    this.updateInventory();
                }
            }
        });

        // Subscribe to WalletProvider updates to keep in sync
        window.addEventListener('wallet:update', () => {
            const bridge = (window as unknown as { walletBridge?: any }).walletBridge;
            if (!bridge) return;
            const state = bridge.getState?.();
            const addr = state?.address as string | undefined;
            if (addr && addr !== this.gameState.walletAddress) {
                // Attached via provider: reflect address and force on-chain sync
                this.gameState.walletAddress = addr;
                this.provider = state?.provider;
                this.signer = state?.signer;
                this.contract = state?.contract;
                void (async () => {
                    await this.loadGameStateOnChain();
                    this.saveGameState();
                    await this.updateWalletBalanceUi();
                    this.updateWalletUi();
                    this.initializeGardenBeds();
                    this.updateInventory();
                    this.attachContractEventListeners();
                })();
            }
            if (!addr && this.gameState.walletAddress) {
                // Disconnected via provider: mirror local disconnect
                this.disconnectWallet();
            }
            this.updateAvailabilityBasedOnWallet();
        });
        this.updateWalletUi();
        this.updateAvailabilityBasedOnWallet();
        this.setupStatePolling();
        // Expose minimal gameBridge for React components
        (window as unknown as { gameBridge?: any }).gameBridge = {
            getInventory: () => ({ ...this.gameState.inventory }),
            getBed: (i: number) => this.gameState.beds[i],
            performAction: (i: number) => {
                const bed = this.gameState.beds[i];
                const id = `bed-${i}`;
                this.performAction(id, bed);
            },
            disconnect: () => this.disconnectWallet(),
        };
        // Preload ethers for faster first connect
        void loadEthersModule();
    }

    public cleanup(): void {
        // Remove event listeners
        window.removeEventListener('scroll', this.boundHandleScroll);
        if (this.throttledResize) {
            window.removeEventListener('resize', this.throttledResize);
            this.throttledResize = undefined;
        }
        this.exchangeButton.removeEventListener('click', this.boundExchangeWheat);
        this.expansionButton.removeEventListener('click', this.boundBuyExpansion);
        this.walletButton.removeEventListener('click', this.boundConnectWallet);
        document.documentElement.removeAttribute('style');

        // Detach contract listeners to prevent memory leaks
        if (this.contract) {
            try {
                if (this.onStateDeltaHandler) {
                    // Prefer targeted off when possible
                    (this.contract as unknown as { off: (event: string, handler: (player: string) => void) => void }).off?.('StateDelta', this.onStateDeltaHandler as (player: string) => void);
                }
                (this.contract as unknown as { removeAllListeners?: (event?: string) => void }).removeAllListeners?.('StateDelta');
            } catch {
                // ignore
            }
        }

        // Remove modal keydown trap if present
        if (this.modalKeydownHandler) {
            document.removeEventListener('keydown', this.modalKeydownHandler);
            this.modalKeydownHandler = undefined;
        }

        // Cancel any active requestAnimationFrame timers
        document.querySelectorAll('.timer').forEach((el) => {
            const elem = el as HTMLElement & { _rafId?: number };
            if (typeof elem._rafId === 'number') {
                cancelAnimationFrame(elem._rafId);
                delete elem._rafId;
            }
        });

        // Clear any pending blockchain operations
        this.isProcessingAction = false;
    }

    // ASCII kept historically; not used in React-only mode
    // removed unused ASCII art (React-only mode)

    private initializeGardenBeds = (): void => {
        if (this.bedsInitialized && this.bedsUseReact) {
            // Already mounted via React; just emit updates for current state
            this.gameState.beds.forEach((_bedData, i) => this.emitBedUpdate(i));
            return;
        }
        // React-only render of beds
        this.gardenBedsContainer.innerHTML = '';
        this.gameState.beds.forEach((_bedData, i) => {
            const container = document.createElement('div');
            this.gardenBedsContainer.appendChild(container);
            const root = createRoot(container);
            root.render(React.createElement(Bed as unknown as React.FC<{ index: number }>, { index: i }));
            this.bedsUseReact = true;
            this.emitBedUpdate(i);
        });
        this.bedsInitialized = true;
    };

    private updateBed = (index: number): void => {
        const oldBed = document.getElementById(`bed-${index}`);
        if (!oldBed) return;
        this.emitBedUpdate(index);
    };

    // Legacy DOM bed creation removed in React-only render path

    private emitBedUpdate(index: number): void {
        const detail = { index, bed: this.gameState.beds[index] };
        const evt = new CustomEvent('bed:update', { detail });
        window.dispatchEvent(evt);
    }

    // getPlantAriaLabel moved to utils/bed

    // getActionAriaLabel handled by React BedActionIcon

    // getPlantEmoji moved to utils/bed

    // getActionEmoji handled by React BedActionIcon

    private performAction = async (bedId: string, bedData: GardenBed): Promise<void> => {
        if (this.isProcessingAction || !this.checkRateLimit()) {
            return;
        }

        try {
            this.isProcessingAction = true;
            const index = parseInt(bedId.split('-')[1]);
            if (isNaN(index)) return;

            // Validate action
            const derived = this.deriveNextAction(bedData);
            if (!derived || bedData.isActionInProgress) return;

            // Perform action with retry mechanism
            await this.retryOperation(async () => {
                this.gameState.beds[index].isActionInProgress = true;

                // Do not animate or change UI until user confirms the tx

                // Execute on-chain tx and refresh authoritative state
                const executeAndRefresh = async (): Promise<void> => {
                    if (this.useOnChainActions) {
                        if (!this.contract) {
                            this.showCustomModal('Connect wallet first');
                            return;
                        }
                        // ensure correct chain
                        await ensureNetwork(window.ethereum as Eip1193Provider);
                        // Send tx based on action
                        let tx: unknown;
                        // Derive action at execution time to avoid stale local state
                        const actionToExecute = this.deriveNextAction(this.gameState.beds[index]);
                        if (!actionToExecute) {
                            return;
                        }
                        switch (actionToExecute) {
                            case BedAction.Plant:
                                tx = await (this.contract as unknown as { plant: (i: number) => Promise<{ wait: () => Promise<unknown> }> }).plant(index);
                                break;
                            case BedAction.Water:
                                tx = await (this.contract as unknown as { water: (i: number) => Promise<{ wait: () => Promise<unknown> }> }).water(index);
                                break;
                            case BedAction.Harvest:
                                tx = await (this.contract as unknown as { harvest: (i: number) => Promise<{ wait: () => Promise<unknown> }> }).harvest(index);
                                break;
                        }
                        if (tx && typeof (tx as { wait?: unknown }).wait === 'function') {
                            await (tx as { wait: () => Promise<unknown> }).wait();
                        }
                        // Load state from chain after confirmation
                        await this.loadGameStateOnChain();
                        this.saveGameState();
                        this.updateBed(index);
                        this.updateInventory();
                    } else {
                        // Fallback local-only update (legacy)
                        switch (bedData.nextAction) {
                            case BedAction.Plant:
                                this.gameState.beds[index].stage = BedStage.Seed;
                                this.gameState.beds[index].nextAction = null;
                                this.gameState.beds[index].timerActive = true;
                                this.gameState.beds[index].timerEnd = Date.now() + (10 * 1000);
                                break;
                            case BedAction.Water:
                                this.gameState.beds[index].stage = BedStage.Growing;
                                this.gameState.beds[index].nextAction = null;
                                this.gameState.beds[index].timerActive = true;
                                this.gameState.beds[index].timerEnd = Date.now() + (10 * 1000);
                                break;
                            case BedAction.Harvest:
                                this.gameState.beds[index].stage = BedStage.Empty;
                                this.gameState.beds[index].nextAction = BedAction.Plant;
                                this.gameState.beds[index].timerActive = false;
                                if (!this.gameState.inventory.wheat) {
                                    this.gameState.inventory.wheat = 0;
                                }
                                this.gameState.inventory.wheat += 1;
                                break;
                        }
                        this.saveGameState();
                        this.updateBed(index);
                        this.updateInventory();
                    }
                };

                // Optimistic UI update helper for instant feedback
                // Determine intended action BEFORE optimistic update
                let actionPlanned = this.deriveNextAction(bedData);

        // removed optimistic update to align with UX: update after tx confirmation only

                // Run the transaction without optimistic UI; update only after confirmation
                setTimeout(() => {
                    void (async () => {
                        try {
                            await (async (): Promise<void> => {
                                if (this.useOnChainActions) {
                                    if (!this.contract || !actionPlanned) return;
                                    // For harvest, preflight refresh from chain and validate readiness
                                    if (actionPlanned === BedAction.Harvest) {
                                        await this.loadGameStateOnChain();
                                        const latest = this.gameState.beds[index];
                                        const canHarvest = latest.stage === BedStage.Ready && !latest.timerActive;
                                        if (!canHarvest) {
                                            throw new Error('Not ready to harvest yet');
                                        }
                                    }
                                    let tx: unknown;
                                    switch (actionPlanned) {
                                        case BedAction.Plant:
                                            tx = await (this.contract as unknown as { plant: (i: number) => Promise<{ wait: () => Promise<unknown> }> }).plant(index);
                                            break;
                                        case BedAction.Water:
                                            tx = await (this.contract as unknown as { water: (i: number) => Promise<{ wait: () => Promise<unknown> }> }).water(index);
                                            break;
                                        case BedAction.Harvest:
                                            // Some wallets require gas limit hints; provide a gentle buffer
                                            tx = await (this.contract as unknown as { harvest: (i: number, overrides?: unknown) => Promise<{ wait: () => Promise<unknown> }> }).harvest(index, { /* gasLimit hint optional */ });
                                            break;
                                    }
                                    if (!tx || typeof (tx as { wait?: unknown }).wait !== 'function') return;
                                    // Start pending immediately after signature; timer will start only after tx mined
                                    this.gameState.beds[index].isActionInProgress = true;
                                    this.emitBedUpdate(index);
                                    await (tx as { wait: () => Promise<unknown> }).wait();
                                    // After wait, refresh and also re-derive actionPlanned for safety
                                    await this.loadGameStateOnChain();
                                    this.saveGameState();
                                    // Start local timer after successful on-chain confirmation for Plant/Water
                                    if (actionPlanned === BedAction.Plant || actionPlanned === BedAction.Water) {
                                        this.gameState.beds[index].timerActive = true;
                                        this.gameState.beds[index].timerEnd = Date.now() + (10 * 1000);
                                    }
                                    // let React re-render via event
                                    this.updateInventory();
                                    this.emitBedUpdate(index);
                                    actionPlanned = this.deriveNextAction(this.gameState.beds[index]);
                                } else {
                                    await executeAndRefresh();
                                }
                            })();
                        } catch (err) {
                            // In case of failure, reload from chain to reconcile state
                            console.warn('Tx failed, reconciling from chain', err);
                            const msg = (err as Error)?.message || 'Transaction failed';
                            if (/Not ready to harvest/i.test(msg) || /cannot harvest/i.test(msg)) {
                                this.showCustomModal('Crop is not ready yet. Please wait a bit more.');
                            }
                            // Revert any pending state if set
                            if (this.gameState.beds[index].isActionInProgress) {
                                this.gameState.beds[index].isActionInProgress = false;
                                this.gameState.beds[index].timerActive = false;
                                this.gameState.beds[index].timerEnd = undefined;
                            }
                            await this.loadGameStateOnChain();
                            this.saveGameState();
                            // let React re-render via event
                            this.updateInventory();
                            this.emitBedUpdate(index);
                        }
                    })();
                }, 300);
            });
        } catch (error) {
            console.error('Action failed:', error);
            this.showCustomModal('Action failed. Please try again.');
        } finally {
            this.isProcessingAction = false;
        }
    };

    // Timer managed by React BedTimer

    // calculateTimeLeft and formatTime moved to ./utils/time

    private updateInventory = (): void => {
        // Dispatch event so React inventory can re-render
        const event = new CustomEvent('inventory:update', { detail: { ...this.gameState.inventory } });
        window.dispatchEvent(event);
    };

    // getItemName no longer needed; inventory UI handled by React

    private loadGameState = (): GameState => {
        // On principle: on-chain is the only source of truth.
        // Local storage may only preserve minimal UX flags (e.g. firstTime), never inventory/beds.
        let firstTime = true;
        try {
            const raw = localStorage.getItem('farmGameAsciiEmojiState');
            if (raw) {
                const parsed = JSON.parse(raw) as Partial<GameState>;
                if (typeof parsed.firstTime === 'boolean') firstTime = parsed.firstTime;
            }
        } catch (err) {
            console.warn('Failed to read minimal local state', err);
        }
        return {
            beds: [
                { stage: BedStage.Empty, nextAction: BedAction.Plant, timerActive: false },
                { stage: BedStage.Empty, nextAction: BedAction.Plant, timerActive: false },
                { stage: BedStage.Empty, nextAction: BedAction.Plant, timerActive: false }
            ],
            inventory: {},
            firstTime,
            expansionPurchased: false
        };
    };

    private saveGameState = (): void => {
        // Persist only minimal UX flags locally when wallet is NOT connected.
        if (!this.gameState.walletAddress) {
            const minimal = { firstTime: this.gameState.firstTime };
            localStorage.setItem('farmGameAsciiEmojiState', JSON.stringify(minimal));
        }
        // When local-only mode enabled, optionally push whole state on-chain (legacy compatibility)
        if (!this.useOnChainActions) {
            void this.maybeSaveGameStateOnChain();
        }
    };

    private exchangeWheat = async (): Promise<void> => {
        const wheatCount = this.gameState.inventory.wheat || 0;
        if (wheatCount < 10) {
            this.showCustomModal('Not enough wheat to trade');
            return;
        }
        if (this.useOnChainActions) {
            if (!this.contract) {
                this.showCustomModal('Connect wallet first');
                return;
            }
            try {
                await ensureNetwork(window.ethereum as Eip1193Provider);
                const exchangeCount = Math.floor(wheatCount / 10);
                const tx = await (this.contract as unknown as { exchangeWheat: (amount: number) => Promise<{ wait: () => Promise<unknown> }> }).exchangeWheat(exchangeCount * 10);
                await tx.wait();
                await this.loadGameStateOnChain();
                this.saveGameState();
                this.updateInventory();
                this.showCustomModal(`You traded ${exchangeCount * 10} wheat for ${exchangeCount} coin(s)!`);
            } catch (err) {
                console.warn('Exchange failed', err);
                const msg = (err as Error)?.message || '';
                if (/not enough wheat/i.test(msg)) {
                    this.showCustomModal('Not enough wheat on-chain. Harvest more first.');
                } else {
                    this.showCustomModal('Exchange failed');
                }
            }
        } else {
            const exchangeCount = Math.floor(wheatCount / 10);
            const coinsToAdd = exchangeCount;
            this.gameState.inventory.wheat -= exchangeCount * 10;
            if (!this.gameState.inventory.coins) {
                this.gameState.inventory.coins = 0;
            }
            this.gameState.inventory.coins += coinsToAdd;
            this.showCustomModal(`You traded ${exchangeCount * 10} wheat for ${coinsToAdd} coin(s)!`);
            this.saveGameState();
            this.updateInventory();
        }
    };

    private buyExpansion = async (): Promise<void> => {
        if (this.gameState.expansionPurchased) {
            this.showCustomModal('Expansion already purchased.');
            return;
        }
        if (this.useOnChainActions) {
            if (!this.contract) {
                this.showCustomModal('Connect wallet first');
                return;
            }
            try {
                await ensureNetwork(window.ethereum as Eip1193Provider);
                const tx = await (this.contract as unknown as { buyExpansion: () => Promise<{ wait: () => Promise<unknown> }> }).buyExpansion();
                await tx.wait();
                await this.loadGameStateOnChain();
                this.saveGameState();
                this.initializeGardenBeds();
                this.updateInventory();
                this.expansionButton.textContent = 'Expansion sold out';
                this.expansionButton.disabled = true;
                this.showCustomModal('Expansion purchased! New beds added.');
            } catch (err) {
                console.warn('Buy expansion failed', err);
                this.showCustomModal('Buy expansion failed');
            }
        } else {
            if (!this.gameState.inventory.coins || this.gameState.inventory.coins < 100) {
                this.showCustomModal('Not enough coins to buy expansion.');
                return;
            }
            this.gameState.inventory.coins -= 100;
            this.gameState.expansionPurchased = true;
            for (let i = 0; i < 3; i++) {
                this.gameState.beds.unshift({ stage: BedStage.Empty, nextAction: BedAction.Plant, timerActive: false });
            }
            this.saveGameState();
            this.initializeGardenBeds();
            this.updateInventory();
            this.expansionButton.textContent = 'Expansion sold out';
            this.expansionButton.disabled = true;
            this.showCustomModal('Expansion purchased! New beds added.');
        }
    };

    private showCustomModal = (message: string, buttonText = 'OK', callback?: () => void): void => {
        const modal = document.getElementById('custom-modal') as HTMLElement | null;
        const messageElem = document.getElementById('custom-modal-message') as HTMLElement | null;
        const btn = document.getElementById('custom-modal-button') as HTMLButtonElement | null;

        if (messageElem) messageElem.textContent = message;
        if (btn) btn.textContent = buttonText;
        if (modal) {
            modal.classList.add('open');
            modal.setAttribute('aria-hidden', 'false');
            // focus management
            this.lastFocusedElement = (document.activeElement as HTMLElement) || null;
        }
        if (btn) {
            btn.setAttribute('aria-label', 'Close dialog');
            btn.focus();
        }
        // Escape and simple focus trap
        this.modalKeydownHandler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                if (modal) modal.classList.remove('open');
                modal?.setAttribute('aria-hidden', 'true');
                if (this.lastFocusedElement) {
                    this.lastFocusedElement.focus();
                    this.lastFocusedElement = null;
                }
                if (this.modalKeydownHandler) {
                    document.removeEventListener('keydown', this.modalKeydownHandler);
                    this.modalKeydownHandler = undefined;
                }
                if (callback) callback();
            } else if (e.key === 'Tab') {
                // keep focus on the single button
                if (btn) {
                    e.preventDefault();
                    btn.focus();
                }
            }
        };
        document.addEventListener('keydown', this.modalKeydownHandler);
        if (btn) {
            btn.onclick = () => {
                if (modal) modal.classList.remove('open');
                modal?.setAttribute('aria-hidden', 'true');
                if (this.modalKeydownHandler) {
                    document.removeEventListener('keydown', this.modalKeydownHandler);
                    this.modalKeydownHandler = undefined;
                }
                if (this.lastFocusedElement) {
                    this.lastFocusedElement.focus();
                    this.lastFocusedElement = null;
                }
                if (callback) callback();
            };
        }
    };

    private connectWallet = async (): Promise<void> => {
        // Prefer WalletProvider bridge if available
        const bridge = (window as unknown as { walletBridge?: any }).walletBridge;
        if (bridge?.connect) {
            await bridge.connect();
            return;
        }
        // Fallback legacy flow (will be removed once all UI is wired to provider)
        if (!window.ethereum) {
            this.showCustomModal('Ethereum provider not found');
            return;
        }
        try {
            await ensureNetwork(window.ethereum as Eip1193Provider);
            const [account] = await window.ethereum.request({ method: 'eth_requestAccounts' });
            const ethersMod = await loadEthersModule();
            this.provider = new ethersMod.BrowserProvider(window.ethereum);
            this.signer = await this.provider.getSigner();
            if (!CONTRACT_ADDRESS || /^0x0{40}$/i.test(CONTRACT_ADDRESS)) {
                this.showCustomModal('Contract address is not configured. Set VITE_CONTRACT_ADDRESS in .env');
                return;
            }
            this.contract = new ethersMod.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, this.signer);
            this.gameState.walletAddress = account;
            this.attachContractEventListeners();
            await this.loadGameStateOnChain();
            this.showCustomModal('Wallet connected!');
            this.saveGameState();
            await this.updateWalletBalanceUi();
            this.updateWalletUi();
            this.initializeGardenBeds();
            this.updateInventory();
        } catch (err) {
            console.warn('Wallet connection failed', err);
        }
    };

    // SIWE helpers moved to WalletProvider; legacy methods removed

    private attachContractEventListeners(): void {
        if (!this.contract || !this.gameState.walletAddress) return;
        try {
            this.onStateDeltaHandler = async (player: string) => {
                if (!this.gameState.walletAddress) return;
                if (player.toLowerCase() !== this.gameState.walletAddress.toLowerCase()) return;
                await this.loadGameStateOnChain();
                this.saveGameState();
                await this.updateWalletBalanceUi();
            };
            (this.contract as unknown as { on: (event: string, handler: (player: string) => void) => void }).on('StateDelta', this.onStateDeltaHandler as (player: string) => void);
        } catch {
            // Ignore if events unsupported
        }
    }

    // passiveAttachToWallet is now handled by WalletProvider; legacy method removed

    // getEthers replaced by services/blockchain.loadEthers

    private loadGameStateOnChain = async (): Promise<void> => {
        if (!this.contract || !this.gameState.walletAddress) return;
        try {
            const data = await this.stateCoalescer.run('fullState', async () => {
                // Prefer new getFullState, fallback к legacy
                return await withBackoff(async () => {
                    try {
                        return await (this.contract as unknown as { getFullState: (p: string) => Promise<string> }).getFullState(this.gameState.walletAddress as string);
                    } catch {
                        return await (this.contract as unknown as { getGameState: (p: string) => Promise<string> }).getGameState(this.gameState.walletAddress as string);
                    }
                }, { retries: 3, baseMs: 400 });
            });
            if (data) {
                const state = JSON.parse(data) as GameState;
                const wallet = this.gameState.walletAddress;
                // Use on-chain state as the single source of truth
                this.gameState = {
                    beds: (Array.isArray(state.beds) && state.beds.length > 0) ? state.beds : [
                        { stage: BedStage.Empty, nextAction: BedAction.Plant, timerActive: false },
                        { stage: BedStage.Empty, nextAction: BedAction.Plant, timerActive: false },
                        { stage: BedStage.Empty, nextAction: BedAction.Plant, timerActive: false }
                    ],
                    // never trust/merge any existing local inventory here
                    inventory: state.inventory || {},
                    firstTime: false,
                    expansionPurchased: Boolean(state.expansionPurchased),
                    walletAddress: wallet
                };
                this.initializeGardenBeds();
                this.updateInventory();
            }
        } catch (err) {
            console.warn('Failed to load state from chain', err);
        }
    };

    private setupStatePolling(): void {
        if (this.pollIntervalId) {
            window.clearInterval(this.pollIntervalId);
            this.pollIntervalId = undefined;
        }
        const bridge = (window as unknown as { walletBridge?: any }).walletBridge;
        const isConnected = Boolean(bridge?.getState?.()?.address || this.gameState.walletAddress);
        if (!isConnected) return;
        // Poll every 15s as a fallback when events miss
        this.pollIntervalId = window.setInterval(() => {
            void this.loadGameStateOnChain().then(() => {
                this.saveGameState();
                this.gameState.beds.forEach((_, i) => this.emitBedUpdate(i));
                this.updateInventory();
            }).catch(() => {});
        }, 15000);
    }

    private maybeSaveGameStateOnChain = async (): Promise<void> => {
        if (!this.contract) return; // requires wallet
        const now = Date.now();
        if (now - this.lastChainSaveMs < this.chainSaveCooldownMs) return; // throttle txs
        try {
            const payload = JSON.stringify(this.gameState);
            await this.retryOperation(() => this.contract!.setGameState(payload));
            this.lastChainSaveMs = now;
        } catch (err) {
            console.warn('Failed to save state on chain', err);
        }
    };

    private setupToggleModule = (toggleSelector: string, panelSelector: string, name: string): void => {
        const toggle = document.querySelector<HTMLElement>(toggleSelector);
        const panel = document.querySelector<HTMLElement>(panelSelector);
        if (!toggle || !panel) {
            console.warn(`Missing ${name} elements`);
            return;
        }
        toggle.addEventListener('click', (e) => {
            // Block toggles when disconnected
            const bridge = (window as unknown as { walletBridge?: any }).walletBridge;
            const isConnected = Boolean(bridge?.getState?.()?.address || this.gameState.walletAddress);
            if (!isConnected) {
                e.preventDefault();
                e.stopPropagation();
                this.showToast('Connect wallet to use this feature');
                return;
            }
            panel.classList.toggle('open');
        });
    };

    private setupInventoryModule = (): void => {
        this.setupToggleModule('#inventory-toggle', '#inventory-panel', 'inventory');
    };

    private setupShopModule = (): void => {
        this.setupToggleModule('#shop-toggle', '#shop-panel', 'shop');
    };

    private updateAvailabilityBasedOnWallet(): void {
        const bridge = (window as unknown as { walletBridge?: any }).walletBridge;
        const isConnected = Boolean(bridge?.getState?.()?.address || this.gameState.walletAddress);
        const invToggle = document.getElementById('inventory-toggle');
        const shopToggle = document.getElementById('shop-toggle');
        const invPanel = document.getElementById('inventory-panel');
        const shopPanel = document.getElementById('shop-panel');

        // Disable or enable controls
        [invToggle, shopToggle].forEach((el) => {
            if (!el) return;
            el.setAttribute('aria-disabled', String(!isConnected));
            el.setAttribute('title', isConnected ? '' : 'Connect wallet to use this feature');
        });

        // Auto-close panels when disconnected
        if (!isConnected) {
            invPanel?.classList.remove('open');
            shopPanel?.classList.remove('open');
        }

        // Inventory UI is managed by React (InventoryView). Do not mutate DOM here.
    }

    private installDisconnectedGuards(): void {
        document.addEventListener('click', (ev) => {
            const target = ev.target as HTMLElement | null;
            if (!target) return;
            const bridge = (window as unknown as { walletBridge?: any }).walletBridge;
            const isConnected = Boolean(bridge?.getState?.()?.address || this.gameState.walletAddress);
            if (isConnected) return;
            const el = target.closest('#inventory-toggle, #shop-toggle, #exchange-wheat, #buy-expansion') as HTMLElement | null;
            if (!el) return;
            ev.preventDefault();
            ev.stopPropagation();
            this.showToast('Connect wallet to use this feature');
        }, true);
    }

    private showToast(message: string): void {
        const existing = document.querySelector('.fg-toast') as HTMLElement | null;
        if (existing) existing.remove();
        const toast = document.createElement('div');
        toast.className = 'fg-toast';
        toast.textContent = message;
        toast.setAttribute('role', 'status');
        toast.setAttribute('aria-live', 'polite');
        toast.style.position = 'fixed';
        toast.style.left = '50%';
        toast.style.bottom = '24px';
        toast.style.transform = 'translateX(-50%)';
        toast.style.background = 'rgba(0,0,0,0.8)';
        toast.style.color = '#fff';
        toast.style.padding = '10px 14px';
        toast.style.borderRadius = '8px';
        toast.style.fontSize = '14px';
        toast.style.zIndex = '9999';
        toast.style.maxWidth = '90vw';
        toast.style.textAlign = 'center';
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.transition = 'opacity 300ms ease';
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 320);
        }, 1800);
    }

    private async updateWalletBalanceUi(): Promise<void> {
        try {
            const balanceEl = document.getElementById('wallet-balance');
            if (!balanceEl) return;
            const bridge = (window as unknown as { walletBridge?: any }).walletBridge;
            if (!bridge?.getState) return;
            const state = bridge.getState();
            const bal = state?.balanceWei as bigint | undefined;
            if (typeof bal === 'bigint') {
                const denom = 10n ** 18n;
                const mon = Number(bal / denom) + Number(bal % denom) / Number(denom);
                balanceEl.textContent = mon.toFixed(4);
            }
        } catch {
            // ignore
        }
    }

    private updateWalletUi(): void {
        const btn = document.getElementById('wallet-connect');
        const bridge = (window as unknown as { walletBridge?: any }).walletBridge;
        const addr = (bridge?.getState?.()?.address as string | undefined) ?? this.gameState.walletAddress;
        if (btn) {
            if (addr) {
                const short = `${addr.slice(0, 6)}…${addr.slice(-4)}`;
                btn.textContent = short;
                btn.classList.add('connected');
                btn.setAttribute('aria-label', `Wallet ${short}`);
            } else {
                btn.textContent = '👛';
                btn.classList.remove('connected');
                btn.setAttribute('aria-label', 'Connect wallet');
            }
        }
        const addressEl = document.getElementById('wallet-address');
        if (addressEl) addressEl.textContent = addr ?? '—';
        const panel = document.getElementById('wallet-panel');
        if (!addr) panel?.classList.remove('open');
    }

    private disconnectWallet = (): void => {
        try {
            if (this.contract) {
                try {
                    if (this.onStateDeltaHandler) {
                        (this.contract as unknown as { off: (event: string, handler: (player: string) => void) => void }).off?.('StateDelta', this.onStateDeltaHandler as (player: string) => void);
                    }
                    (this.contract as unknown as { removeAllListeners?: (event?: string) => void }).removeAllListeners?.('StateDelta');
                } catch {}
            }
        } finally {
            this.contract = undefined;
            this.provider = undefined;
            this.signer = undefined;
            this.gameState.walletAddress = undefined;
            // On disconnect, forget all on-chain derived data locally
            this.gameState.beds = [
                { stage: BedStage.Empty, nextAction: BedAction.Plant, timerActive: false },
                { stage: BedStage.Empty, nextAction: BedAction.Plant, timerActive: false },
                { stage: BedStage.Empty, nextAction: BedAction.Plant, timerActive: false }
            ];
            this.gameState.inventory = {};
            this.gameState.expansionPurchased = false;
            this.initializeGardenBeds();
            this.updateInventory();
            const panel = document.getElementById('wallet-panel');
            panel?.classList.remove('open');
            this.updateWalletUi();
            this.saveGameState();
        }
    }

    private handleScroll = (): void => {
        if (window.scrollY > 60) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            this.scrollDownCount++;
            if (this.scrollDownCount >= this.scrollThreshold) {
                this.toggleTheme();
                const pageExt = document.querySelector('.page-extension') as HTMLElement | null;
                if (pageExt) pageExt.style.display = 'none';
                const wavesElem = document.querySelector('.waves') as HTMLElement | null;
                wavesElem?.classList.add('wave-animation');
                setTimeout(() => {
                    wavesElem?.classList.remove('wave-animation');
                }, 2000);
                this.scrollDownCount = 0;
            }
        }
    };

    private generateWaves = (): void => {
        const waves = document.querySelector('.waves') as HTMLElement | null;
        if (!waves) return;
        waves.innerHTML = '';
        const wavePatterns = [
            ' ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~',
            ' - - - - - - - - - - - - - - -',
            ' . . . . . . . . . . . . . . .',
            ' ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~',
            ' - - - - - - - - - - - - - - -',
            ' . . . . . . . . . . . . . . .'
        ];
        const repeat = Math.ceil(window.innerWidth / 40);
        for (let i = 0; i < 6; i++) {
            const waveLine = document.createElement('div');
            waveLine.className = 'wave-line';
            waveLine.textContent = wavePatterns[i].repeat(repeat * 2);
            waves.appendChild(waveLine);
        }
    };

    // throttle moved to ./utils/throttle

    private toggleTheme = (): void => {
        const isDark = document.body.classList.toggle('dark-mode');
        const waves = document.querySelector('.waves') as HTMLElement | null;
        waves?.classList.toggle('dark-wave', isDark);
    };

}
