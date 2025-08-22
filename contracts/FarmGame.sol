// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

abstract contract Initializable {
    bool private _initialized;
    modifier initializer() {
        require(!_initialized, "initialized");
        _;
        _initialized = true;
    }
}

abstract contract OwnableLike is Initializable {
    address private _owner;
    modifier onlyOwner() { require(msg.sender == _owner, "not owner"); _; }
    function _initOwner(address owner_) internal initializer { _owner = owner_; }
}

abstract contract UUPSLike {
    // keccak-256("eip1967.proxy.implementation") - 1
    bytes32 private constant _IMPL_SLOT = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;
    function upgradeTo(address newImplementation) external {
        _authorizeUpgrade(newImplementation);
        assembly { sstore(_IMPL_SLOT, newImplementation) }
    }
    function proxiableUUID() external pure returns (bytes32) {
        return _IMPL_SLOT;
    }
    function _authorizeUpgrade(address newImplementation) internal virtual;
}

abstract contract PausableLike {
    event Paused(address account);
    event Unpaused(address account);
    bool private _paused;
    modifier whenNotPaused() {
        require(!_paused, "paused");
        _;
    }
    function paused() public view returns (bool) { return _paused; }
    function _pause() internal { _paused = true; emit Paused(msg.sender); }
    function _unpause() internal { _paused = false; emit Unpaused(msg.sender); }
}

abstract contract ReentrancyGuardLike {
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;
    uint256 private _status = _NOT_ENTERED;
    modifier nonReentrant() {
        require(_status != _ENTERED, "reentrant");
        _status = _ENTERED;
        _;
        _status = _NOT_ENTERED;
    }
}

/**
 * FarmGame on-chain logic for Monad-compatible EVM networks.
 * Stores player beds, resources and expansion on-chain.
 * Exposes granular actions and a JSON state fetcher used by the frontend.
 */
contract FarmGame is OwnableLike, UUPSLike, PausableLike, ReentrancyGuardLike {
    enum Stage { Empty, Seed, Growing, Ready }

    struct Bed {
        Stage stage;
        bool timerActive;
        uint64 timerEnd; // unix seconds
    }

    struct Player {
        // packed small scalars first for tighter storage layout
        uint128 wheat;
        uint128 coins;
        bool expansionPurchased;
        bool wellPurchased; // speeds up watering by 50%
        bool fertilizerPurchased; // doubles harvest yield permanently
        Bed[] beds;
        // legacy custom blob for compatibility
        string legacyBlob;
    }

    mapping(address => Player) private players;

    // Durations (seconds)
    uint32 private constant SEED_TIMER = 10;
    uint32 private constant WATER_TIMER = 10;
    // Upgrade costs (coins)
    uint128 private constant WELL_COST = 50;
    uint128 private constant FERTILIZER_COST = 200;

    // Compact delta event to notify frontends to refresh state via getFullState
    event StateDelta(address indexed player);

    // ---------------- Legacy bulk state (optional/back-compat) ----------------
    function setGameState(string calldata state) external whenNotPaused nonReentrant {
        players[msg.sender].legacyBlob = state;
    }

    function getGameState(address player) external view returns (string memory) {
        return players[player].legacyBlob;
    }

    // ---------------- Gameplay actions ----------------
    function plant(uint256 bedIndex) external whenNotPaused nonReentrant {
        Player storage p = _ensurePlayer(msg.sender);
        require(bedIndex < p.beds.length, "bad index");
        _refreshBed(p.beds[bedIndex]);
        Bed storage b = p.beds[bedIndex];
        require(b.stage == Stage.Empty && !b.timerActive, "cannot plant");
        b.stage = Stage.Seed;
        b.timerActive = true;
        b.timerEnd = uint64(block.timestamp + SEED_TIMER);
        _emitDelta(msg.sender);
    }

    function water(uint256 bedIndex) external whenNotPaused nonReentrant {
        Player storage p = _ensurePlayer(msg.sender);
        require(bedIndex < p.beds.length, "bad index");
        _refreshBed(p.beds[bedIndex]);
        Bed storage b = p.beds[bedIndex];
        require(b.stage == Stage.Seed && !b.timerActive, "cannot water");
        b.stage = Stage.Growing;
        b.timerActive = true;
        uint32 duration = WATER_TIMER;
        if (p.wellPurchased) {
            // accelerate watering by 50%
            duration = WATER_TIMER / 2;
        }
        b.timerEnd = uint64(block.timestamp + duration);
        _emitDelta(msg.sender);
    }

    function harvest(uint256 bedIndex) external whenNotPaused nonReentrant {
        Player storage p = _ensurePlayer(msg.sender);
        require(bedIndex < p.beds.length, "bad index");
        _refreshBed(p.beds[bedIndex]);
        Bed storage b = p.beds[bedIndex];
        require(b.stage == Stage.Ready && !b.timerActive, "cannot harvest");
        b.stage = Stage.Empty;
        // increment wheat balance on-chain, bound to msg.sender
        uint128 yieldAmount = p.fertilizerPurchased ? 2 : 1;
        unchecked { p.wheat += yieldAmount; }
        _emitDelta(msg.sender);
    }

    function exchangeWheat(uint256 wheatAmount) external whenNotPaused nonReentrant {
        require(wheatAmount > 0 && wheatAmount % 10 == 0, "amount must be multiple of 10");
        Player storage p = _ensurePlayer(msg.sender);
        require(p.wheat >= wheatAmount, "not enough wheat");
        p.wheat -= uint128(wheatAmount);
        p.coins += uint128(wheatAmount / 10);
        _emitDelta(msg.sender);
    }

    function buyExpansion() external whenNotPaused nonReentrant {
        Player storage p = _ensurePlayer(msg.sender);
        require(!p.expansionPurchased, "already bought");
        require(p.coins >= 100, "not enough coins");
        p.coins -= 100;
        p.expansionPurchased = true;
        for (uint256 i = 0; i < 3; i++) {
            p.beds.push(Bed({ stage: Stage.Empty, timerActive: false, timerEnd: 0 }));
        }
        _emitDelta(msg.sender);
    }

    function buyWell() external whenNotPaused nonReentrant {
        Player storage p = _ensurePlayer(msg.sender);
        require(!p.wellPurchased, "already bought");
        require(p.coins >= WELL_COST, "not enough coins");
        p.coins -= WELL_COST;
        p.wellPurchased = true;
        _emitDelta(msg.sender);
    }

    function buyFertilizer() external whenNotPaused nonReentrant {
        Player storage p = _ensurePlayer(msg.sender);
        require(!p.fertilizerPurchased, "already bought");
        require(p.coins >= FERTILIZER_COST, "not enough coins");
        p.coins -= FERTILIZER_COST;
        p.fertilizerPurchased = true;
        _emitDelta(msg.sender);
    }

    // ---------------- Batch operations ----------------
    function batchPlant(uint256[] calldata bedIndices) external whenNotPaused nonReentrant {
        Player storage p = _ensurePlayer(msg.sender);
        for (uint256 i = 0; i < bedIndices.length; i++) {
            uint256 bedIndex = bedIndices[i];
            require(bedIndex < p.beds.length, "bad index");
            _refreshBed(p.beds[bedIndex]);
            Bed storage b = p.beds[bedIndex];
            if (b.stage == Stage.Empty && !b.timerActive) {
                b.stage = Stage.Seed;
                b.timerActive = true;
                b.timerEnd = uint64(block.timestamp + SEED_TIMER);
            }
        }
        _emitDelta(msg.sender);
    }

    function batchWater(uint256[] calldata bedIndices) external whenNotPaused nonReentrant {
        Player storage p = _ensurePlayer(msg.sender);
        for (uint256 i = 0; i < bedIndices.length; i++) {
            uint256 bedIndex = bedIndices[i];
            require(bedIndex < p.beds.length, "bad index");
            _refreshBed(p.beds[bedIndex]);
            Bed storage b = p.beds[bedIndex];
            if (b.stage == Stage.Seed && !b.timerActive) {
                b.stage = Stage.Growing;
                b.timerActive = true;
                uint32 duration2 = WATER_TIMER;
                if (p.wellPurchased) { duration2 = WATER_TIMER / 2; }
                b.timerEnd = uint64(block.timestamp + duration2);
            }
        }
        _emitDelta(msg.sender);
    }

    function batchHarvest(uint256[] calldata bedIndices) external whenNotPaused nonReentrant {
        Player storage p = _ensurePlayer(msg.sender);
        uint256 harvested = 0;
        for (uint256 i = 0; i < bedIndices.length; i++) {
            uint256 bedIndex = bedIndices[i];
            require(bedIndex < p.beds.length, "bad index");
            _refreshBed(p.beds[bedIndex]);
            Bed storage b = p.beds[bedIndex];
            if (b.stage == Stage.Ready && !b.timerActive) {
                b.stage = Stage.Empty;
                harvested++;
            }
        }
        if (harvested > 0) {
            uint128 mult = p.fertilizerPurchased ? 2 : 1;
            unchecked { p.wheat += uint128(harvested) * mult; }
        }
        _emitDelta(msg.sender);
    }

    // -------- Admin controls --------
    function initialize() external initializer {
        _initOwner(msg.sender);
    }
    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
    function _authorizeUpgrade(address) internal override onlyOwner {}

    // ---------------- State view ----------------
    function getFullState(address player) external view returns (string memory) {
        Player storage p = players[player];
        // initialize view if new player (read-only)
        if (p.beds.length == 0) {
            // simulate 3 empty beds
            return _composeStateJSON(_tmpDefaultBeds(), 0, 0, false, false, false);
        }
        Bed[] memory bedsCopy = new Bed[](p.beds.length);
        for (uint256 i = 0; i < p.beds.length; i++) {
            bedsCopy[i] = _peekRefreshed(p.beds[i]);
        }
        return _composeStateJSON(bedsCopy, p.wheat, p.coins, p.expansionPurchased, p.wellPurchased, p.fertilizerPurchased);
    }

    // ---------------- Internal helpers ----------------
    function _ensurePlayer(address player) internal returns (Player storage) {
        Player storage p = players[player];
        if (p.beds.length == 0) {
            p.beds.push(Bed({ stage: Stage.Empty, timerActive: false, timerEnd: 0 }));
            p.beds.push(Bed({ stage: Stage.Empty, timerActive: false, timerEnd: 0 }));
            p.beds.push(Bed({ stage: Stage.Empty, timerActive: false, timerEnd: 0 }));
        }
        return p;
    }

    function _tmpDefaultBeds() internal pure returns (Bed[] memory arr) {
        arr = new Bed[](3);
        for (uint256 i = 0; i < 3; i++) {
            arr[i] = Bed({ stage: Stage.Empty, timerActive: false, timerEnd: 0 });
        }
    }

    function _refreshBed(Bed storage b) internal {
        if (b.timerActive && block.timestamp >= b.timerEnd) {
            if (b.stage == Stage.Seed) {
                // Timer over, ready for watering; stay Seed but stop timer
                b.timerActive = false;
            } else if (b.stage == Stage.Growing) {
                // Growth finished, bed becomes Ready
                b.stage = Stage.Ready;
                b.timerActive = false;
            }
        }
    }

    // Helper view: whether specific bed is harvestable now
    function canHarvest(address player, uint256 bedIndex) external view returns (bool) {
        Player storage p = players[player];
        if (bedIndex >= p.beds.length) return false;
        Bed memory b = _peekRefreshed(p.beds[bedIndex]);
        return b.stage == Stage.Ready && !b.timerActive;
    }

    function _peekRefreshed(Bed storage b) internal view returns (Bed memory out) {
        out = b;
        if (b.timerActive && block.timestamp >= b.timerEnd) {
            if (b.stage == Stage.Seed) {
                out.timerActive = false;
            } else if (b.stage == Stage.Growing) {
                out.stage = Stage.Ready;
                out.timerActive = false;
            }
        }
    }

    function _emitDelta(address player) internal {
        emit StateDelta(player);
    }

    // JSON composition helpers (gas-optimized enough for small payloads)
    function _composeStateJSON(
        Bed[] memory beds,
        uint256 wheat,
        uint256 coins,
        bool expansionPurchased,
        bool wellPurchased,
        bool fertilizerPurchased
    ) internal pure returns (string memory) {
        string memory bedsJson = _bedsToJSON(beds);
        return string.concat(
            '{',
                '"beds":', bedsJson, ',',
                '"inventory":{',
                    '"wheat":', _uToStr(wheat), ',',
                    '"coins":', _uToStr(coins),
                '},',
                '"firstTime":false,',
                '"expansionPurchased":', (expansionPurchased ? 'true' : 'false'), ',',
                '"wellPurchased":', (wellPurchased ? 'true' : 'false'), ',',
                '"fertilizerPurchased":', (fertilizerPurchased ? 'true' : 'false'),
            '}'
        );
    }

    function _bedsToJSON(Bed[] memory beds) internal pure returns (string memory) {
        bytes memory out = bytes('[');
        for (uint256 i = 0; i < beds.length; i++) {
            if (i > 0) {
                out = abi.encodePacked(out, ',');
            }
            string memory stageStr = _stageToStr(beds[i].stage);
            string memory nextAction = _nextActionFor(beds[i]);
            uint256 timerEndMs = uint256(beds[i].timerEnd) * 1000;
            out = abi.encodePacked(
                out,
                '{',
                    '"stage":"', stageStr, '",',
                    '"nextAction":', nextAction, ',',
                    '"timerActive":', (beds[i].timerActive ? 'true' : 'false'), ',',
                    '"timerEnd":', _uToStr(timerEndMs),
                '}'
            );
        }
        out = abi.encodePacked(out, ']');
        return string(out);
    }

    function _nextActionFor(Bed memory b) internal pure returns (string memory) {
        if (b.timerActive) {
            return 'null';
        }
        if (b.stage == Stage.Empty) return '"plant"';
        if (b.stage == Stage.Seed) return '"water"';
        if (b.stage == Stage.Growing) return '"harvest"';
        return 'null';
    }

    function _stageToStr(Stage s) internal pure returns (string memory) {
        if (s == Stage.Empty) return 'empty';
        if (s == Stage.Seed) return 'seed';
        if (s == Stage.Growing) return 'growing';
        return 'ready';
    }

    function _uToStr(uint256 v) internal pure returns (string memory) {
        if (v == 0) return '0';
        uint256 j = v;
        uint256 len;
        while (j != 0) {
            len++;
            j /= 10;
        }
        bytes memory bstr = new bytes(len);
        uint256 k = len;
        j = v;
        while (j != 0) {
            bstr[--k] = bytes1(uint8(48 + j % 10));
            j /= 10;
        }
        return string(bstr);
    }
}


