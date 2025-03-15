// Coup card game implementation - test mode with all cards visible

// Card class for character cards
class Card {
    constructor(character) {
        this.character = character;
        this.eliminated = false;
    }
}

// Player class
class Player {
    constructor(name, id) {
        this.name = name;
        this.id = id;
        this.coins = 2;
        this.cards = [];
        this.eliminated = false;
    }

    // Check if player is alive (has at least one card)
    isAlive() {
        return this.cards.some(card => !card.eliminated);
    }

    // Count how many non-eliminated cards the player has
    influenceCount() {
        return this.cards.filter(card => !card.eliminated).length;
    }

    // Lose influence (eliminate a card)
    loseInfluence(cardIndex) {
        if (cardIndex !== undefined && cardIndex >= 0 && cardIndex < this.cards.length) {
            this.cards[cardIndex].eliminated = true;
        } else {
            // Find first non-eliminated card
            const cardToEliminate = this.cards.find(card => !card.eliminated);
            if (cardToEliminate) {
                cardToEliminate.eliminated = true;
            }
        }
        
        // Check if player is eliminated
        if (!this.isAlive()) {
            this.eliminated = true;
        }
    }

    // Check if player has a specific character
    hasCharacter(character) {
        return this.cards.some(card => !card.eliminated && card.character === character);
    }
}

// Game class
class CoupGame {
    constructor() {
        console.log("CoupGame constructor called");
        this.players = [];
        this.deck = [];
        this.currentPlayerIndex = 0;
        this.gameState = 'setup'; // setup, play, gameover
        this.treasury = 50; // Total coins in game
        this.log = [];
        
        // Game action state
        this.pendingAction = null;
        this.pendingTarget = null;
        this.pendingExchangeCards = [];
        this.pendingChallengeBy = null;
        this.pendingBlockBy = null;
        
        // Locks to prevent multiple turn transitions
        this.turnLock = false;
        this.lastTurnTimestamp = 0;
        
        console.log("CoupGame initialized");
    }

    // Initialize the game
    initGame(playerNames) {
        console.log("initGame called with playerNames:", playerNames);
        // Reset the game state
        this.players = [];
        this.deck = [];
        this.currentPlayerIndex = 0;
        this.gameState = 'play';
        this.log = [];
        
        // Create players
        for (let i = 0; i < playerNames.length; i++) {
            this.players.push(new Player(playerNames[i], i));
        }
        console.log(`Created ${this.players.length} players`);
        
        // Initialize the deck with 3 of each character
        const characters = ['Duke', 'Assassin', 'Captain', 'Ambassador', 'Contessa'];
        for (const character of characters) {
            for (let i = 0; i < 3; i++) {
                this.deck.push(new Card(character));
            }
        }
        console.log(`Created deck with ${this.deck.length} cards`);
        
        // Shuffle the deck
        this.shuffleDeck();
        
        // Deal 2 cards to each player
        for (const player of this.players) {
            player.cards.push(this.drawCard());
            player.cards.push(this.drawCard());
        }
        console.log("Dealt cards to players");
        
        // Allocate coins to players (2 each)
        // (already done in the Player constructor)
        this.treasury -= this.players.length * 2;
        
        // Log game start
        this.addLog('Game started');
        this.addLog(`${this.players.length} players: ${this.players.map(p => p.name).join(', ')}`);
        this.addLog(`${this.getCurrentPlayer().name}'s turn`);
        console.log("Game initialization complete");
    }

    // Shuffle the deck
    shuffleDeck() {
        for (let i = this.deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
        }
    }

    // Draw a card from the deck
    drawCard() {
        if (this.deck.length === 0) {
            return null;
        }
        return this.deck.pop();
    }

    // Return a card to the deck and shuffle
    returnCardToDeck(card) {
        this.deck.push(card);
        this.shuffleDeck();
    }

    // Get the current player
    getCurrentPlayer() {
        return this.players[this.currentPlayerIndex];
    }

    // Move to the next player
    nextPlayer() {
        console.log(`nextPlayer called, current player index: ${this.currentPlayerIndex}`);
        
        // Implement a lock to prevent recursive calls or duplicate calls within a short time
        const now = Date.now();
        if (this.turnLock || (now - this.lastTurnTimestamp < 100)) {
            console.log(`Turn change locked or too frequent: locked=${this.turnLock}, last turn was ${now - this.lastTurnTimestamp}ms ago`);
            return; // Skip this turn change
        }
        
        // Set the lock
        this.turnLock = true;
        this.lastTurnTimestamp = now;
        
        // Store the starting player ID
        const startingPlayerId = this.currentPlayerIndex;
        const startingPlayerName = this.players[startingPlayerId].name;
        let loopCount = 0;
        
        // Find the next alive player
        do {
            this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
            loopCount++;
            
            // If we've gone through all players and none are alive, the game is over
            if (loopCount > this.players.length) {
                console.log("Loop count exceeded player count, ending game");
                this.gameState = 'gameover';
                break;
            }
            
            console.log(`Checking player ${this.currentPlayerIndex} (${this.players[this.currentPlayerIndex].name}): alive=${this.players[this.currentPlayerIndex].isAlive()}`);
            
        } while (!this.getCurrentPlayer().isAlive());
        
        // Reset any pending actions
        this.pendingAction = null;
        this.pendingTarget = null;
        this.pendingBlockBy = null;
        this.pendingExchangeCards = [];
        
        // Check if game is over (only one player alive)
        const alivePlayers = this.players.filter(player => player.isAlive());
        console.log(`Alive players: ${alivePlayers.length}`);
        
        if (alivePlayers.length === 1) {
            this.gameState = 'gameover';
            this.addLog(`Game over! ${alivePlayers[0].name} wins!`);
        } else {
            // Only log if we actually moved to a different player
            // This prevents double-logging when there are intermediate calls
            if (this.currentPlayerIndex !== startingPlayerId) {
                this.addLog(`${this.getCurrentPlayer().name}'s turn`);
                
                // If player has 10+ coins, they must coup
                if (this.getCurrentPlayer().coins >= 10) {
                    this.addLog(`${this.getCurrentPlayer().name} has 10+ coins and must coup`);
                }
            } else {
                console.log(`Skipping turn log - still on same player ${startingPlayerName}`);
            }
        }
        
        console.log(`nextPlayer (${now}) completed, new current player index: ${this.currentPlayerIndex} (${this.getCurrentPlayer().name})`);
        
        // Release the lock
        this.turnLock = false;
    }

    // Find a player by ID
    getPlayerById(id) {
        return this.players.find(player => player.id === id);
    }

    // Add a message to the game log
    addLog(message) {
        const timestamp = new Date().toLocaleTimeString();
        const fullMessage = `[${timestamp}] ${message}`;
        
        // Check for duplicate turn messages
        if (message.endsWith("'s turn")) {
            // Extract player name from message
            const playerName = message.substring(0, message.length - 7);
            
            // Check if this is a duplicate (looking at the last 2 log entries)
            if (this.log.length > 0) {
                const lastLog = this.log[this.log.length - 1];
                if (lastLog.includes(`${playerName}'s turn`)) {
                    console.log(`Suppressing duplicate turn message for ${playerName}`);
                    return; // Skip duplicate
                }
                
                // Also check for multiple consecutive turn messages
                if (this.log.length > 1 && lastLog.includes("'s turn")) {
                    const secondLastLog = this.log[this.log.length - 2];
                    if (secondLastLog.includes("'s turn")) {
                        console.log(`Three consecutive turn messages detected. Suppressing: ${message}`);
                        return; // Skip to avoid 3 turn messages in a row
                    }
                }
            }
        }
        
        // Add message to log
        this.log.push(fullMessage);
        console.log(fullMessage);
        
        try {
            // Update the UI log if it exists
            const logEntries = document.getElementById('log-entries');
            if (logEntries) {
                const logEntry = document.createElement('div');
                logEntry.className = 'log-entry';
                logEntry.textContent = fullMessage;
                logEntries.appendChild(logEntry);
                
                // Auto-scroll to bottom
                logEntries.scrollTop = logEntries.scrollHeight;
            }
        } catch (error) {
            console.warn("Could not update log UI:", error);
        }
    }

    // GAME ACTIONS

    // Income action
    income() {
        const player = this.getCurrentPlayer();
        player.coins++;
        this.treasury--;
        this.addLog(`${player.name} took Income (+1 coin)`);
        this.nextPlayer();
        return true;
    }

    // Foreign Aid action
    foreignAid() {
        const currentPlayer = this.getCurrentPlayer();
        console.log(`Foreign Aid initiated by ${currentPlayer.name} (id: ${currentPlayer.id})`);
        
        this.pendingAction = {
            type: 'foreignAid',
            player: currentPlayer,
            blockableBy: ['Duke']
        };
        
        this.addLog(`${currentPlayer.name} is attempting Foreign Aid (+2 coins)`);
        return false; // Don't go to next player yet, wait for blocks/challenges
    }

    // Tax action (Duke)
    tax() {
        this.pendingAction = {
            type: 'tax',
            player: this.getCurrentPlayer(),
            character: 'Duke',
            challengeable: true
        };
        
        this.addLog(`${this.getCurrentPlayer().name} is attempting Tax (as Duke, +3 coins)`);
        return false; // Don't go to next player yet, wait for challenges
    }

    // Steal action (Captain)
    steal(targetId) {
        const target = this.getPlayerById(targetId);
        const currentPlayer = this.getCurrentPlayer();
        
        console.log(`Steal action: ${currentPlayer.name} stealing from ${target.name}`);
        
        this.pendingAction = {
            type: 'steal',
            player: currentPlayer,
            character: 'Captain',
            challengeable: true,
            target: target,
            blockableBy: ['Captain', 'Ambassador']
        };
        
        console.log("Created pendingAction for steal:", this.pendingAction);
        console.log("blockableBy:", this.pendingAction.blockableBy);
        
        this.addLog(`${currentPlayer.name} is attempting to Steal (as Captain) from ${target.name}`);
        return false; // Don't go to next player yet, wait for blocks/challenges
    }

    // Assassinate action (Assassin)
    assassinate(targetId) {
        const player = this.getCurrentPlayer();
        const target = this.getPlayerById(targetId);
        
        if (player.coins < 3) {
            this.addLog(`${player.name} doesn't have enough coins to assassinate`);
            return true; // Continue the game
        }
        
        player.coins -= 3;
        this.treasury += 3;
        
        this.pendingAction = {
            type: 'assassinate',
            player: player,
            character: 'Assassin',
            challengeable: true,
            target: target,
            blockableBy: ['Contessa']
        };
        
        this.addLog(`${player.name} is attempting to Assassinate (as Assassin) ${target.name}`);
        return false; // Don't go to next player yet, wait for blocks/challenges
    }

    // Exchange action (Ambassador)
    exchange() {
        this.pendingAction = {
            type: 'exchange',
            player: this.getCurrentPlayer(),
            character: 'Ambassador',
            challengeable: true
        };
        
        this.addLog(`${this.getCurrentPlayer().name} is attempting to Exchange cards (as Ambassador)`);
        return false; // Don't go to next player yet, wait for challenges
    }

    // Coup action
    coup(targetId) {
        const player = this.getCurrentPlayer();
        const target = this.getPlayerById(targetId);
        
        if (player.coins < 7) {
            this.addLog(`${player.name} doesn't have enough coins to coup`);
            return true; // Continue the game
        }
        
        player.coins -= 7;
        this.treasury += 7;
        
        this.addLog(`${player.name} launched a Coup against ${target.name}`);
        
        // Ask target to choose which influence to lose
        this.pendingAction = {
            type: 'coup',
            player: player,
            target: target,
            loseInfluence: true
        };
        
        return false; // Don't go to next player yet, wait for target to lose influence
    }

    // CHALLENGE RESOLUTION

    // Handle a challenge
    challenge(challengerId) {
        const challenger = this.getPlayerById(challengerId);
        const challenged = this.pendingAction.player;
        const claimedCharacter = this.pendingAction.character;
        
        this.addLog(`${challenger.name} challenges ${challenged.name}'s claim to have ${claimedCharacter}`);
        
        // Check if the challenged player actually has the claimed character
        let hasCharacter = false;
        let cardToReplaceIndex = -1;
        
        // Find the card that matches the claimed character
        for (let i = 0; i < challenged.cards.length; i++) {
            if (!challenged.cards[i].eliminated && challenged.cards[i].character === claimedCharacter) {
                hasCharacter = true;
                cardToReplaceIndex = i;
                break;
            }
        }
        
        if (hasCharacter) {
            // Challenge failed
            this.addLog(`Challenge failed! ${challenged.name} reveals ${claimedCharacter}`);
            
            // Return the revealed card to the deck and draw a new one
            if (cardToReplaceIndex >= 0) {
                // Add the revealed card back to the deck
                const revealedCard = challenged.cards[cardToReplaceIndex];
                this.deck.push(revealedCard);
                this.addLog(`${challenged.name} returns the revealed card to the deck and draws a new one`);
                
                // Shuffle the deck
                this.shuffleDeck();
                
                // Draw a new card for the player
                const newCard = this.drawCard();
                if (newCard) {
                    challenged.cards[cardToReplaceIndex] = newCard;
                } else {
                    this.addLog(`The deck is empty! ${challenged.name} couldn't draw a new card.`);
                }
            }
            
            // Challenger loses influence
            challenger.loseInfluence();
            this.addLog(`${challenger.name} loses influence`);
            
            // Log action details for debugging
            console.log("Pending action after challenge:", {
                type: this.pendingAction.type,
                player: this.pendingAction.player?.name,
                target: this.pendingAction.target?.name,
                character: this.pendingAction.character,
                blockableBy: this.pendingAction.blockableBy
            });
            
            // If it was a targeted action, continue with the action
            if (this.pendingAction.target) {
                // Always check for blocks for targeted actions with blockableBy
                if (this.pendingAction.blockableBy && this.pendingAction.blockableBy.length > 0) {
                    // If action can be blocked, check for blocks
                    console.log(`Action can be blocked by: ${this.pendingAction.blockableBy.join(', ')}`);
                    return this.checkForBlocks();
                } else {
                    // Otherwise, complete the action
                    console.log("Action can't be blocked, completing");
                    return this.completeAction();
                }
            } else {
                // Complete the action
                console.log("Non-targeted action, completing");
                return this.completeAction();
            }
        } else {
            // Challenge succeeded
            this.addLog(`Challenge succeeded! ${challenged.name} does not have ${claimedCharacter}`);
            
            // Challenged player loses influence
            challenged.loseInfluence();
            this.addLog(`${challenged.name} loses influence`);
            
            // Action is canceled
            this.pendingAction = null;
            this.nextPlayer();
            return true;
        }
    }

    // BLOCK RESOLUTION

    // Check if anyone wants to block the pending action
    checkForBlocks() {
        // For now, we're just displaying the UI for blocks
        // The actual blocking logic will be handled by user input
        return false;
    }

    // Handle a block
    block(blockerId, character) {
        const blocker = this.getPlayerById(blockerId);
        const blockedPlayer = this.pendingAction.player;
        
        this.pendingBlockBy = {
            player: blocker,
            character: character
        };
        
        this.addLog(`${blocker.name} blocks with ${character}`);
        
        // The block can be challenged
        return false;
    }

    // Challenge a block
    challengeBlock(challengerId) {
        const challenger = this.getPlayerById(challengerId);
        const challenged = this.pendingBlockBy.player;
        const claimedCharacter = this.pendingBlockBy.character;
        
        this.addLog(`${challenger.name} challenges ${challenged.name}'s claim to have ${claimedCharacter}`);
        
        // Check if the challenged player actually has the claimed character
        let hasCharacter = false;
        let cardToReplaceIndex = -1;
        
        // Find the card that matches the claimed character
        for (let i = 0; i < challenged.cards.length; i++) {
            if (!challenged.cards[i].eliminated && challenged.cards[i].character === claimedCharacter) {
                hasCharacter = true;
                cardToReplaceIndex = i;
                break;
            }
        }
        
        if (hasCharacter) {
            // Challenge failed
            this.addLog(`Challenge failed! ${challenged.name} reveals ${claimedCharacter}`);
            
            // Return the revealed card to the deck and draw a new one
            if (cardToReplaceIndex >= 0) {
                // Add the revealed card back to the deck
                const revealedCard = challenged.cards[cardToReplaceIndex];
                this.deck.push(revealedCard);
                this.addLog(`${challenged.name} returns the revealed card to the deck and draws a new one`);
                
                // Shuffle the deck
                this.shuffleDeck();
                
                // Draw a new card for the player
                const newCard = this.drawCard();
                if (newCard) {
                    challenged.cards[cardToReplaceIndex] = newCard;
                } else {
                    this.addLog(`The deck is empty! ${challenged.name} couldn't draw a new card.`);
                }
            }
            
            // Challenger loses influence
            challenger.loseInfluence();
            this.addLog(`${challenger.name} loses influence`);
            
            // Block succeeds, action is canceled
            this.pendingAction = null;
            this.pendingBlockBy = null;
            this.nextPlayer();
            return true;
        } else {
            // Challenge succeeded
            this.addLog(`Challenge succeeded! ${challenged.name} does not have ${claimedCharacter}`);
            
            // Challenged player loses influence
            challenged.loseInfluence();
            this.addLog(`${challenged.name} loses influence`);
            
            // Block fails, continue with action
            this.pendingBlockBy = null;
            return this.completeAction();
        }
    }

    // COMPLETING ACTIONS

    // Complete the pending action
    completeAction() {
        console.log("Completing action:", this.pendingAction);
        
        if (!this.pendingAction) {
            console.log("No pending action to complete");
            this.nextPlayer();
            return true;
        }
        
        const action = this.pendingAction;
        const player = action.player;
        
        // We need to track what type of action we're completing
        const actionType = action.type;
        console.log(`Action type: ${actionType}`);
        
        switch (actionType) {
            case 'foreignAid':
                player.coins += 2;
                this.treasury -= 2;
                this.addLog(`${player.name} took Foreign Aid (+2 coins)`);
                break;
                
            case 'tax':
                player.coins += 3;
                this.treasury -= 3;
                this.addLog(`${player.name} collected Tax (+3 coins)`);
                break;
                
            case 'steal':
                const stealAmount = Math.min(2, action.target.coins);
                player.coins += stealAmount;
                action.target.coins -= stealAmount;
                this.addLog(`${player.name} stole ${stealAmount} coins from ${action.target.name}`);
                break;
                
            case 'assassinate':
                // Target loses influence
                action.target.loseInfluence();
                this.addLog(`${action.target.name} loses influence`);
                break;
                
            case 'exchange':
                // Draw 2 cards (already done in the UI code)
                this.addLog(`${player.name} exchanged cards`);
                break;
                
            case 'coup':
                // Target loses influence (already done in UI code)
                this.addLog(`${action.target.name} loses influence from the Coup`);
                break;
        }
        
        // IMPORTANT: Set a flag to track that we're already transitioning turns
        // This will be used by the UI to avoid multiple turn transitions
        window.turningInProgress = true;
        
        // Store the current player index before clearing
        this.currentPlayerIndex = action.player.id;
        console.log(`Setting current player index to ${this.currentPlayerIndex} (${player.name}) before going to next player`);
        
        // Clear the pending action first to avoid recursive issues
        this.pendingAction = null;
        
        // Move to next player - BUT ONLY ONCE!
        this.nextPlayer();
        console.log(`After nextPlayer, currentPlayerIndex is now ${this.currentPlayerIndex}`);
        
        // Finish turn transition
        window.turningInProgress = false;
        
        return true;
    }
}

// UI CONTROLLER
class GameUI {
    constructor() {
        this.game = new CoupGame();
        this.setupEventListeners();
    }

    // Set up event listeners for buttons and UI interactions
    setupEventListeners() {
        console.log("Setting up event listeners");
        try {
            // SETUP SCREEN
            const numPlayersElem = document.getElementById('num-players');
            if (numPlayersElem) {
                numPlayersElem.addEventListener('change', () => this.updatePlayerInputs());
                console.log("Added listener to num-players");
            } else {
                console.error("Could not find num-players element");
            }
            
            const startGameBtn = document.getElementById('start-game-btn');
            if (startGameBtn) {
                // Use a direct function reference instead of an arrow function
                startGameBtn.addEventListener('click', this.startGame.bind(this));
                console.log("Added listener to start-game-btn");
            } else {
                console.error("Could not find start-game-btn element");
            }
            
            // ACTIONS
            this.addEventListenerSafely('income-btn', 'click', this.handleIncome.bind(this));
            this.addEventListenerSafely('foreign-aid-btn', 'click', this.handleForeignAid.bind(this));
            this.addEventListenerSafely('tax-btn', 'click', this.handleTax.bind(this));
            this.addEventListenerSafely('steal-btn', 'click', this.handleStealStart.bind(this));
            this.addEventListenerSafely('assassinate-btn', 'click', this.handleAssassinateStart.bind(this));
            this.addEventListenerSafely('exchange-btn', 'click', this.handleExchangeStart.bind(this));
            this.addEventListenerSafely('coup-btn', 'click', this.handleCoupStart.bind(this));
            
            // TARGET SELECTION
            this.addEventListenerSafely('cancel-target', 'click', this.cancelTargetSelection.bind(this));
            
            // EXCHANGE PANEL
            this.addEventListenerSafely('confirm-exchange', 'click', this.confirmExchange.bind(this));
            this.addEventListenerSafely('cancel-exchange', 'click', this.cancelExchange.bind(this));
            
            // CHALLENGE PANEL
            this.addEventListenerSafely('no-challenge', 'click', this.noChallenges.bind(this));
            
            // BLOCK PANEL
            this.addEventListenerSafely('no-block', 'click', this.noBlocks.bind(this));
            
            console.log("Event listeners setup complete");
        } catch (error) {
            console.error("Error setting up event listeners:", error);
        }
    }
    
    // Helper method to safely add event listeners
    addEventListenerSafely(elementId, eventType, handler) {
        const element = document.getElementById(elementId);
        if (element) {
            element.addEventListener(eventType, handler);
            console.log(`Added ${eventType} listener to ${elementId}`);
        } else {
            console.warn(`Could not find element with id: ${elementId}`);
        }
    }

    // Update player name inputs based on number of players
    updatePlayerInputs() {
        const numPlayers = parseInt(document.getElementById('num-players').value);
        const container = document.getElementById('player-names-container');
        container.innerHTML = '';
        
        for (let i = 0; i < numPlayers; i++) {
            const div = document.createElement('div');
            div.className = 'player-name-input';
            
            const label = document.createElement('label');
            label.setAttribute('for', `player-name-${i}`);
            label.textContent = `Player ${i + 1} Name:`;
            
            const input = document.createElement('input');
            input.type = 'text';
            input.id = `player-name-${i}`;
            input.value = `Player ${i + 1}`;
            
            div.appendChild(label);
            div.appendChild(input);
            container.appendChild(div);
        }
    }

    // Start the game
    startGame() {
        console.log("Starting game...");
        try {
            const numPlayers = parseInt(document.getElementById('num-players').value);
            console.log(`Number of players: ${numPlayers}`);
            const playerNames = [];
            
            for (let i = 0; i < numPlayers; i++) {
                const inputElement = document.getElementById(`player-name-${i}`);
                console.log(`Player input ${i}:`, inputElement);
                const name = inputElement ? inputElement.value.trim() : `Player ${i + 1}`;
                playerNames.push(name || `Player ${i + 1}`);
            }
            
            console.log("Player names:", playerNames);
            
            // Initialize the game
            this.game.initGame(playerNames);
            
            // Hide setup, show game
            const setupElement = document.getElementById('game-setup');
            console.log("Setup element:", setupElement);
            setupElement.classList.remove('active');
            setupElement.classList.add('hidden');
            
            // Render the game state
            this.renderGame();
            console.log("Game started successfully");
        } catch (error) {
            console.error("Error starting game:", error);
        }
    }

    // Render the entire game state
    renderGame() {
        console.log("Rendering game state");
        try {
            // Check for pending actions
            const hasPendingAction = this.game.pendingAction !== null;
            const hasPendingBlock = this.game.pendingBlockBy !== null;
            
            if (!hasPendingAction && !hasPendingBlock) {
                // No pending actions, hide all panels
                this.hideAllPanels();
            }
            
            this.renderPlayers();
            this.renderDeck();
            this.renderTreasury();
            this.renderCurrentPlayer();
            this.updateActionButtons();
            
            // Check for game over
            if (this.game.gameState === 'gameover') {
                const winner = this.game.players.find(player => player.isAlive());
                const gameStateElem = document.getElementById('game-state');
                if (gameStateElem) {
                    gameStateElem.textContent = `Game Over! ${winner.name} wins!`;
                }
                
                // Disable all action buttons
                const actionButtons = document.querySelectorAll('#actions-panel button');
                actionButtons.forEach(button => {
                    button.disabled = true;
                });
                
                // Hide all panels
                this.hideAllPanels();
            }
            console.log("Game rendering complete");
        } catch (error) {
            console.error("Error rendering game:", error);
        }
    }

    // Render all players and their cards
    renderPlayers() {
        const container = document.getElementById('players-container');
        container.innerHTML = '';
        
        for (const player of this.game.players) {
            const playerDiv = document.createElement('div');
            playerDiv.className = 'player-area';
            playerDiv.dataset.playerId = player.id;
            
            if (player.eliminated) {
                playerDiv.classList.add('eliminated');
            }
            
            if (player.id === this.game.currentPlayerIndex) {
                playerDiv.classList.add('current');
            }
            
            // Player name
            const nameDiv = document.createElement('div');
            nameDiv.className = 'player-name';
            nameDiv.textContent = player.name;
            playerDiv.appendChild(nameDiv);
            
            // Player coins
            const coinsDiv = document.createElement('div');
            coinsDiv.className = 'player-coins';
            coinsDiv.textContent = `Coins: ${player.coins}`;
            playerDiv.appendChild(coinsDiv);
            
            // Player influence count
            const influenceDiv = document.createElement('div');
            influenceDiv.textContent = `Influence: ${player.influenceCount()}`;
            playerDiv.appendChild(influenceDiv);
            
            // Player cards
            const cardsDiv = document.createElement('div');
            cardsDiv.className = 'player-cards';
            
            for (let i = 0; i < player.cards.length; i++) {
                const card = player.cards[i];
                const cardDiv = document.createElement('div');
                cardDiv.className = 'card';
                cardDiv.dataset.cardIndex = i;
                
                if (card.eliminated) {
                    cardDiv.classList.add('eliminated');
                }
                
                // We're showing all cards in test mode
                cardDiv.classList.add(card.character.toLowerCase());
                cardDiv.classList.add('revealed');
                
                const cardName = document.createElement('div');
                cardName.className = 'card-name';
                cardName.textContent = card.character;
                cardDiv.appendChild(cardName);
                
                // If this player needs to lose influence, add event listener
                if (this.game.pendingAction && 
                    this.game.pendingAction.loseInfluence && 
                    this.game.pendingAction.target === player) {
                    if (!card.eliminated) {
                        cardDiv.addEventListener('click', () => this.handleLoseInfluence(player.id, i));
                        cardDiv.style.cursor = 'pointer';
                    }
                }
                
                cardsDiv.appendChild(cardDiv);
            }
            
            playerDiv.appendChild(cardsDiv);
            container.appendChild(playerDiv);
        }
    }

    // Render the deck info
    renderDeck() {
        document.getElementById('deck-count').textContent = `Cards remaining: ${this.game.deck.length}`;
    }

    // Render the treasury info
    renderTreasury() {
        document.getElementById('treasury-count').textContent = `Coins: ${this.game.treasury}`;
    }

    // Update the current player display
    renderCurrentPlayer() {
        const currentPlayer = this.game.getCurrentPlayer();
        document.getElementById('current-player-name').textContent = currentPlayer.name;
        
        // Update game state message
        if (this.game.gameState === 'play') {
            if (currentPlayer.coins >= 10) {
                document.getElementById('game-state').textContent = `${currentPlayer.name} must coup (10+ coins)`;
            } else {
                document.getElementById('game-state').textContent = `${currentPlayer.name}'s turn`;
            }
        }
    }

    // Update action buttons based on current player's state
    updateActionButtons() {
        const currentPlayer = this.game.getCurrentPlayer();
        
        // Disable all actions if game is over
        if (this.game.gameState === 'gameover') {
            const allButtons = document.querySelectorAll('#actions-panel button');
            allButtons.forEach(button => button.disabled = true);
            return;
        }
        
        // Enable/disable buttons based on player's coins and game state
        document.getElementById('income-btn').disabled = false;
        document.getElementById('foreign-aid-btn').disabled = false;
        document.getElementById('tax-btn').disabled = false;
        document.getElementById('steal-btn').disabled = this.getValidTargets('steal').length === 0;
        document.getElementById('exchange-btn').disabled = false;
        document.getElementById('assassinate-btn').disabled = 
            currentPlayer.coins < 3 || this.getValidTargets('assassinate').length === 0;
        
        // Coup is mandatory with 10+ coins
        const coupBtn = document.getElementById('coup-btn');
        coupBtn.disabled = currentPlayer.coins < 7 || this.getValidTargets('coup').length === 0;
        
        if (currentPlayer.coins >= 10) {
            // If player has 10+ coins, they must coup
            document.getElementById('income-btn').disabled = true;
            document.getElementById('foreign-aid-btn').disabled = true;
            document.getElementById('tax-btn').disabled = true;
            document.getElementById('steal-btn').disabled = true;
            document.getElementById('exchange-btn').disabled = true;
            document.getElementById('assassinate-btn').disabled = true;
        }
    }

    // Get valid targets for an action
    getValidTargets(action) {
        const targets = [];
        const currentPlayerId = this.game.currentPlayerIndex;
        
        for (const player of this.game.players) {
            // Skip current player and eliminated players
            if (player.id !== currentPlayerId && player.isAlive()) {
                if (action === 'steal') {
                    // Can only steal from players with coins
                    if (player.coins > 0) {
                        targets.push(player);
                    }
                } else if (action === 'assassinate' || action === 'coup') {
                    targets.push(player);
                }
            }
        }
        
        return targets;
    }

    // Show target selection UI
    showTargetSelection(action) {
        const targets = this.getValidTargets(action);
        if (targets.length === 0) {
            return false;
        }
        
        const targetPanel = document.getElementById('target-selection');
        const buttonContainer = document.getElementById('target-buttons');
        buttonContainer.innerHTML = '';
        
        for (const target of targets) {
            const button = document.createElement('button');
            button.textContent = target.name;
            button.dataset.targetId = target.id;
            button.addEventListener('click', () => this.handleTargetSelected(action, parseInt(target.id)));
            buttonContainer.appendChild(button);
        }
        
        targetPanel.classList.remove('hidden');
        return true;
    }

    // Hide target selection UI
    hideTargetSelection() {
        document.getElementById('target-selection').classList.add('hidden');
    }

    // Show exchange panel
    showExchangePanel(cards) {
        const exchangePanel = document.getElementById('exchange-panel');
        const cardsContainer = document.getElementById('exchange-cards');
        cardsContainer.innerHTML = '';
        
        // Current player's cards
        const player = this.game.getCurrentPlayer();
        const playerCards = player.cards.filter(card => !card.eliminated);
        
        // Create checkboxes for all cards (player's + drawn)
        const allCards = [...playerCards, ...cards];
        
        for (let i = 0; i < allCards.length; i++) {
            const card = allCards[i];
            
            const cardDiv = document.createElement('div');
            cardDiv.className = `card ${card.character.toLowerCase()}`;
            
            const cardName = document.createElement('div');
            cardName.className = 'card-name';
            cardName.textContent = card.character;
            cardDiv.appendChild(cardName);
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `exchange-card-${i}`;
            checkbox.value = i;
            checkbox.dataset.cardIndex = i;
            
            // Preselect player's current cards
            if (i < playerCards.length) {
                checkbox.checked = true;
            }
            
            // Limit selections to player's influence count
            checkbox.addEventListener('change', () => {
                const checked = document.querySelectorAll('#exchange-cards input:checked');
                if (checked.length > playerCards.length) {
                    checkbox.checked = false;
                }
            });
            
            cardDiv.appendChild(checkbox);
            cardsContainer.appendChild(cardDiv);
        }
        
        exchangePanel.classList.remove('hidden');
    }

    // Hide exchange panel
    hideExchangePanel() {
        document.getElementById('exchange-panel').classList.add('hidden');
    }

    // Show challenge panel
    showChallengePanel() {
        if (!this.game.pendingAction || !this.game.pendingAction.challengeable) {
            return false;
        }
        
        const action = this.game.pendingAction;
        const challengePanel = document.getElementById('challenge-panel');
        const challengeText = document.getElementById('challenge-text');
        const challengeButtons = document.getElementById('challenge-buttons');
        
        challengeText.textContent = `${action.player.name} claims to have ${action.character}. Challenge?`;
        challengeButtons.innerHTML = '';
        
        // Create challenge button for each other player
        for (const player of this.game.players) {
            if (player.id !== action.player.id && player.isAlive()) {
                const button = document.createElement('button');
                button.textContent = `${player.name} challenges`;
                button.dataset.playerId = player.id;
                button.addEventListener('click', () => this.handleChallenge(parseInt(player.id)));
                challengeButtons.appendChild(button);
            }
        }
        
        // Reset the No Challenge button handler
        const noChallenge = document.getElementById('no-challenge');
        if (noChallenge) {
            noChallenge.onclick = () => this.noChallenges();
        }
        
        challengePanel.classList.remove('hidden');
        return true;
    }

    // Hide challenge panel
    hideChallengePanel() {
        document.getElementById('challenge-panel').classList.add('hidden');
    }

    // Show block panel
    showBlockPanel() {
        if (!this.game.pendingAction || !this.game.pendingAction.blockableBy) {
            return false;
        }
        
        const action = this.game.pendingAction;
        const blockPanel = document.getElementById('block-panel');
        const blockText = document.getElementById('block-text');
        const blockButtons = document.getElementById('block-buttons');
        
        blockText.textContent = `${action.player.name} is using ${action.type}. Block?`;
        blockButtons.innerHTML = '';
        
        // If it's targeted action, the target can block
        const blockingPlayers = [];
        if (action.target) {
            blockingPlayers.push(action.target);
        } else {
            // Otherwise any player can block
            blockingPlayers.push(...this.game.players.filter(p => p.id !== action.player.id && p.isAlive()));
        }
        
        // Create block buttons
        for (const player of blockingPlayers) {
            for (const character of action.blockableBy) {
                const button = document.createElement('button');
                button.textContent = `${player.name} blocks with ${character}`;
                button.dataset.playerId = player.id;
                button.dataset.character = character;
                button.addEventListener('click', () => this.handleBlock(parseInt(player.id), character));
                blockButtons.appendChild(button);
            }
        }
        
        // Reset the No Block button handler
        const noBlockBtn = document.getElementById('no-block');
        if (noBlockBtn) {
            noBlockBtn.onclick = () => this.noBlocks();
        }
        
        blockPanel.classList.remove('hidden');
        return true;
    }

    // Hide block panel
    hideBlockPanel() {
        document.getElementById('block-panel').classList.add('hidden');
    }

    // Show block challenge panel
    showBlockChallengePanel() {
        if (!this.game.pendingBlockBy) {
            return false;
        }
        
        const block = this.game.pendingBlockBy;
        const challengePanel = document.getElementById('challenge-panel');
        const challengeText = document.getElementById('challenge-text');
        const challengeButtons = document.getElementById('challenge-buttons');
        
        challengeText.textContent = `${block.player.name} claims to have ${block.character} to block. Challenge?`;
        challengeButtons.innerHTML = '';
        
        // The player who was blocked can challenge
        const challenger = this.game.pendingAction.player;
        const button = document.createElement('button');
        button.textContent = `${challenger.name} challenges`;
        button.dataset.playerId = challenger.id;
        button.addEventListener('click', () => this.handleBlockChallenge(challenger.id));
        challengeButtons.appendChild(button);
        
        // Add event listener to "No Challenge" button for blocks
        const noChallenge = document.getElementById('no-challenge');
        if (noChallenge) {
            // Make sure to explicitly clear any previously set onclick handlers
            noChallenge.onclick = null;
            noChallenge.onclick = () => {
                console.log("No challenge to block clicked");
                this.handleNoBlockChallenge();
            };
        }
        
        challengePanel.classList.remove('hidden');
        return true;
    }

    // ACTION HANDLERS

    // Handle income action
    handleIncome() {
        if (this.game.income()) {
            this.renderGame();
        }
    }

    // Handle foreign aid action
    handleForeignAid() {
        console.log("Processing Foreign Aid action");
        if (this.game.foreignAid()) {
            console.log("Foreign Aid completed directly");
            this.renderGame();
            return;
        }
        
        // Log current player before checking for blocks
        console.log(`Current player before block check: ${this.game.currentPlayerIndex}`);
        
        // Check for blocks
        if (this.showBlockPanel()) {
            console.log("Showing block panel for Foreign Aid");
            // Wait for block response
        } else {
            // No blocks possible, complete action
            console.log("No block possible for Foreign Aid, completing action");
            this.game.completeAction();
            this.hideAllPanels();
            this.renderGame();
            
            // Log final state
            console.log(`Foreign Aid completed, current player now: ${this.game.currentPlayerIndex}`);
        }
    }

    // Handle tax action
    handleTax() {
        if (this.game.tax()) {
            this.renderGame();
            return;
        }
        
        // Check for challenges
        if (this.showChallengePanel()) {
            // Wait for challenge response
        } else {
            // No challenges, complete action
            this.game.completeAction();
            this.hideBlockPanel();
            this.hideChallengePanel();
            this.renderGame();
        }
    }

    // Start steal action
    handleStealStart() {
        if (this.showTargetSelection('steal')) {
            // Wait for target selection
        }
    }

    // Handle steal after target selection
    handleSteal(targetId) {
        if (this.game.steal(targetId)) {
            this.renderGame();
            return;
        }
        
        // Check for challenges
        if (this.showChallengePanel()) {
            // Wait for challenge response
        } else {
            // No challenges, check for blocks
            if (this.showBlockPanel()) {
                // Wait for block response
            } else {
                // No blocks, complete action
                this.game.completeAction();
                this.hideBlockPanel();
                this.hideChallengePanel();
                this.renderGame();
            }
        }
    }

    // Start assassinate action
    handleAssassinateStart() {
        if (this.showTargetSelection('assassinate')) {
            // Wait for target selection
        }
    }

    // Handle assassinate after target selection
    handleAssassinate(targetId) {
        if (this.game.assassinate(targetId)) {
            this.renderGame();
            return;
        }
        
        // Check for challenges
        if (this.showChallengePanel()) {
            // Wait for challenge response
        } else {
            // No challenges, check for blocks
            if (this.showBlockPanel()) {
                // Wait for block response
            } else {
                // No blocks, complete action
                this.game.completeAction();
                this.hideBlockPanel();
                this.hideChallengePanel();
                this.renderGame();
            }
        }
    }

    // Start exchange action
    handleExchangeStart() {
        if (this.game.exchange()) {
            this.renderGame();
            return;
        }
        
        // Check for challenges
        if (this.showChallengePanel()) {
            // Wait for challenge response
        } else {
            // No challenges, proceed with exchange
            this.handleExchangeCards();
        }
    }

    // Handle exchange cards logic
    handleExchangeCards() {
        // Draw 2 cards from the deck
        const drawnCards = [];
        for (let i = 0; i < 2; i++) {
            const card = this.game.drawCard();
            if (card) {
                drawnCards.push(card);
            }
        }
        
        this.game.pendingExchangeCards = drawnCards;
        this.showExchangePanel(drawnCards);
    }

    // Confirm exchange selection
    confirmExchange() {
        const player = this.game.getCurrentPlayer();
        const playerInfluence = player.influenceCount();
        
        // Get selected cards (to keep)
        const selectedIndices = Array.from(
            document.querySelectorAll('#exchange-cards input:checked')
        ).map(cb => parseInt(cb.dataset.cardIndex));
        
        if (selectedIndices.length !== playerInfluence) {
            alert(`You must select exactly ${playerInfluence} cards to keep.`);
            return;
        }
        
        // Get all available cards
        const playerCards = player.cards.filter(card => !card.eliminated);
        const allCards = [...playerCards, ...this.game.pendingExchangeCards];
        
        // Replace player's cards with selected ones
        const newCards = selectedIndices.map(i => allCards[i]);
        const returnCards = allCards.filter((_, i) => !selectedIndices.includes(i));
        
        // Update player's cards
        let cardIndex = 0;
        for (let i = 0; i < player.cards.length; i++) {
            if (!player.cards[i].eliminated) {
                player.cards[i] = newCards[cardIndex++];
            }
        }
        
        // Return unused cards to deck
        for (const card of returnCards) {
            this.game.returnCardToDeck(card);
        }
        
        this.hideExchangePanel();
        this.game.pendingExchangeCards = [];
        
        // Complete the action
        this.game.completeAction();
        this.renderGame();
    }

    // Cancel exchange
    cancelExchange() {
        // Return drawn cards to deck
        for (const card of this.game.pendingExchangeCards) {
            this.game.returnCardToDeck(card);
        }
        
        this.game.pendingExchangeCards = [];
        this.hideExchangePanel();
        
        // Cancel the action
        this.game.pendingAction = null;
        this.game.nextPlayer();
        this.renderGame();
    }

    // Start coup action
    handleCoupStart() {
        if (this.showTargetSelection('coup')) {
            // Wait for target selection
        }
    }

    // Handle coup after target selection
    handleCoup(targetId) {
        if (this.game.coup(targetId)) {
            this.renderGame();
        }
    }

    // Handle target selection for actions
    handleTargetSelected(action, targetId) {
        this.hideTargetSelection();
        
        switch (action) {
            case 'steal':
                this.handleSteal(targetId);
                break;
            case 'assassinate':
                this.handleAssassinate(targetId);
                break;
            case 'coup':
                this.handleCoup(targetId);
                break;
        }
    }

    // Cancel target selection
    cancelTargetSelection() {
        this.hideTargetSelection();
    }

    // Handle when a player is asked to lose influence
    handleLoseInfluence(playerId, cardIndex) {
        const player = this.game.getPlayerById(playerId);
        player.loseInfluence(cardIndex);
        
        this.game.addLog(`${player.name} revealed and lost ${player.cards[cardIndex].character}`);
        
        // Complete the action
        this.game.pendingAction = null;
        this.game.nextPlayer();
        this.renderGame();
    }

    // Handle a challenge
    handleChallenge(challengerId) {
        console.log(`Challenge initiated by player ${challengerId}`);
        this.hideChallengePanel();
        
        // Check if pending action before challenge
        if (this.game.pendingAction) {
            console.log("Pending action before challenge:", {
                type: this.game.pendingAction.type,
                player: this.game.pendingAction.player?.name,
                target: this.game.pendingAction.target?.name,
                blockableBy: this.game.pendingAction.blockableBy
            });
        }
        
        const challengeResult = this.game.challenge(challengerId);
        console.log(`Challenge result: ${challengeResult}`);
        
        if (challengeResult) {
            // Challenge succeeded, action is canceled
            console.log("Challenge succeeded, action canceled");
            this.hideAllPanels();
            this.renderGame();
        } else {
            // Challenge failed, continue with the action
            console.log("Challenge failed, continuing with action");
            
            // Check if the pending action still exists (it should, after a failed challenge)
            if (!this.game.pendingAction) {
                console.error("No pending action after failed challenge!");
                this.hideAllPanels();
                this.renderGame();
                return;
            }
            
            // Log the pending action details
            console.log("Pending action after challenge:", {
                type: this.game.pendingAction.type,
                player: this.game.pendingAction.player?.name,
                target: this.game.pendingAction.target?.name,
                blockableBy: this.game.pendingAction.blockableBy
            });
            
            // Check if the action is blockable
            if (this.game.pendingAction.blockableBy && this.game.pendingAction.blockableBy.length > 0) {
                console.log(`Action can be blocked by: ${this.game.pendingAction.blockableBy.join(', ')}`);
                
                // Show block panel
                const blockPanelShown = this.showBlockPanel();
                console.log(`Block panel shown: ${blockPanelShown}`);
                
                if (!blockPanelShown) {
                    // No blocks possible (no eligible players to block), complete action
                    console.log("No blocks possible, completing action");
                    this.game.completeAction();
                    this.hideAllPanels();
                    this.renderGame();
                }
                // If block panel was shown, wait for block response
            } else if (this.game.pendingAction.type === 'exchange') {
                // If exchange action, proceed with exchange
                console.log("Proceeding with exchange");
                this.handleExchangeCards();
            } else {
                // Otherwise, complete the action
                console.log("Completing non-blockable action");
                this.game.completeAction();
                this.hideAllPanels();
                this.renderGame();
            }
        }
    }

    // No challenges
    noChallenges() {
        console.log("No challenges chosen");
        this.hideChallengePanel();
        
        if (!this.game.pendingAction) {
            console.log("No pending action in noChallenges");
            this.hideAllPanels();
            this.renderGame();
            return;
        }
        
        // Make sure we're using the right player
        const actionPlayer = this.game.pendingAction.player;
        console.log(`Action player: ${actionPlayer.name} (id: ${actionPlayer.id})`);
        this.game.currentPlayerIndex = actionPlayer.id;
        
        // Log action details
        console.log("Pending action details:", {
            type: this.game.pendingAction.type,
            player: this.game.pendingAction.player?.name,
            target: this.game.pendingAction.target?.name,
            character: this.game.pendingAction.character,
            blockableBy: this.game.pendingAction.blockableBy
        });
        
        // If exchange action, proceed with exchange
        if (this.game.pendingAction.type === 'exchange') {
            console.log("Proceeding with exchange");
            this.handleExchangeCards();
        } else if (this.game.pendingAction.blockableBy && this.game.pendingAction.blockableBy.length > 0) {
            // If action can be blocked, check for blocks
            console.log(`Action can be blocked by: ${this.game.pendingAction.blockableBy.join(', ')}`);
            const showedBlockPanel = this.showBlockPanel();
            console.log(`Block panel shown: ${showedBlockPanel}`);
            
            if (showedBlockPanel) {
                // Wait for block response
                console.log("Waiting for block response");
            } else {
                // No blocks possible, complete action
                console.log("No blocks possible (even though action is blockable), completing action");
                this.game.completeAction();
                this.hideAllPanels();
                this.renderGame();
            }
        } else {
            // Otherwise, complete the action
            console.log("Completing unblockable action");
            this.game.completeAction();
            this.hideAllPanels();
            this.renderGame();
        }
    }
    
    // Handle case when no one challenges a block
    handleNoBlockChallenge() {
        this.hideAllPanels();
        
        // Get blocker and blocked player info before nullifying
        const blockedAction = this.game.pendingAction ? this.game.pendingAction.type : null;
        const blockedPlayer = this.game.pendingAction ? this.game.pendingAction.player : null;
        const blocker = this.game.pendingBlockBy ? this.game.pendingBlockBy.player : null;
        const blockCharacter = this.game.pendingBlockBy ? this.game.pendingBlockBy.character : null;
        
        // Block succeeds, action is canceled
        if (blockedAction && blocker && blockCharacter) {
            this.game.addLog(`${blocker.name} successfully blocked the ${blockedAction} with ${blockCharacter}.`);
        } else {
            this.game.addLog(`No one challenged the block. Block succeeds.`);
        }
        
        // Clear pending states
        this.game.pendingAction = null;
        this.game.pendingBlockBy = null;
        
        // Move to next player
        this.game.nextPlayer();
        this.renderGame();
    }

    // Handle a block
    handleBlock(blockerId, character) {
        console.log(`Block initiated by player ${blockerId} with ${character}`);
        this.hideBlockPanel();
        
        if (this.game.block(blockerId, character)) {
            this.renderGame();
        } else {
            // Check if block can be challenged
            const showedPanel = this.showBlockChallengePanel();
            console.log(`Block challenge panel shown: ${showedPanel}`);
            
            if (!showedPanel) {
                // If for some reason the panel couldn't be shown, auto-process the block
                console.log("Block challenge panel couldn't be shown, auto-accepting block");
                this.handleNoBlockChallenge();
            }
        }
    }

    // Handle a block challenge
    handleBlockChallenge(challengerId) {
        this.hideChallengePanel();
        
        if (this.game.challengeBlock(challengerId)) {
            this.renderGame();
        }
    }

    // No blocks
    noBlocks() {
        console.log("No blocks chosen");
        this.hideAllPanels();
        
        // Log the pending action and current player
        console.log("Current player before completing action:", this.game.currentPlayerIndex);
        if (this.game.pendingAction) {
            console.log("Pending action:", 
                       `type=${this.game.pendingAction.type}`,
                       `player=${this.game.pendingAction.player.name}(${this.game.pendingAction.player.id})`);
        } else {
            console.log("No pending action");
        }
        
        // Create a timestamp to track this action's completion
        const actionTimestamp = Date.now();
        console.log(`Action timestamp: ${actionTimestamp}`);
        
        // Complete the action
        if (this.game.pendingAction) {
            // Make sure we're completing from the right player
            const originalPlayer = this.game.currentPlayerIndex;
            this.game.currentPlayerIndex = this.game.pendingAction.player.id;
            console.log(`Set current player from ${originalPlayer} to action player: ${this.game.currentPlayerIndex}`);
            
            this.game.completeAction();
        } else {
            console.log("No pending action to complete");
            this.game.nextPlayer();
        }
        
        console.log(`Current player after completing action ${actionTimestamp}:`, this.game.currentPlayerIndex);
        this.renderGame();
    }
    
    // Helper to hide all UI panels
    hideAllPanels() {
        this.hideBlockPanel();
        this.hideChallengePanel();
        this.hideTargetSelection();
        this.hideExchangePanel();
    }
}

// Initialize the game UI when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM loaded - initializing game");
    try {
        // Make gameUI globally accessible
        window.gameUI = new GameUI();
        window.gameUI.updatePlayerInputs();
        console.log("Game initialized successfully");
        
        // Add debug for start button
        const startBtn = document.getElementById('start-game-btn');
        console.log("Start button:", startBtn);
        if (startBtn) {
            // Add a direct onclick handler
            startBtn.onclick = function() {
                console.log("Start button clicked");
                window.gameUI.startGame();
            };
        }
    } catch (error) {
        console.error("Error initializing game:", error);
    }
});