import { 
  IGameService,
  IGameLifecycleService,
  IGameStateService,
  IGameActionService,
  IGameValidationService
} from '../interfaces/IGameService';
import { IGameRepository } from '../interfaces/IGameRepository';
import { 
  Game, 
  Player, 
  Card, 
  PlayerID, 
  CardCharacter, 
  ActionType, 
  ResponseType,
  ActionRequest,
  GameState,
  GameAction,
  Response,
  GameLog,
  ACTION_PROPERTIES,
  CHARACTER_ABILITIES,
  GAME_CONSTANTS
} from '../types/game';
import { GameRules } from './GameRules';

export class GameService implements IGameService {
  private rules: IGameValidationService;

  constructor(private repository: IGameRepository) {
    this.rules = new GameRules();
  }
  
  // Method to vote for restart
  async voteForRestart(gameId: string, playerId: PlayerID): Promise<void> {
    const game = await this.repository.getGame(gameId);
    if (!game) throw new Error('Game not found');
    
    // Game must be in game_over state
    if (game.gameState !== 'game_over') {
      throw new Error('Game is not over yet');
    }
    
    // Initialize restartVotes array if it doesn't exist
    if (!game.restartVotes) {
      game.restartVotes = [];
    }
    
    // Check if player already voted
    if (game.restartVotes.includes(playerId)) {
      return; // Player already voted, do nothing
    }
    
    // Add player's vote
    game.restartVotes.push(playerId);
    
    // Log the vote
    const player = game.players.find(p => p.id === playerId);
    await this.addGameLog(gameId, `${player?.name || 'Unknown player'} voted to restart the game`);
    
    // Check if all players voted
    const activePlayers = game.players.filter(p => !p.eliminated);
    if (game.restartVotes.length === game.players.length) {
      // All players voted, restart the game
      await this.restartGame(game);
    } else {
      // Update game with new vote
      await this.repository.updateGame(game);
    }
  }
  
  // Method to restart the game with the same players
  private async restartGame(game: Game): Promise<void> {
    // Reset the game state
    game.gameState = 'setup';
    game.currentPlayerIndex = 0;
    game.currentAction = undefined;
    game.pendingActionFrom = undefined;
    game.restartVotes = [];
    game.deck = [];
    
    // Reset all players
    for (const player of game.players) {
      player.eliminated = false;
      player.coins = 0;
      player.cards = [];
    }
    
    // Add log
    game.logs.push(this.createLog('Game restarted with the same players'));
    
    // Start the new game immediately
    await this.repository.updateGame(game);
    await this.startGame(game.id);
  }
  
  // Method to cancel vote and return to lobby
  async cancelRestartVote(gameId: string, playerId: PlayerID): Promise<void> {
    const game = await this.repository.getGame(gameId);
    if (!game) throw new Error('Game not found');
    
    // Game must be in game_over state
    if (game.gameState !== 'game_over') {
      throw new Error('Game is not over yet');
    }
    
    // Remove player's vote if they voted
    if (game.restartVotes && game.restartVotes.includes(playerId)) {
      game.restartVotes = game.restartVotes.filter(id => id !== playerId);
      
      // Log the action
      const player = game.players.find(p => p.id === playerId);
      await this.addGameLog(gameId, `${player?.name || 'Unknown player'} canceled their vote to restart`);
      
      await this.repository.updateGame(game);
    }
  }

  // #region IGameLifecycleService Implementation
  
  async createGame(hostPlayer: string): Promise<Game> {
    // Create a new game with the host player
    if (!hostPlayer) {
      throw new Error('Host player name is required');
    }

    // Create initial game state with just the host
    const newGame: Game = {
      id: '', // Will be set by the repository
      players: [
        {
          id: '', // Will be set by the repository
          name: hostPlayer,
          coins: 0, // Will be set when game starts
          cards: [],
          eliminated: false
        }
      ],
      currentPlayerIndex: 0,
      deck: [],
      gameState: 'setup',
      logs: [this.createLog(`Game created by ${hostPlayer}`)],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    return await this.repository.createGame([hostPlayer]);
  }

  async joinGame(gameId: string, playerName: string): Promise<string> {
    const game = await this.repository.getGame(gameId);
    if (!game) throw new Error('Game not found');

    if (game.gameState !== 'setup') {
      throw new Error('Cannot join a game that has already started');
    }

    if (game.players.length >= GAME_CONSTANTS.MAX_PLAYERS) {
      throw new Error(`Game is full (maximum ${GAME_CONSTANTS.MAX_PLAYERS} players)`);
    }

    // Add new player to the game
    const playerId = await this.repository.addPlayer(gameId, playerName);
    
    // Log the action
    await this.addGameLog(gameId, `${playerName} joined the game`);
    
    return playerId;
  }

  async startGame(gameId: string): Promise<void> {
    const game = await this.repository.getGame(gameId);
    if (!game) throw new Error('Game not found');

    if (game.players.length < GAME_CONSTANTS.MIN_PLAYERS) {
      throw new Error(`At least ${GAME_CONSTANTS.MIN_PLAYERS} players required to start`);
    }

    if (game.players.length > GAME_CONSTANTS.MAX_PLAYERS) {
      throw new Error(`Maximum ${GAME_CONSTANTS.MAX_PLAYERS} players allowed`);
    }
    
    // Create a fresh deck
    const characters: CardCharacter[] = ['Duke', 'Assassin', 'Captain', 'Ambassador', 'Contessa'];
    let newDeck: Card[] = [];
    
    // Create cards of each character
    characters.forEach(character => {
      for (let i = 0; i < GAME_CONSTANTS.CHARACTERS_PER_TYPE; i++) {
        newDeck.push({ character, eliminated: false });
      }
    });
    
    // Shuffle the deck
    newDeck = this.shuffleDeck(newDeck);
    game.deck = newDeck;

    // Deal cards to each player
    for (const player of game.players) {
      // Check if we have enough cards
      if (game.deck.length < GAME_CONSTANTS.CARDS_PER_PLAYER) {
        throw new Error('Not enough cards in the deck');
      }
      
      // Get cards from the deck
      const cardsForPlayer = game.deck.slice(-GAME_CONSTANTS.CARDS_PER_PLAYER);
      game.deck = game.deck.slice(0, -GAME_CONSTANTS.CARDS_PER_PLAYER);
      
      player.cards = cardsForPlayer;
      player.coins = GAME_CONSTANTS.STARTING_COINS;
      player.eliminated = false;
    }

    // Update game state
    game.gameState = 'play';
    game.currentPlayerIndex = 0;
    game.logs = [this.createLog('Game started')];
    
    await this.repository.updateGame(game);
  }

  async leaveGame(gameId: string, playerId: PlayerID): Promise<void> {
    const game = await this.repository.getGame(gameId);
    if (!game) throw new Error('Game not found');
    
    const player = game.players.find(p => p.id === playerId);
    if (!player) throw new Error('Player not found');
    
    if (game.gameState === 'setup') {
      // During setup, just remove the player
      await this.repository.leaveGame(gameId, playerId);
      await this.addGameLog(gameId, `${player.name} left the game`);
    } else {
      // During gameplay, mark the player as eliminated
      player.eliminated = true;
      
      // Return player's cards to the deck
      const activeCards = player.cards.filter(card => !card.eliminated);
      for (const card of activeCards) {
        game.deck.push({...card, eliminated: false});
      }
      game.deck = this.shuffleDeck(game.deck);
      
      // Mark all cards as eliminated
      player.cards.forEach(card => card.eliminated = true);
      
      // Log the action
      await this.addGameLog(gameId, `${player.name} left the game and was eliminated`);
      
      // Check if game is over
      if (this.rules.isGameOver(game)) {
        const winner = this.rules.getWinner(game);
        if (winner) {
          game.gameState = 'game_over';
          await this.addGameLog(gameId, `${winner.name} has won the game!`);
        }
      } else {
        // If it was this player's turn, move to next player
        if (game.currentPlayerIndex < game.players.length && 
            game.players[game.currentPlayerIndex].id === playerId) {
          this.advanceToNextPlayer(game);
        }
      }
      
      await this.repository.updateGame(game);
    }
  }
  
  // #endregion
  
  // #region IGameStateService Implementation
  
  async getCurrentState(gameId: string): Promise<Game> {
    const game = await this.repository.getGame(gameId);
    if (!game) throw new Error('Game not found');
    return game;
  }

  subscribeToGame(gameId: string, callback: (game: Game) => void): () => void {
    return this.repository.subscribeToGame(gameId, callback);
  }
  
  // #endregion
  
  // #region IGameActionService Implementation
  
  async performAction(gameId: string, actionRequest: ActionRequest): Promise<void> {
    const game = await this.repository.getGame(gameId);
    if (!game) throw new Error('Game not found');

    // Validate the action
    if (!this.rules.canPerformAction(game, actionRequest)) {
      throw new Error('Invalid action');
    }

    const player = game.players.find(p => p.id === actionRequest.playerId);
    if (!player) throw new Error('Player not found');
    
    const actionProps = ACTION_PROPERTIES[actionRequest.type];
    
    // Create new game action
    const newAction: GameAction = {
      action: actionRequest,
      responses: [],
      isResolved: false
    };
    
    // Handle action based on type
    switch (actionRequest.type) {
      case 'income':
        // Income is not blockable or challengeable, resolve immediately
        player.coins += 1;
        await this.addGameLog(gameId, `${player.name} took income (+1 coin)`);
        this.advanceToNextPlayer(game);
        break;
        
      case 'coup':
        // Coup requires a target
        if (!actionRequest.target) {
          throw new Error('Target is required for coup');
        }
        
        const targetPlayer = game.players.find(p => p.id === actionRequest.target);
        if (!targetPlayer) {
          throw new Error('Target player not found');
        }
        
        // Pay the cost
        player.coins -= actionProps.cost;
        
        // Set game state for target to lose influence
        game.gameState = 'lose_influence';
        game.currentAction = newAction;
        game.pendingActionFrom = targetPlayer.id;
        
        await this.addGameLog(gameId, `${player.name} launched a coup against ${targetPlayer.name}`);
        break;
        
      default:
        // For all other actions, set up the action_response state
        game.gameState = 'action_response';
        game.currentAction = newAction;
        
        // Log the action
        if (actionRequest.target) {
          const targetPlayer = game.players.find(p => p.id === actionRequest.target);
          await this.addGameLog(
            gameId, 
            `${player.name} attempted to ${this.getActionDisplayName(actionRequest.type)} ${targetPlayer?.name || 'unknown'}`
          );
        } else {
          await this.addGameLog(
            gameId, 
            `${player.name} attempted to ${this.getActionDisplayName(actionRequest.type)}`
          );
        }
        break;
    }
    
    await this.repository.updateGame(game);
  }

  async respondToAction(
    gameId: string, 
    playerId: PlayerID, 
    responseType: ResponseType, 
    character?: CardCharacter
  ): Promise<void> {
    const game = await this.repository.getGame(gameId);
    if (!game) throw new Error('Game not found');
    
    if (!game.currentAction) {
      throw new Error('No action to respond to');
    }
    
    const player = game.players.find(p => p.id === playerId);
    if (!player) throw new Error('Player not found');
    
    // Handle different response types
    switch (responseType) {
      case 'pass':
        // Add pass response
        await this.handlePassResponse(game, player);
        break;
        
      case 'block':
        // Need character to block
        if (!character) {
          throw new Error('Character required for block');
        }
        
        // Validate the block
        if (!this.rules.canRespondWithBlock(game, playerId, character)) {
          throw new Error('Cannot block with this character');
        }
        
        // Add block response
        await this.handleBlockResponse(game, player, character);
        break;
        
      case 'challenge':
        // Validate the challenge
        if (!this.rules.canRespondWithChallenge(game, playerId)) {
          throw new Error('Cannot challenge this action');
        }
        
        // Add challenge response
        await this.handleChallengeResponse(game, player);
        break;
    }
    
    await this.repository.updateGame(game);
  }

  async revealCard(gameId: string, playerId: PlayerID, cardIndex: number): Promise<void> {
    const game = await this.repository.getGame(gameId);
    if (!game) throw new Error('Game not found');
    
    // Must be in reveal_challenge state
    if (game.gameState !== 'reveal_challenge' || !game.currentAction) {
      throw new Error('Not in a state where card revelation is needed');
    }
    
    // Must be the player's turn to reveal
    if (game.pendingActionFrom !== playerId) {
      throw new Error('Not your turn to reveal a card');
    }
    
    const player = game.players.find(p => p.id === playerId);
    if (!player) throw new Error('Player not found');
    
    if (cardIndex < 0 || cardIndex >= player.cards.length || player.cards[cardIndex].eliminated) {
      throw new Error('Invalid card index');
    }
    
    const revealedCard = player.cards[cardIndex];
    
    // Handle the challenge result
    if (game.currentAction.challenge) {
      const { challengerId, challengedId, isBlockChallenge } = game.currentAction.challenge;
      
      // Get the challenger
      const challenger = game.players.find(p => p.id === challengerId);
      if (!challenger) throw new Error('Challenger not found');
      
      // If it's a block challenge
      if (isBlockChallenge && game.currentAction.block) {
        const blockCharacter = game.currentAction.block.character;
        const actionType = game.currentAction.action.type;
        
        // If player has the claimed character
        if (revealedCard.character === blockCharacter) {
          // Block successful, challenger loses influence
          
          // Special log message for Foreign Aid
          if (actionType === 'foreign_aid' && blockCharacter === 'Duke') {
            await this.addGameLog(
              gameId, 
              `${player.name} revealed Duke to prove the block. The Foreign Aid is blocked.`
            );
          } else {
            await this.addGameLog(
              gameId, 
              `${player.name} revealed ${revealedCard.character} to prove the block. The action is blocked.`
            );
          }
          
          // Replace the card
          this.replacePlayerCard(game, player, cardIndex);
          
          // Challenger loses influence
          game.gameState = 'lose_influence';
          game.pendingActionFrom = challengerId;
          
          // Specific message for Foreign Aid Duke challenges
          if (actionType === 'foreign_aid' && blockCharacter === 'Duke') {
            await this.addGameLog(
              gameId, 
              `${challenger.name} must lose an influence for the failed challenge against ${player.name}'s Duke.`
            );
          } else {
            await this.addGameLog(
              gameId, 
              `${challenger.name} must lose an influence for the failed challenge.`
            );
          }
        } else {
          // Block failed, blocker loses influence and action resolves
          
          // Special handling for Foreign Aid
          if (actionType === 'foreign_aid' && blockCharacter === 'Duke') {
            await this.addGameLog(
              gameId, 
              `${player.name} revealed ${revealedCard.character} which is not Duke. The block fails.`
            );
          } else {
            await this.addGameLog(
              gameId, 
              `${player.name} revealed ${revealedCard.character} which is not ${blockCharacter}. The block fails.`
            );
          }
          
          // Blocker loses this card
          player.cards[cardIndex].eliminated = true;
          
          // Check if player is eliminated
          this.checkPlayerElimination(game, player);
          
          // For Foreign Aid, execute the original action with a specific message
          if (actionType === 'foreign_aid') {
            const actionPlayer = game.players.find(p => p.id === game.currentAction!.action.playerId);
            if (actionPlayer) {
              actionPlayer.coins += 2;
              await this.addGameLog(
                gameId, 
                `${actionPlayer.name} successfully took foreign aid (+2 coins).`
              );
            }
            this.advanceToNextPlayer(game);
          } else {
            // Execute the original action for other action types
            await this.resolveAction(game);
          }
        }
      } 
      // Regular action challenge
      else {
        const actionType = game.currentAction.action.type;
        const requiredCharacter = this.rules.getRequiredCharacter(actionType);
        
        // If player has the claimed character
        if (requiredCharacter && revealedCard.character === requiredCharacter) {
          // Challenge failed, challenger loses influence
          await this.addGameLog(
            gameId, 
            `${player.name} revealed ${revealedCard.character} to prove the claim. The action succeeds.`
          );
          
          // Replace the card
          this.replacePlayerCard(game, player, cardIndex);
          
          // Challenger loses influence
          game.gameState = 'lose_influence';
          game.pendingActionFrom = challengerId;
          
          await this.addGameLog(
            gameId, 
            `${challenger.name} must lose an influence for the failed challenge.`
          );
          
          // After challenger loses influence, the action will be executed
          game.currentAction.isResolved = false;
        } else {
          // Challenge successful, action player loses influence and action fails
          await this.addGameLog(
            gameId, 
            `${player.name} revealed ${revealedCard.character} which is not ${requiredCharacter}. The action fails.`
          );
          
          // Player loses this card
          player.cards[cardIndex].eliminated = true;
          
          // Check if player is eliminated
          this.checkPlayerElimination(game, player);
          
          // Action fails, move to next player
          this.advanceToNextPlayer(game);
        }
      }
    }
    
    await this.repository.updateGame(game);
  }

  async loseInfluence(gameId: string, playerId: PlayerID, cardIndex: number): Promise<void> {
    const game = await this.repository.getGame(gameId);
    if (!game) throw new Error('Game not found');
    
    // Must be in lose_influence state
    if (game.gameState !== 'lose_influence' || !game.pendingActionFrom) {
      throw new Error('Not in a state where influence loss is needed');
    }
    
    // Must be the player's turn to lose influence
    if (game.pendingActionFrom !== playerId) {
      throw new Error('Not your turn to lose influence');
    }
    
    const player = game.players.find(p => p.id === playerId);
    if (!player) throw new Error('Player not found');
    
    if (cardIndex < 0 || cardIndex >= player.cards.length || player.cards[cardIndex].eliminated) {
      throw new Error('Invalid card index');
    }
    
    const lostCard = player.cards[cardIndex];
    
    // Eliminate the card
    player.cards[cardIndex].eliminated = true;
    
    await this.addGameLog(
      gameId, 
      `${player.name} lost influence and revealed ${lostCard.character}.`
    );
    
    // Check if player is eliminated
    this.checkPlayerElimination(game, player);
    
    // Check if the game is over
    if (this.rules.isGameOver(game)) {
      const winner = this.rules.getWinner(game);
      if (winner) {
        game.gameState = 'game_over';
        await this.addGameLog(gameId, `${winner.name} has won the game!`);
      }
      await this.repository.updateGame(game);
      return;
    }
    
    // If this was from a challenge and the action isn't resolved yet
    if (game.currentAction && !game.currentAction.isResolved && game.currentAction.challenge) {
      // If this was a failed block challenge, resolve the action as blocked
      if (game.currentAction.challenge.isBlockChallenge && game.currentAction.block) {
        // The action was blocked successfully
        await this.addGameLog(
          gameId, 
          `The action was blocked successfully.`
        );
        this.advanceToNextPlayer(game);
      } 
      // If this was a failed action challenge, execute the action
      else {
        await this.resolveAction(game);
      }
    } 
    // If this was from a coup or other direct influence loss
    else {
      this.advanceToNextPlayer(game);
    }
    
    await this.repository.updateGame(game);
  }

  async selectExchangeCards(gameId: string, playerId: PlayerID, keptCardIndices: number[]): Promise<void> {
    const game = await this.repository.getGame(gameId);
    if (!game) throw new Error('Game not found');
    
    // Must be in exchange_selection state
    if (game.gameState !== 'exchange_selection' || !game.currentAction) {
      throw new Error('Not in a state where exchange selection is needed');
    }
    
    // Must be the player who initiated the exchange
    if (game.currentAction.action.playerId !== playerId) {
      throw new Error('Not your turn to select exchange cards');
    }
    
    const player = game.players.find(p => p.id === playerId);
    if (!player) throw new Error('Player not found');
    
    // Make sure we have exchange cards
    if (!game.currentAction.exchangeCards || game.currentAction.exchangeCards.length === 0) {
      throw new Error('No cards available for exchange');
    }
    
    // Get all active player cards
    const activeCards = player.cards.filter(card => !card.eliminated);
    
    // Combine with exchange cards
    const allCards = [...activeCards, ...game.currentAction.exchangeCards];
    
    // The player should keep as many cards as they had active before
    if (keptCardIndices.length !== activeCards.length) {
      throw new Error(`You must keep exactly ${activeCards.length} cards`);
    }
    
    // Validate indices
    if (keptCardIndices.some(idx => idx < 0 || idx >= allCards.length)) {
      throw new Error('Invalid card index');
    }
    
    // Get the cards the player wants to keep
    const keptCards = keptCardIndices.map(idx => allCards[idx]);
    
    // Get the cards to return to the deck
    const returnedCards = allCards.filter((_, idx) => !keptCardIndices.includes(idx));
    
    // Mark all current cards as eliminated
    player.cards.forEach(card => card.eliminated = true);
    
    // Replace the player's cards
    keptCards.forEach((card, idx) => {
      if (idx < player.cards.length) {
        player.cards[idx] = card;
      } else {
        player.cards.push(card);
      }
    });
    
    // Return the unused cards to the deck
    game.deck.push(...returnedCards);
    
    // Shuffle the deck
    game.deck = this.shuffleDeck(game.deck);
    
    await this.addGameLog(
      gameId, 
      `${player.name} exchanged cards with the deck.`
    );
    
    // Move to next player
    this.advanceToNextPlayer(game);
    
    await this.repository.updateGame(game);
  }
  
  // #endregion
  
  // #region IGameValidationService Implementation
  
  canPerformAction(game: Game, action: ActionRequest): boolean {
    return this.rules.canPerformAction(game, action);
  }

  canRespondWithBlock(game: Game, playerId: PlayerID, character: CardCharacter): boolean {
    return this.rules.canRespondWithBlock(game, playerId, character);
  }

  canRespondWithChallenge(game: Game, playerId: PlayerID): boolean {
    return this.rules.canRespondWithChallenge(game, playerId);
  }

  getValidActions(game: Game, playerId: PlayerID): ActionType[] {
    return this.rules.getValidActions(game, playerId);
  }

  getValidResponses(game: Game, playerId: PlayerID): ResponseType[] {
    return this.rules.getValidResponses(game, playerId);
  }
  
  // #endregion
  
  // #region Private Helper Methods
  
  private createLog(message: string): GameLog {
    return {
      message,
      timestamp: Date.now()
    };
  }
  
  private async addGameLog(gameId: string, message: string): Promise<void> {
    const game = await this.repository.getGame(gameId);
    if (!game) return;
    
    game.logs.push(this.createLog(message));
    game.updatedAt = new Date();
    
    await this.repository.updateGame(game);
  }
  
  private shuffleDeck(deck: Card[]): Card[] {
    return [...deck].sort(() => Math.random() - 0.5);
  }
  
  private advanceToNextPlayer(game: Game): void {
    // Clear current action state
    game.currentAction = undefined;
    game.pendingActionFrom = undefined;
    game.gameState = 'play';
    
    // Move to next player
    do {
      game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.players.length;
    } while (game.players[game.currentPlayerIndex].eliminated);
  }
  
  private checkPlayerElimination(game: Game, player: Player): void {
    if (player.cards.every(card => card.eliminated)) {
      player.eliminated = true;
      game.logs.push(this.createLog(`${player.name} has been eliminated from the game!`));
      
      // Check if only one player remains (game over)
      const remainingPlayers = game.players.filter(p => !p.eliminated);
      if (remainingPlayers.length === 1) {
        const winner = remainingPlayers[0];
        game.gameState = 'game_over';
        game.logs.push(this.createLog(`${winner.name} is the last player standing and wins the game!`));
      }
    }
  }
  
  private replacePlayerCard(game: Game, player: Player, cardIndex: number): void {
    if (game.deck.length === 0) {
      return; // No cards left to replace with
    }
    
    // Get a new card from the deck
    const newCard = game.deck.pop()!;
    
    // Return the old card to the deck
    const oldCard = player.cards[cardIndex];
    game.deck.push({...oldCard, eliminated: false});
    
    // Replace the player's card
    player.cards[cardIndex] = newCard;
    
    // Shuffle the deck
    game.deck = this.shuffleDeck(game.deck);
    
    game.logs.push(this.createLog(`${player.name} drew a new card from the deck.`));
  }
  
  private async handlePassResponse(game: Game, player: Player): Promise<void> {
    // Add the pass response
    game.currentAction!.responses.push({
      type: 'pass',
      playerId: player.id
    });
    
    await this.addGameLog(game.id, `${player.name} passed.`);
    
    // For Foreign Aid specifically, handling block response state requires special care
    if (game.gameState === 'block_response' && game.currentAction?.block) {
      // This is a block response to an action (either Foreign Aid or something else)
      const actionPlayerId = game.currentAction.action.playerId;
      const blockerId = game.currentAction.block.blockerId;
      const actionType = game.currentAction.action.type;
      
      // Case 1: If initiator passes (accepts the block)
      if (player.id === actionPlayerId) {
        await this.addGameLog(game.id, `${player.name} accepted the block.`);
        
        // For Foreign Aid, according to the rules in scenario 2 from ForeignAid.txt:
        // When initiator accepts the block, it resolves immediately (even if others haven't responded)
        if (actionType === 'foreign_aid') {
          await this.addGameLog(game.id, `The block succeeded and the Foreign Aid action failed.`);
          this.advanceToNextPlayer(game);
          await this.repository.updateGame(game);
          return;
        } else {
          // For other action types, check if all other players have already responded
          const otherPlayers = game.players.filter(p => 
            !p.eliminated && 
            p.id !== actionPlayerId && 
            p.id !== blockerId
          );
          
          const allOtherPlayersResponded = otherPlayers.every(p => 
            game.currentAction!.responses.some(r => r.playerId === p.id)
          );
          
          if (allOtherPlayersResponded || otherPlayers.length === 0) {
            // All players have responded and no one challenged, so resolve
            await this.addGameLog(game.id, `The block succeeded and the action failed.`);
            this.advanceToNextPlayer(game);
            await this.repository.updateGame(game);
            return;
          }
        }
      } else {
        // Case 2: A non-initiator passed (allowed the block)
        // Check if all players who need to respond have responded
        this.checkAllPlayersResponded(game);
      }
      
      // If we reach here, we're still waiting for responses
      await this.repository.updateGame(game);
      return;
    } else if (game.gameState === 'action_response' && game.currentAction?.action.type === 'foreign_aid') {
      // Special handling for Foreign Aid in action_response state
      // Check if all players have responded with pass (allow action)
      this.checkAllPlayersResponded(game);
      await this.repository.updateGame(game);
      return;
    }
    
    // For other game states, just check if all players have responded
    this.checkAllPlayersResponded(game);
  }
  
  private async handleBlockResponse(game: Game, player: Player, character: CardCharacter): Promise<void> {
    // Add the block response
    game.currentAction!.responses.push({
      type: 'block',
      playerId: player.id,
      character: character
    });
    
    // Set block information
    game.currentAction!.block = {
      blockerId: player.id,
      character: character
    };
    
    // Update game state
    game.gameState = 'block_response';
    
    // Clear previous responses when a block occurs
    // This is crucial! We want to allow all players to respond to the block,
    // even if they had already responded to the original action
    game.currentAction!.responses = game.currentAction!.responses.filter(r => 
      r.type === 'block' || r.playerId === player.id
    );
    
    // Special handling for Foreign Aid blocks with Duke
    if (game.currentAction!.action.type === 'foreign_aid' && character === 'Duke') {
      await this.addGameLog(
        game.id, 
        `${player.name} blocked Foreign Aid with Duke.`
      );
    } else {
      await this.addGameLog(
        game.id, 
        `${player.name} blocked with ${character}.`
      );
    }
  }
  
  private async handleChallengeResponse(game: Game, player: Player): Promise<void> {
    // Add the challenge response
    game.currentAction!.responses.push({
      type: 'challenge',
      playerId: player.id
    });
    
    // Determine who is being challenged
    let challengedId: PlayerID;
    let isBlockChallenge = false;
    
    if (game.gameState === 'block_response' && game.currentAction!.block) {
      // Challenging a block
      challengedId = game.currentAction!.block.blockerId;
      isBlockChallenge = true;
      
      // Special handling for Foreign Aid block challenges
      if (game.currentAction!.action.type === 'foreign_aid') {
        const blockCharacter = game.currentAction!.block.character;
        await this.addGameLog(
          game.id, 
          `${player.name} challenged ${game.players.find(p => p.id === challengedId)?.name || 'unknown'}'s claim to have a ${blockCharacter}.`
        );
      }
    } else {
      // Challenging the action
      challengedId = game.currentAction!.action.playerId;
    }
    
    // Set challenge information
    game.currentAction!.challenge = {
      challengerId: player.id,
      challengedId: challengedId,
      isBlockChallenge: isBlockChallenge
    };
    
    // Update game state
    game.gameState = 'reveal_challenge';
    game.pendingActionFrom = challengedId;
    
    const challenged = game.players.find(p => p.id === challengedId);
    
    // Only add this log if we didn't add a more specific one above
    if (!(isBlockChallenge && game.currentAction!.action.type === 'foreign_aid')) {
      await this.addGameLog(
        game.id, 
        `${player.name} challenged ${challenged?.name || 'unknown'}.`
      );
    }
  }
  
  private checkAllPlayersResponded(game: Game): void {
    if (!game.currentAction) return;
    
    // If we're in block_response state, handle it specially
    if (game.gameState === 'block_response' && game.currentAction.block) {
      const actionPlayerId = game.currentAction.action.playerId;
      const blockerId = game.currentAction.block.blockerId;
      const actionType = game.currentAction.action.type;
      
      // Check if anyone has challenged the block
      const anyPlayerChallenged = game.currentAction.responses.some(r => r.type === 'challenge');
      
      // If any player challenged, the challenge is being handled elsewhere
      if (anyPlayerChallenged) {
        return;
      }
      
      // For Foreign Aid, the initiator accepting the block immediately resolves it
      // This is already handled in handlePassResponse
      if (actionType === 'foreign_aid') {
        // Check if the initiator has passed/accepted the block
        const initiatorPassed = game.currentAction.responses.some(
          r => r.playerId === actionPlayerId && r.type === 'pass'
        );
        
        if (initiatorPassed) {
          // No need to check others - when initiator accepts block for Foreign Aid, it resolves immediately
          return;
        }
        
        // If initiator hasn't responded yet, check if all OTHER players have responded
        const otherPlayers = game.players.filter(p => 
          !p.eliminated && 
          p.id !== actionPlayerId && 
          p.id !== blockerId
        );
        
        const allOtherPlayersResponded = otherPlayers.every(p => 
          game.currentAction!.responses.some(r => r.playerId === p.id)
        );
        
        // If all other players responded but initiator hasn't, we're still waiting
        if (allOtherPlayersResponded) {
          // We're just waiting for the initiator now - do nothing
          return;
        }
      }
      else {
        // For other action types:
        // Get all active players except the blocker
        const playersToRespond = game.players.filter(p => 
          !p.eliminated && p.id !== blockerId
        );
        
        // Check if all active players (except blocker) have responded
        const allPlayersResponded = playersToRespond.every(p => 
          game.currentAction!.responses.some(r => r.playerId === p.id)
        );
        
        // Check if the initiator specifically passed
        const actionPlayerPassed = game.currentAction.responses.some(r => 
          r.playerId === actionPlayerId && r.type === 'pass'
        );
        
        // ONLY resolve if:
        // 1. ALL players have responded AND
        // 2. The initiator has passed
        if (allPlayersResponded && actionPlayerPassed) {
          // Block succeeded
          this.addGameLog(game.id, `Block was successful - the action fails.`);
          this.advanceToNextPlayer(game);
          return;
        }
      }
    }
    // For Foreign Aid in action_response state - handle standard allowing of action
    else if (game.gameState === 'action_response' && game.currentAction.action.type === 'foreign_aid') {
      // Get all active (non-eliminated) players except the action player
      const activePlayers = game.players.filter(p => 
        !p.eliminated && p.id !== game.currentAction!.action.playerId
      );
      
      // Check if all active players have responded and none blocked
      const allResponded = activePlayers.every(p => 
        game.currentAction!.responses.some(r => r.playerId === p.id)
      );
      
      // Check if any player has blocked
      const anyPlayerBlocked = game.currentAction.responses.some(r => r.type === 'block');
      
      // If everyone responded and no one blocked, resolve the action
      if (allResponded && !anyPlayerBlocked) {
        // All players have passed, action succeeds
        this.resolveAction(game);
        return;
      }
    }
    else {
      // Standard handling for other actions:
      // Get all active (non-eliminated) players except the action player
      const activePlayers = game.players.filter(p => 
        !p.eliminated && p.id !== game.currentAction!.action.playerId
      );
      
      // Check if all active players have responded
      const allResponded = activePlayers.every(p => 
        game.currentAction!.responses.some(r => r.playerId === p.id)
      );
      
      // For targeted actions, we need the target to respond first before resolving
      if (game.currentAction.action.target) {
        const targetPlayer = game.players.find(p => p.id === game.currentAction.action.target);
        const targetResponded = game.currentAction.responses.some(r => r.playerId === game.currentAction.action.target);
        
        // If the target has responded with a "pass", resolve the action
        const targetPassed = game.currentAction.responses.some(r => 
          r.playerId === game.currentAction.action.target && r.type === 'pass'
        );
        
        if (targetResponded && targetPassed) {
          // Target has passed, so resolve the action
          this.resolveAction(game);
          return;
        }
      }
      
      // If all players have responded, resolve the action
      if (allResponded) {
        // All players have passed, action succeeds
        this.resolveAction(game);
      }
    }
  }
  
  private async resolveAction(game: Game): Promise<void> {
    if (!game.currentAction) return;
    
    const action = game.currentAction.action;
    const player = game.players.find(p => p.id === action.playerId);
    
    if (!player) return;
    
    // Mark the action as resolved
    game.currentAction.isResolved = true;
    
    // Execute the action based on type
    switch (action.type) {
      case 'foreign_aid':
        // Implement Foreign Aid according to the rules in ForeignAid.txt
        // First, make sure it wasn't successfully blocked
        const wasBlocked = game.currentAction.block && 
          game.currentAction.responses.some(r => 
            r.playerId === player.id && r.type === 'pass'
          );
        
        if (wasBlocked) {
          // Action was blocked and accepted by the player
          await this.addGameLog(
            game.id,
            `${player.name}'s foreign aid was blocked. No coins gained.`
          );
        } else {
          // Action succeeds - gain 2 coins
          player.coins += 2;
          await this.addGameLog(
            game.id, 
            `${player.name} successfully took foreign aid (+2 coins).`
          );
        }
        this.advanceToNextPlayer(game);
        break;
        
      case 'tax':
        player.coins += 3;
        await this.addGameLog(
          game.id, 
          `${player.name} successfully collected tax (+3 coins).`
        );
        this.advanceToNextPlayer(game);
        break;
        
      case 'steal':
        if (!action.target) {
          throw new Error('Target is required for steal');
        }
        
        const stealTarget = game.players.find(p => p.id === action.target);
        if (!stealTarget) {
          throw new Error('Target player not found');
        }
        
        // Calculate coins to steal (up to 2)
        const stolenCoins = Math.min(stealTarget.coins, 2);
        
        stealTarget.coins -= stolenCoins;
        player.coins += stolenCoins;
        
        await this.addGameLog(
          game.id, 
          `${player.name} successfully stole ${stolenCoins} coins from ${stealTarget.name}.`
        );
        this.advanceToNextPlayer(game);
        break;
        
      case 'assassinate':
        if (!action.target) {
          throw new Error('Target is required for assassinate');
        }
        
        const assassinateTarget = game.players.find(p => p.id === action.target);
        if (!assassinateTarget) {
          throw new Error('Target player not found');
        }
        
        // Set up for target to lose influence
        game.gameState = 'lose_influence';
        game.pendingActionFrom = assassinateTarget.id;
        
        await this.addGameLog(
          game.id, 
          `${player.name} successfully assassinated ${assassinateTarget.name}. ${assassinateTarget.name} must lose an influence.`
        );
        break;
        
      case 'exchange':
        // Draw two cards for exchange
        if (game.deck.length < 2) {
          await this.addGameLog(
            game.id, 
            `Not enough cards in the deck for exchange. Action fails.`
          );
          this.advanceToNextPlayer(game);
          break;
        }
        
        // Get two cards from the deck
        const drawnCards = game.deck.slice(-2);
        game.deck = game.deck.slice(0, -2);
        
        // Store in the current action
        game.currentAction.exchangeCards = drawnCards;
        
        // Update game state
        game.gameState = 'exchange_selection';
        
        await this.addGameLog(
          game.id, 
          `${player.name} successfully exchanged with the court deck.`
        );
        break;
        
      default:
        // For other actions or if something went wrong, just advance
        this.advanceToNextPlayer(game);
        break;
    }
    
    await this.repository.updateGame(game);
  }
  
  private getActionDisplayName(actionType: ActionType): string {
    switch (actionType) {
      case 'income': return 'take income';
      case 'foreign_aid': return 'take foreign aid';
      case 'tax': return 'collect tax';
      case 'coup': return 'launch a coup against';
      case 'steal': return 'steal from';
      case 'assassinate': return 'assassinate';
      case 'exchange': return 'exchange cards';
      default: return actionType;
    }
  }
  
  // #endregion
}