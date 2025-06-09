/**
 * Game engine and blockchain integration for the ASCII farm.
 * Handles garden bed actions, inventory, wallet connection and
 * persistence of game state both locally and on-chain.
 */
export const BedStage = {
    Empty: 'empty',
    Seed: 'seed',
    Growing: 'growing',
    Ready: 'ready'
} as const;
export type BedStage = typeof BedStage[keyof typeof BedStage];

export const BedAction = {
    Plant: 'plant',
    Water: 'water',
    Harvest: 'harvest'
} as const;
export type BedAction = typeof BedAction[keyof typeof BedAction];

export interface GardenBed {
    stage: BedStage
    nextAction: BedAction | null
    timerActive: boolean
    timerEnd?: number
    isActionInProgress?: boolean
}

import { ethers } from 'ethers'
import { CONTRACT_ADDRESS, MONAD_CHAIN_ID, MONAD_CHAIN_NAME, MONAD_RPC_URL } from './config'

declare global {
    interface Window {
        ethereum?: ethers.Eip1193Provider
    }
}

const CONTRACT_ABI = [
    'function setGameState(string state)',
    'function getGameState(address player) view returns (string)'
]

// Security constants
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // ms
const RATE_LIMIT_DELAY = 500; // ms
const MAX_ACTIONS_PER_MINUTE = 30;

export interface GameState {
    beds: GardenBed[]
    inventory: Record<string, number>
    firstTime: boolean
    expansionPurchased: boolean
    walletAddress?: string
}

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
    private provider?: ethers.BrowserProvider;
    private signer?: ethers.Signer;
    private contract?: ethers.Contract;
    private readonly scrollThreshold = 10;
    private scrollDownCount = 0;
    private inventoryList: HTMLElement;
    private gardenBedsContainer: HTMLElement;
    private welcomeModal: HTMLElement;
    private startGameBtn: HTMLButtonElement;
    private exchangeButton: HTMLButtonElement;
    private expansionButton: HTMLButtonElement;
    private walletButton: HTMLButtonElement;
    private actionCount = 0;
    private lastActionTime = 0;
    private isProcessingAction = false;
    private boundHandleScroll: () => void;
    private boundGenerateWaves: () => void;
    private boundExchangeWheat: () => void;
    private boundBuyExpansion: () => void;
    private boundConnectWallet: () => void;

    // Rate limiting and security checks
    private checkRateLimit = (): boolean => {
        const now = Date.now();
        if (now - this.lastActionTime < RATE_LIMIT_DELAY) {
            return false;
        }
        if (this.actionCount >= MAX_ACTIONS_PER_MINUTE) {
            return false;
        }
        this.lastActionTime = now;
        this.actionCount++;
        setTimeout(() => this.actionCount--, 60000);
        return true;
    };

    private verifyProviderSecurity = (): boolean => {
        if (!window.ethereum) return false;
        const eth = window.ethereum as unknown as Record<string, unknown>;
        const hasRequest = typeof eth.request === 'function';
        const knownFlags = [
            'isMetaMask',
            'isCoinbaseWallet',
            'isBraveWallet',
            'isTrust',
            'isFrame'
        ];
        const isKnown = knownFlags.some(f => Boolean(eth[f]));
        return hasRequest && isKnown;
    };

    private ensureMonadNetwork = async (): Promise<void> => {
        if (!window.ethereum) return;
        const currentChain = await window.ethereum.request({ method: 'eth_chainId' });
        if (currentChain !== MONAD_CHAIN_ID) {
            try {
                await window.ethereum.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: MONAD_CHAIN_ID }]
                });
            } catch (switchErr: unknown) {
                const err = switchErr as { code?: number };
                if (err.code === 4902) {
                    await window.ethereum.request({
                        method: 'wallet_addEthereumChain',
                        params: [{
                            chainId: MONAD_CHAIN_ID,
                            chainName: MONAD_CHAIN_NAME,
                            rpcUrls: [MONAD_RPC_URL],
                            nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 }
                        }]
                    });
                } else {
                    throw switchErr;
                }
            }
        }
    };

    // Retry mechanism for blockchain operations
    private async retryOperation<T>(
        operation: () => Promise<T>,
        retries = MAX_RETRIES
    ): Promise<T> {
        try {
            return await operation();
        } catch (error) {
            if (retries > 0) {
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
                return this.retryOperation(operation, retries - 1);
            }
            throw error;
        }
    }

    constructor() {
        this.gameState = this.loadGameState();
        this.inventoryList = document.getElementById('inventory-list') as HTMLElement;
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
            this.welcomeModal.style.display = 'flex';
            this.gameState.firstTime = false;
            this.saveGameState();
        }

        this.startGameBtn.addEventListener('click', () => {
            this.welcomeModal.style.display = 'none';
        });

        this.exchangeButton.addEventListener('click', this.boundExchangeWheat);
        this.expansionButton.addEventListener('click', this.boundBuyExpansion);
        this.walletButton.addEventListener('click', this.boundConnectWallet);

        window.addEventListener('scroll', this.boundHandleScroll);
        window.addEventListener('resize', this.boundGenerateWaves);
        this.generateWaves();
    }

    public cleanup(): void {
        // Remove event listeners
        window.removeEventListener('scroll', this.boundHandleScroll);
        window.removeEventListener('resize', this.boundGenerateWaves);
        this.exchangeButton.removeEventListener('click', this.boundExchangeWheat);
        this.expansionButton.removeEventListener('click', this.boundBuyExpansion);
        this.walletButton.removeEventListener('click', this.boundConnectWallet);

        // Clear any active timers
        this.gameState.beds.forEach((bed, index) => {
            if (bed.timerActive) {
                const timerElement = document.querySelector(`#bed-${index} .timer`);
                if (timerElement) {
                    clearInterval((timerElement as any).timerInterval);
                }
            }
        });

        // Clear any pending blockchain operations
        this.isProcessingAction = false;
    }

    private bedAsciiArt = `
+----------------------------+
|                            |
|   ~~~~~~~~~~~~~~~~~~~~~~   |
|   ~~~~~~~~~~~~~~~~~~~~~~   |
|   ~~~~~~~~~~~~~~~~~~~~~~   |
|   ~~~~~~~~~~~~~~~~~~~~~~   |
|   ~~~~~~~~~~~~~~~~~~~~~~   |
|                            |
+----------------------------+`;

    private initializeGardenBeds = (): void => {
        this.gardenBedsContainer.innerHTML = '';
        this.gameState.beds.forEach((bedData, i) => {
            const bedId = `bed-${i}`;
            const bed = this.createGardenBed(bedId, bedData);
            this.gardenBedsContainer.appendChild(bed);
        });
    };

    private updateBed = (index: number): void => {
        const oldBed = document.getElementById(`bed-${index}`);
        if (!oldBed) return;
        const newBed = this.createGardenBed(`bed-${index}`, this.gameState.beds[index]);
        oldBed.replaceWith(newBed);
    };

    private createGardenBed = (id: string, bedData: GardenBed): HTMLDivElement => {
        const bed = document.createElement('div');
        bed.className = 'garden-bed';
        bed.id = id;

        const bedAscii = document.createElement('div');
        bedAscii.className = 'bed-ascii';
        bedAscii.textContent = this.bedAsciiArt;
        bed.appendChild(bedAscii);

        const plant = document.createElement('div');
        plant.className = 'plant';
        plant.textContent = this.getPlantEmoji(bedData.stage);
        plant.addEventListener('click', () => {
            if (bedData.nextAction && !bedData.timerActive && !bedData.isActionInProgress) {
                this.performAction(id, bedData);
            }
        });
        bed.appendChild(plant);

        if (bedData.nextAction && !bedData.timerActive) {
            const actionIcon = document.createElement('div');
            actionIcon.className = 'action-icon';
            actionIcon.textContent = this.getActionEmoji(bedData.nextAction);
            actionIcon.addEventListener('click', (e) => {
                e.stopPropagation();
                actionIcon.classList.add('selected');
                if (!bedData.isActionInProgress) {
                    this.performAction(id, bedData);
                }
            });
            bed.appendChild(actionIcon);
        }

        if (bedData.timerActive && bedData.timerEnd) {
            const timer = document.createElement('div');
            timer.className = 'timer';
            const timeLeft = this.calculateTimeLeft(bedData.timerEnd);
            timer.textContent = this.formatTime(timeLeft);
            bed.appendChild(timer);

            this.startTimer(timer, bedData.timerEnd, id);
        }

        return bed;
    };

    private getPlantEmoji = (stage: BedStage): string => {
        switch (stage) {
            case BedStage.Empty: return '🟫';
            case BedStage.Seed: return '🌱';
            case BedStage.Growing: return '🌽';
            case BedStage.Ready: return '🌾';
            default: return '🟫';
        }
    };

    private getActionEmoji = (action: BedAction): string => {
        switch (action) {
            case BedAction.Plant: return '🌰';
            case BedAction.Water: return '💧';
            case BedAction.Harvest: return '🔪';
            default: return '❓';
        }
    };

    private performAction = async (bedId: string, bedData: GardenBed): Promise<void> => {
        if (this.isProcessingAction || !this.checkRateLimit()) {
            return;
        }

        try {
            this.isProcessingAction = true;
            const index = parseInt(bedId.split('-')[1]);
            if (isNaN(index)) return;

            // Validate action
            if (!bedData.nextAction || bedData.timerActive || bedData.isActionInProgress) {
                return;
            }

            // Perform action with retry mechanism
            await this.retryOperation(async () => {
                this.gameState.beds[index].isActionInProgress = true;

                const bed = document.getElementById(bedId) as HTMLElement;
                const animationElement = document.createElement('div');
                animationElement.style.position = 'absolute';
                animationElement.style.top = '20%';
                animationElement.style.left = '50%';
                animationElement.style.fontSize = '2rem';
                animationElement.style.zIndex = '4';
                animationElement.style.transform = 'translateX(-50%)';

                switch (bedData.nextAction) {
                    case BedAction.Plant:
                        animationElement.textContent = '🌰';
                        animationElement.classList.add('seed-animation');
                        break;
                    case BedAction.Water:
                        animationElement.textContent = '💧';
                        animationElement.classList.add('water-animation');
                        break;
                    case BedAction.Harvest:
                        animationElement.textContent = '🔪';
                        animationElement.classList.add('harvest-animation');
                        break;
                }

                bed.insertBefore(animationElement, bed.firstChild);

                setTimeout(() => {
                    animationElement.remove();

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

                    this.gameState.beds[index].isActionInProgress = false;

                    this.saveGameState();
                    this.updateBed(index);
                    this.updateInventory();
                }, 1000);
            });
        } catch (error) {
            console.error('Action failed:', error);
            this.showCustomModal('Action failed. Please try again.');
        } finally {
            this.isProcessingAction = false;
        }
    };

    private startTimer = (timerElement: HTMLElement, endTime: number, bedId: string): void => {
        const bedIndex = parseInt(bedId.split('-')[1]);
        let raf: number;
        let lastSeconds = 0;
        const tick = () => {
            const msLeft = this.calculateTimeLeft(endTime);
            const secondsLeft = Math.ceil(msLeft / 1000);
            if (secondsLeft !== lastSeconds) {
                timerElement.textContent = this.formatTime(secondsLeft * 1000);
                lastSeconds = secondsLeft;
            }
            if (msLeft <= 0) {
                cancelAnimationFrame(raf);
                timerElement.remove();

                const bed = this.gameState.beds[bedIndex];
                switch (bed.stage) {
                    case BedStage.Seed:
                        bed.stage = BedStage.Seed;
                        bed.nextAction = BedAction.Water;
                        break;
                    case BedStage.Growing:
                        bed.stage = BedStage.Ready;
                        bed.nextAction = BedAction.Harvest;
                        break;
                }
                bed.timerActive = false;
                this.saveGameState();
                this.updateBed(bedIndex);
            } else {
                raf = requestAnimationFrame(tick);
            }
        };
        raf = requestAnimationFrame(tick);
    };

    private calculateTimeLeft = (endTime: number): number => {
        return Math.max(0, endTime - Date.now());
    };

    private formatTime = (milliseconds: number): string => {
        const totalSeconds = Math.floor(milliseconds / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };

    private updateInventory = (): void => {
        this.inventoryList.innerHTML = '';
        for (const [item, count] of Object.entries(this.gameState.inventory)) {
            if (count > 0) {
                const itemElement = document.createElement('div');
                itemElement.className = 'inventory-item';
                const itemName = document.createElement('span');
                itemName.textContent = this.getItemName(item);
                const itemCount = document.createElement('span');
                itemCount.textContent = `x${count}`;
                itemElement.appendChild(itemName);
                itemElement.appendChild(itemCount);
                this.inventoryList.appendChild(itemElement);
            }
        }
        if (this.inventoryList.children.length === 0) {
            const emptyMessage = document.createElement('p');
            emptyMessage.textContent = 'Инвентарь пуст';
            this.inventoryList.appendChild(emptyMessage);
        }
    };

    private getItemName = (item: string): string => {
        switch (item) {
            case 'wheat': return '🌾 Пшеница';
            case 'coins': return '💰 Монеты';
            default: return item;
        }
    };

    private loadGameState = (): GameState => {
        const savedState = localStorage.getItem('farmGameAsciiEmojiState');
        if (savedState) {
            let state: GameState | null = null;
            try {
                state = JSON.parse(savedState) as GameState;
            } catch (err) {
                console.warn('Failed to parse saved game state', err);
            }
            if (state) {
                state.beds.forEach(bed => {
                    if (bed.timerActive && bed.timerEnd) {
                        const now = Date.now();
                        if (now >= bed.timerEnd) {
                            bed.timerActive = false;
                            switch (bed.stage) {
                                case BedStage.Seed:
                                    bed.stage = BedStage.Seed;
                                    bed.nextAction = BedAction.Water;
                                    break;
                                case BedStage.Growing:
                                    bed.stage = BedStage.Ready;
                                    bed.nextAction = BedAction.Harvest;
                                    break;
                            }
                        }
                    }
                });
                return state;
            }
        }
        return {
            beds: [
                { stage: BedStage.Empty, nextAction: BedAction.Plant, timerActive: false },
                { stage: BedStage.Empty, nextAction: BedAction.Plant, timerActive: false },
                { stage: BedStage.Empty, nextAction: BedAction.Plant, timerActive: false }
            ],
            inventory: {},
            firstTime: true,
            expansionPurchased: false
        };
    };

    private saveGameState = (): void => {
        localStorage.setItem('farmGameAsciiEmojiState', JSON.stringify(this.gameState));
        void this.saveGameStateOnChain();
    };

    private exchangeWheat = (): void => {
        const wheatCount = this.gameState.inventory.wheat || 0;
        if (wheatCount < 10) {
            this.showCustomModal('Недостаточно пшеницы для обмена');
            return;
        }
        const exchangeCount = Math.floor(wheatCount / 10);
        const coinsToAdd = exchangeCount;
        this.gameState.inventory.wheat -= exchangeCount * 10;
        if (!this.gameState.inventory.coins) {
            this.gameState.inventory.coins = 0;
        }
        this.gameState.inventory.coins += coinsToAdd;
        this.showCustomModal(`Вы обменяли ${exchangeCount * 10} пшеницы на ${coinsToAdd} монет(ы)!`);
        this.saveGameState();
        this.updateInventory();
    };

    private buyExpansion = (): void => {
        if (this.gameState.expansionPurchased) {
            this.showCustomModal('Расширение уже куплено.');
            return;
        }
        if (!this.gameState.inventory.coins || this.gameState.inventory.coins < 100) {
            this.showCustomModal('Недостаточно монет для покупки расширения.');
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
        this.expansionButton.textContent = 'Расширение sold out';
        this.expansionButton.disabled = true;
        this.showCustomModal('Расширение куплено! Новые грядки добавлены.');
    };

    private showCustomModal = (message: string, buttonText = 'OK', callback?: () => void): void => {
        const modal = document.getElementById('custom-modal') as HTMLElement | null;
        const messageElem = document.getElementById('custom-modal-message') as HTMLElement | null;
        const btn = document.getElementById('custom-modal-button') as HTMLButtonElement | null;

        if (messageElem) messageElem.textContent = message;
        if (btn) btn.textContent = buttonText;
        if (modal) modal.style.display = 'flex';
        if (btn) {
            btn.onclick = () => {
                if (modal) modal.style.display = 'none';
                if (callback) callback();
            };
        }
    };

    private connectWallet = async (): Promise<void> => {
        if (!window.ethereum) {
            this.showCustomModal('Ethereum провайдер не найден');
            return;
        }
        try {
            if (!this.verifyProviderSecurity()) {
                this.showCustomModal('Небезопасный провайдер');
                return;
            }
            await this.ensureMonadNetwork();
            const [account] = await window.ethereum.request({ method: 'eth_requestAccounts' });
            this.provider = new ethers.BrowserProvider(window.ethereum);
            this.signer = await this.provider.getSigner();
            // simple identity check
            const challenge = 'FarmGame Authentication';
            await this.signer.signMessage(challenge);
            this.contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, this.signer);
            this.gameState.walletAddress = account;
            await this.loadGameStateOnChain();
            this.showCustomModal('Кошелек подключен!');
            this.saveGameState();
        } catch (err) {
            console.warn('Wallet connection failed', err);
        }
    };

    private loadGameStateOnChain = async (): Promise<void> => {
        if (!this.contract || !this.gameState.walletAddress) return;
        try {
            const data = await this.contract.getGameState(this.gameState.walletAddress);
            if (data) {
                const state = JSON.parse(data) as GameState;
                this.gameState = { ...this.gameState, ...state };
                this.initializeGardenBeds();
                this.updateInventory();
            }
        } catch (err) {
            console.warn('Failed to load state from chain', err);
        }
    };

    private saveGameStateOnChain = async (): Promise<void> => {
        if (!this.contract) return;
        try {
            await this.contract.setGameState(JSON.stringify(this.gameState));
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
        toggle.addEventListener('click', () => {
            panel.classList.toggle('open');
        });
    };

    private setupInventoryModule = (): void => {
        this.setupToggleModule('#inventory-toggle', '#inventory-panel', 'inventory');
    };

    private setupShopModule = (): void => {
        this.setupToggleModule('#shop-toggle', '#shop-panel', 'shop');
    };

    private handleScroll = (): void => {
        if (window.scrollY > 60) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            this.scrollDownCount++;
            if (this.scrollDownCount >= this.scrollThreshold) {
                document.body.classList.add('dark-mode');
                (document.querySelector('.waves') as HTMLElement)?.classList.add('dark-wave');
                const pageExt = document.querySelector('.page-extension') as HTMLElement | null;
                if (pageExt) pageExt.style.display = 'none';
                const wavesElem = document.querySelector('.waves') as HTMLElement | null;
                wavesElem?.classList.add('wave-animation');
                setTimeout(() => {
                    wavesElem?.classList.remove('wave-animation');
                }, 2000);
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
        for (let i = 0; i < 6; i++) {
            const waveLine = document.createElement('div');
            waveLine.className = 'wave-line';
            waveLine.textContent = wavePatterns[i].repeat(40);
            waves.appendChild(waveLine);
        }
    };
}
