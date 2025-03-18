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
        
        // If this player was waiting for an action in any game state,
        // also automatically advance the game state
        if (game.pendingActionFrom === playerId) {
          await this.addGameLog(gameId, `${player.name} left during their action. Game state automatically advanced.`);
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
    
    // Auto-fix: Check if game is in a stuck state with an eliminated player
    // This provides a clean server-side fix for the UI issue
    if (game.gameState === 'lose_influence' && 
        game.pendingActionFrom && 
        game.players.find(p => p.id === game.pendingActionFrom)?.eliminated) {
      
      console.log(`Auto-fixing game state: ${game.id} - Eliminated player in pendingActionFrom`);
      
      // Log the action
      game.logs.push(this.createLog(`Game state automatically advanced from stuck state with eliminated player.`));
      
      // Clear the stuck state and advance to the next player
      this.advanceToNextPlayer(game);
      
      // Save the fixed state
      await this.repository.updateGame(game);
      
      // Return the fixed game state
      return game;
    }
    
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
        
        // Pay costs for actions that require coins
        if (actionRequest.type === 'assassinate') {
          // Deduct 3 coins for Assassinate
          player.coins -= actionProps.cost;
          
          const targetPlayer = game.players.find(p => p.id === actionRequest.target);
          await this.addGameLog(
            gameId, 
            `${player.name} paid ${actionProps.cost} coins and attempted to assassinate ${targetPlayer?.name || 'unknown'}`
          );
        } 
        // Log other actions
        else if (actionRequest.target) {
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
          
          // Special log message for different action types
          if (actionType === 'foreign_aid' && blockCharacter === 'Duke') {
            await this.addGameLog(
              gameId, 
              `${player.name} revealed Duke to prove the block. The Foreign Aid is blocked.`
            );
          } else if (actionType === 'assassinate' && blockCharacter === 'Contessa') {
            // Scenario 3A - Contessa block is successful
            await this.addGameLog(
              gameId, 
              `${player.name} revealed Contessa to prove the block. The assassination is blocked.`
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
          
          // Specific message for different action types
          if (actionType === 'foreign_aid' && blockCharacter === 'Duke') {
            await this.addGameLog(
              gameId, 
              `${challenger.name} must lose an influence for the failed challenge against ${player.name}'s Duke.`
            );
          } else if (actionType === 'assassinate' && blockCharacter === 'Contessa') {
            // Scenario 3A - Challenger must lose influence
            await this.addGameLog(
              gameId, 
              `${challenger.name} must lose an influence for the failed challenge against ${player.name}'s Contessa.`
            );
          } else {
            await this.addGameLog(
              gameId, 
              `${challenger.name} must lose an influence for the failed challenge.`
            );
          }
        } else {
          // Block failed, blocker loses influence and action resolves
          
          // Special handling for different action types
          if (actionType === 'foreign_aid' && blockCharacter === 'Duke') {
            await this.addGameLog(
              gameId, 
              `${player.name} revealed ${revealedCard.character} which is not Duke. The block fails.`
            );
          } else if (actionType === 'assassinate' && blockCharacter === 'Contessa') {
            // Scenario 3B - Contessa block fails, target loses both cards immediately
            await this.addGameLog(
              gameId, 
              `${player.name} revealed ${revealedCard.character} which is not Contessa. The block fails and the assassination succeeds.`
            );
            
            // Special handling for failed Contessa block
            // Player immediately loses both influences (one for failed block, one for assassination)
            player.cards.forEach(card => card.eliminated = true);
            
            // Mark player as eliminated directly without using checkPlayerElimination
            player.eliminated = true;
            
            // Set pendingActionFrom to null to avoid UI confusion
            game.pendingActionFrom = undefined;
            
            // Add clear log message
            game.logs.push(this.createLog(`${player.name} has been eliminated from the game!`));
            
            // Check if the game is over
            if (this.rules.isGameOver(game)) {
              const winner = this.rules.getWinner(game);
              if (winner) {
                game.gameState = 'game_over';
                game.logs.push(this.createLog(`${winner.name} has won the game!`));
                await this.repository.updateGame(game);
                return;
              }
            }
            
            // Clear the current action and set appropriate game state
            game.currentAction = undefined;
            game.pendingActionFrom = undefined;
            game.gameState = 'play';
            
            // Log the advancement to the next player
            game.logs.push(this.createLog(`Game advancing to the next player after ${player.name}'s elimination.`));
            
            // Explicitly find the next player index to avoid any state issues
            let nextPlayerIndex = game.currentPlayerIndex;
            do {
              nextPlayerIndex = (nextPlayerIndex + 1) % game.players.length;
            } while (game.players[nextPlayerIndex].eliminated);
            
            // Set the current player index to the next player
            game.currentPlayerIndex = nextPlayerIndex;
            
            await this.repository.updateGame(game);
            return;
          } else {
            await this.addGameLog(
              gameId, 
              `${player.name} revealed ${revealedCard.character} which is not ${blockCharacter}. The block fails.`
            );
          }
          
          // Special handling for action types other than Assassinate (already handled above)
          if (actionType !== 'assassinate') {
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
      } 
      // Regular action challenge
      else {
        const actionType = game.currentAction.action.type;
        const requiredCharacter = this.rules.getRequiredCharacter(actionType);
        
        // If player has the claimed character
        if (requiredCharacter && revealedCard.character === requiredCharacter) {
          // Challenge failed, challenger loses influence
          
          // Special handling for different action types
          if (actionType === 'exchange') {
            await this.addGameLog(
              gameId, 
              `${player.name} revealed Ambassador to prove the claim. The Exchange action continues.`
            );
          } else if (actionType === 'assassinate') {
            // Scenario 2A and 4A
            await this.addGameLog(
              gameId, 
              `${player.name} revealed Assassin to prove the claim. The assassination will proceed.`
            );
          } else {
            await this.addGameLog(
              gameId, 
              `${player.name} revealed ${revealedCard.character} to prove the claim. The action succeeds.`
            );
          }
          
          // Replace the card
          this.replacePlayerCard(game, player, cardIndex);
          
          // Special handling for Assassinate when target challenged the Assassin
          // Scenario 2A - target challenged, will automatically lose both influences
          const target = game.currentAction.action.target;
          if (actionType === 'assassinate' && challengerId === target) {
            // Mark the challenge as special case for Assassinate where target loses both influences
            game.currentAction.challenge.specialAssassinCase = true;
          }
          
          // Challenger loses influence
          game.gameState = 'lose_influence';
          game.pendingActionFrom = challengerId;
          
          // Special messages for different action types
          if (actionType === 'exchange') {
            await this.addGameLog(
              gameId, 
              `${challenger.name} must lose an influence for the failed challenge against ${player.name}'s Ambassador.`
            );
          } else if (actionType === 'assassinate') {
            // Scenario 2A 
            await this.addGameLog(
              gameId, 
              `${challenger.name} must lose an influence for the failed challenge against ${player.name}'s Assassin.`
            );
            
            // If the challenger is the target, warn about automatic elimination
            if (challengerId === target) {
              await this.addGameLog(
                gameId, 
                `Since ${challenger.name} is the target of the assassination, they will lose all influence.`
              );
            }
          } else {
            await this.addGameLog(
              gameId, 
              `${challenger.name} must lose an influence for the failed challenge.`
            );
          }
          
          // After challenger loses influence, the action will be executed
          game.currentAction.isResolved = false;
        } else {
          // Challenge successful, action player loses influence and action fails
          
          // Special handling for different action types
          if (actionType === 'exchange') {
            await this.addGameLog(
              gameId, 
              `${player.name} revealed ${revealedCard.character} which is not Ambassador. The Exchange action fails.`
            );
          } else if (actionType === 'assassinate') {
            // Scenario 2B and 4E
            await this.addGameLog(
              gameId, 
              `${player.name} revealed ${revealedCard.character} which is not Assassin. The assassination fails.`
            );
            
            // If player paid 3 coins for the Assassinate, they should lose those coins
            // (In the original action, they paid 3 coins to use Assassinate)
            // No need to refund, as coins were already deducted in performAction
          } else {
            await this.addGameLog(
              gameId, 
              `${player.name} revealed ${revealedCard.character} which is not ${requiredCharacter}. The action fails.`
            );
          }
          
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
  
  // Helper method to check if a player has the claimed character
  // This can be used before the player needs to reveal a card
  private playerHasRequiredCharacter(game: Game, playerId: PlayerID, requiredCharacter: CardCharacter): boolean {
    const player = game.players.find(p => p.id === playerId);
    if (!player) return false;
    
    return player.cards.some(card => !card.eliminated && card.character === requiredCharacter);
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
    
    // Special Assassinate Scenario 2A handling
    // If this player challenged an Assassin, lost the challenge, and was the target
    if (game.currentAction?.challenge?.specialAssassinCase && 
        game.currentAction.challenge.challengerId === playerId &&
        game.currentAction.action.type === 'assassinate' &&
        game.currentAction.action.target === playerId) {
      
      // Mark all cards as eliminated (both influences lost at once)
      player.cards.forEach(card => card.eliminated = true);
      
      await this.addGameLog(
        gameId, 
        `${player.name} lost all influence (one for the failed challenge and one for the assassination).`
      );
      
      // Mark player as eliminated directly without calling checkPlayerElimination
      // This avoids calling advanceToNextPlayer twice
      player.eliminated = true;
      game.logs.push(this.createLog(`${player.name} has been eliminated from the game!`));
      
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
      
      // Move to next player's turn
      this.advanceToNextPlayer(game);
      await this.repository.updateGame(game);
      return;
    }
    
    // Standard influence loss handling (non-special case)
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
    
    // Check if the player is now eliminated, but don't use checkPlayerElimination yet
    // This avoids potential double advancement issues
    const isPlayerEliminated = player.cards.every(card => card.eliminated);
    if (isPlayerEliminated) {
      player.eliminated = true;
      game.logs.push(this.createLog(`${player.name} has been eliminated from the game!`));
      
      // Clear pendingActionFrom immediately - this is critical to avoid UI confusion
      // with multiple elimination messages
      game.pendingActionFrom = undefined;
      
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
      
      // When a player is eliminated, we know it's their turn to be over
      // Advance to next player immediately and return - this prevents
      // further state transition issues
      this.advanceToNextPlayer(game);
      await this.repository.updateGame(game);
      return;
    }
    
    // If we're still here, the player lost a card but wasn't eliminated
    // Check if the game is over (just in case)
    if (this.rules.isGameOver(game)) {
      const winner = this.rules.getWinner(game);
      if (winner) {
        game.gameState = 'game_over';
        await this.addGameLog(gameId, `${winner.name} has won the game!`);
      }
      await this.repository.updateGame(game);
      return;
    }
    
    // Handle special cases after a player loses influence
    if (game.currentAction && game.currentAction.challenge) {
      const { challengerId, challengedId, isBlockChallenge, isResolved } = game.currentAction.challenge;
      
      // If this player was the one challenged (and already lost influence as a result of having lied)
      if (playerId === challengedId && isResolved) {
        // This was an automatic influence loss from the handleChallengeResponse method
        // which means the block failed or the action failed
        
        if (isBlockChallenge && game.currentAction.block) {
          // If it was a Foreign Aid block challenge specifically and the blocker lost
          if (game.currentAction.action.type === 'foreign_aid' && !game.currentAction.isResolved) {
            // Complete the Foreign Aid action after the player loses influence
            const actionPlayer = game.players.find(p => p.id === game.currentAction.action.playerId);
            if (actionPlayer) {
              actionPlayer.coins += 2;
              await this.addGameLog(
                gameId, 
                `With the block failed, ${actionPlayer.name} takes foreign aid (+2 coins).`
              );
            }
            this.advanceToNextPlayer(game);
          } 
          // Special handling for Assassinate block challenge (Scenario 3B)
          else if (game.currentAction.action.type === 'assassinate' && 
                   game.currentAction.block?.character === 'Contessa') {
            // Assassinate proceeds after the Contessa block fails
            await this.addGameLog(
              gameId, 
              `With the Contessa block failed, the assassination now proceeds.`
            );
            await this.resolveAction(game);
          }
          else {
            // For other block challenges
            await this.addGameLog(
              gameId, 
              `The block failed and the original action continues.`
            );
            await this.resolveAction(game);
          }
        } else {
          // For regular action challenges
          await this.addGameLog(
            gameId, 
            `The action failed due to the successful challenge.`
          );
          this.advanceToNextPlayer(game);
        }
      }
      // If this player was the challenger and lost influence (because their challenge failed)
      else if (playerId === challengerId) {
        if (isBlockChallenge && game.currentAction.block) {
          // Block succeeded, action fails
          await this.addGameLog(
            gameId, 
            `The block succeeded and the action failed.`
          );
          this.advanceToNextPlayer(game);
        } else {
          // Special handling for different action types
          if (game.currentAction.action.type === 'exchange') {
            await this.addGameLog(
              gameId, 
              `${game.players.find(p => p.id === game.currentAction?.action.playerId)?.name} continues with the Exchange action.`
            );
            await this.resolveAction(game);
          } 
          // Special handling for Assassinate (Scenario 4A, 4B, 4C, 4D)
          else if (game.currentAction.action.type === 'assassinate') {
            // Challenger lost influence, now the target can choose to block
            const actionPlayer = game.players.find(p => p.id === game.currentAction.action.playerId);
            const target = game.players.find(p => p.id === game.currentAction.action.target);
            
            if (playerId !== game.currentAction.action.target) {
              // If a third party was the challenger, continue with the assassination
              // Now target can choose to block with Contessa or allow (Scenario 4A)
              await this.addGameLog(
                gameId, 
                `${actionPlayer?.name}'s Assassin claim was proven. ${target?.name} may now block with Contessa or allow the assassination.`
              );
              
              // Reset game state to action_response to allow target to block
              game.gameState = 'action_response';
              // Clear previous responses
              game.currentAction.responses = [];
              // Set isResolved to false, we are continuing the action
              game.currentAction.isResolved = false;
              // Clear the challenge record since challenge is resolved
              game.currentAction.challenge = undefined;
            } else {
              // Action succeeds after failed challenge
              await this.resolveAction(game);
            }
          } else {
            // Action succeeds after failed challenge for other action types
            await this.resolveAction(game);
          }
        }
      }
      // For other influence losses (e.g., Coup, Assassinate)
      else {
        this.advanceToNextPlayer(game);
      }
    }
    // If there was no challenge or all challenges are resolved
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
    
    // Combine with exchange cards (from the deck)
    const allCards = [...activeCards, ...game.currentAction.exchangeCards];
    
    // The player should keep exactly as many cards as they had active before
    // (Note: If a player has 1 active card, they should select 1 card from the combined pool of 3 cards)
    const numActiveCards = activeCards.length;
    if (keptCardIndices.length !== numActiveCards) {
      throw new Error(`You must keep exactly ${numActiveCards} card${numActiveCards !== 1 ? 's' : ''}.`);
    }
    
    // Log the active card count - will help with debugging
    console.log(`Exchange validation: Player ${player.name} has ${numActiveCards} active cards, selected ${keptCardIndices.length} cards to keep`);
    
    
    // Validate indices
    if (keptCardIndices.some(idx => idx < 0 || idx >= allCards.length)) {
      throw new Error('Invalid card index');
    }
    
    // Get the cards the player wants to keep
    const keptCards = keptCardIndices.map(idx => allCards[idx]);
    
    // Get the cards to return to the deck
    const returnedCards = allCards.filter((_, idx) => !keptCardIndices.includes(idx));
    
    // Log the original card characters (only visible to server)
    const originalCards = player.cards.filter(card => !card.eliminated).map(card => card.character);
    const drawnCards = game.currentAction.exchangeCards.map(card => card.character);
    const keptCardChars = keptCards.map(card => card.character);
    console.log(`Exchange by ${player.name}:`, {
      originalCards,
      drawnCards,
      keptCardChars,
      returnedCards: returnedCards.map(card => card.character)
    });
    
    // FIX: Better card management to ensure proper updating of player's hand
    
    // Step 1: Back up current active cards indices to know which cards to replace
    const activeCardIndices = player.cards
      .map((card, index) => ({ card, index }))
      .filter(item => !item.card.eliminated)
      .map(item => item.index);
    
    // Step 2: Mark any extra slots as eliminated to make room if needed
    // This ensures we properly handle cases where a player has fewer than max cards
    for (let i = 0; i < player.cards.length; i++) {
      if (!activeCardIndices.includes(i)) {
        player.cards[i].eliminated = true;
      }
    }
    
    // Step 3: Replace active cards with the kept cards
    for (let i = 0; i < keptCards.length; i++) {
      // If we have an existing card slot to reuse
      if (i < activeCardIndices.length) {
        player.cards[activeCardIndices[i]] = keptCards[i];
      } 
      // Otherwise add a new card
      else {
        player.cards.push(keptCards[i]);
      }
    }
    
    // Return the unused cards to the deck
    game.deck.push(...returnedCards);
    
    // Shuffle the deck after returning cards
    game.deck = this.shuffleDeck(game.deck);
    
    await this.addGameLog(
      gameId, 
      `${player.name} completed exchanging cards with the court deck.`
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
    // Store original player index before advancement
    const originalPlayerIndex = game.currentPlayerIndex;
    
    // Clear current action state
    game.currentAction = undefined;
    game.pendingActionFrom = undefined;
    game.gameState = 'play';
    
    // Move to next player - starting from the player AFTER the current player
    // This ensures the current player doesn't go twice, even after eliminating someone
    do {
      game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.players.length;
    } while (game.players[game.currentPlayerIndex].eliminated);
    
    // If we ended up with the same player (possible in a 2-player game where one player is eliminated),
    // log a message for clarity
    if (game.currentPlayerIndex === originalPlayerIndex) {
      game.logs.push(this.createLog(`${game.players[game.currentPlayerIndex].name} has another turn (only active player).`));
    }
  }
  
  private checkPlayerElimination(game: Game, player: Player): void {
    if (player.cards.every(card => card.eliminated)) {
      // First, check if player is already marked as eliminated to avoid duplicate actions
      if (player.eliminated) {
        // Player is already eliminated - just make sure pendingActionFrom is cleared
        if (game.pendingActionFrom === player.id) {
          game.pendingActionFrom = undefined;
        }
        return;
      }
      
      // Mark the player as eliminated
      player.eliminated = true;
      game.logs.push(this.createLog(`${player.name} has been eliminated from the game!`));
      
      // Check if only one player remains (game over)
      const remainingPlayers = game.players.filter(p => !p.eliminated);
      if (remainingPlayers.length === 1) {
        const winner = remainingPlayers[0];
        game.gameState = 'game_over';
        game.logs.push(this.createLog(`${winner.name} is the last player standing and wins the game!`));
        return;
      }
      
      // Immediate cleanup - always clear pendingActionFrom if this player was pending
      if (game.pendingActionFrom === player.id) {
        // Clear pendingActionFrom immediately to avoid UI confusion
        game.pendingActionFrom = undefined;
        
        // Player is eliminated but was supposed to do something
        if (['lose_influence', 'reveal_challenge', 'action_response', 'block_response', 'exchange_selection'].includes(game.gameState)) {
          // Log the automatic advancement
          game.logs.push(this.createLog(`${player.name} is eliminated and cannot act. Game state automatically advanced.`));
          
          // Automatically advance to the next player if the player who needs to act is eliminated
          this.advanceToNextPlayer(game);
        }
      } 
      // If this player is the current player, advance to next
      // But ONLY if the game is in 'play' state to avoid double advancement in other states
      else if (game.players[game.currentPlayerIndex]?.id === player.id && game.gameState === 'play') {
        // Log the automatic advancement
        game.logs.push(this.createLog(`Current player ${player.name} is eliminated. Moving to next player.`));
        this.advanceToNextPlayer(game);
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
    
    // Special handling for action-specific blocks
    if (game.currentAction!.action.type === 'foreign_aid' && character === 'Duke') {
      await this.addGameLog(
        game.id, 
        `${player.name} blocked Foreign Aid with Duke.`
      );
    } else if (game.currentAction!.action.type === 'steal' && character === 'Captain') {
      // Special message for blocking Steal with Captain (Scenario 3A in Captain.txt)
      const actionPlayer = game.players.find(p => p.id === game.currentAction!.action.playerId);
      await this.addGameLog(
        game.id, 
        `${player.name} blocked ${actionPlayer?.name || 'unknown'}'s steal with Captain.`
      );
    } else if (game.currentAction!.action.type === 'steal' && character === 'Ambassador') {
      // Special message for blocking Steal with Ambassador (Scenario 3C in Captain.txt)
      const actionPlayer = game.players.find(p => p.id === game.currentAction!.action.playerId);
      await this.addGameLog(
        game.id, 
        `${player.name} blocked ${actionPlayer?.name || 'unknown'}'s steal with Ambassador.`
      );
    } else if (game.currentAction!.action.type === 'assassinate' && character === 'Contessa') {
      // Special message for blocking Assassinate with Contessa (Scenario 3A)
      const actionPlayer = game.players.find(p => p.id === game.currentAction!.action.playerId);
      await this.addGameLog(
        game.id, 
        `${player.name} blocked ${actionPlayer?.name || 'unknown'}'s assassination with Contessa.`
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
    let requiredCharacter: CardCharacter | undefined;
    
    if (game.gameState === 'block_response' && game.currentAction!.block) {
      // Challenging a block
      challengedId = game.currentAction!.block.blockerId;
      isBlockChallenge = true;
      requiredCharacter = game.currentAction!.block.character;
      
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
      requiredCharacter = this.rules.getRequiredCharacter(game.currentAction!.action.type);
    }
    
    // Set challenge information
    game.currentAction!.challenge = {
      challengerId: player.id,
      challengedId: challengedId,
      isBlockChallenge: isBlockChallenge
    };
    
    // Add specific logs for different action types
    if (isBlockChallenge && game.currentAction!.action.type === 'foreign_aid') {
      // Already logged in the specific case above
    } else if (!isBlockChallenge && game.currentAction!.action.type === 'exchange') {
      const challenged = game.players.find(p => p.id === challengedId);
      await this.addGameLog(
        game.id, 
        `${player.name} challenged ${challenged?.name || 'unknown'}'s claim to have Ambassador.`
      );
    } else if (!isBlockChallenge && game.currentAction!.action.type === 'steal') {
      // Specific text for Steal/Captain challenges (Scenario 2A/2B in Captain.txt)
      const challenged = game.players.find(p => p.id === challengedId);
      await this.addGameLog(
        game.id, 
        `${player.name} challenged ${challenged?.name || 'unknown'}'s claim to have Captain.`
      );
    } else if (isBlockChallenge && game.currentAction!.action.type === 'steal' && game.currentAction!.block?.character === 'Captain') {
      // Specific text for Captain block challenges to Steal (Scenario 3A/3B in Captain.txt)
      const challenged = game.players.find(p => p.id === challengedId);
      await this.addGameLog(
        game.id, 
        `${player.name} challenged ${challenged?.name || 'unknown'}'s claim to have Captain for blocking the steal.`
      );
    } else if (isBlockChallenge && game.currentAction!.action.type === 'steal' && game.currentAction!.block?.character === 'Ambassador') {
      // Specific text for Ambassador block challenges to Steal (Scenario 3C/3D in Captain.txt)
      const challenged = game.players.find(p => p.id === challengedId);
      await this.addGameLog(
        game.id, 
        `${player.name} challenged ${challenged?.name || 'unknown'}'s claim to have Ambassador for blocking the steal.`
      );
    } else if (!isBlockChallenge && game.currentAction!.action.type === 'assassinate') {
      // Specific text for Assassinate challenges
      const challenged = game.players.find(p => p.id === challengedId);
      await this.addGameLog(
        game.id, 
        `${player.name} challenged ${challenged?.name || 'unknown'}'s claim to have Assassin.`
      );
    } else if (isBlockChallenge && game.currentAction!.action.type === 'assassinate' && game.currentAction!.block?.character === 'Contessa') {
      // Specific text for Contessa block challenges to Assassinate
      const challenged = game.players.find(p => p.id === challengedId);
      await this.addGameLog(
        game.id, 
        `${player.name} challenged ${challenged?.name || 'unknown'}'s claim to have Contessa.`
      );
    } else {
      const challenged = game.players.find(p => p.id === challengedId);
      await this.addGameLog(
        game.id, 
        `${player.name} challenged ${challenged?.name || 'unknown'}.`
      );
    }
    
    // Check if the challenged player has the required character
    const challengedPlayer = game.players.find(p => p.id === challengedId);
    
    if (challengedPlayer && requiredCharacter) {
      // Check if the challenged player is already eliminated
      if (challengedPlayer.eliminated) {
        await this.addGameLog(
          game.id, 
          `${challengedPlayer.name} is already eliminated and cannot respond to the challenge.`
        );
        
        // Unable to challenge an eliminated player, so the challenge fails
        // The challenger should lose influence
        const challenger = game.players.find(p => p.id === player.id);
        if (challenger) {
          await this.addGameLog(
            game.id,
            `${challenger.name}'s challenge against an eliminated player fails. ${challenger.name} must lose influence.`
          );
          
          // Set up for the challenger to lose influence
          game.gameState = 'lose_influence';
          game.pendingActionFrom = player.id;
        } else {
          // Something went wrong, just advance to next player
          this.advanceToNextPlayer(game);
        }
        return;
      }
      
      const hasRequiredCard = this.playerHasRequiredCharacter(game, challengedId, requiredCharacter);
      
      if (!hasRequiredCard) {
        // Player doesn't have the required card
        // Skip the reveal stage and go straight to losing influence
        
        await this.addGameLog(
          game.id, 
          `${challengedPlayer.name} doesn't have the ${requiredCharacter} card and must lose influence.`
        );
        
        // Set game state for challenged player to lose influence
        game.gameState = 'lose_influence';
        game.pendingActionFrom = challengedId;
        
        // Clear the pending challenge since we're handling it here
        game.currentAction.challenge = {
          ...game.currentAction.challenge,
          isResolved: true
        };
        
        // If it was a block challenge for Foreign Aid, the action should now succeed
        if (isBlockChallenge && game.currentAction.action.type === 'foreign_aid') {
          const actionPlayer = game.players.find(p => p.id === game.currentAction!.action.playerId);
          if (actionPlayer) {
            // Delay giving coins until after losing influence
            game.currentAction.isResolved = false;
            await this.addGameLog(
              game.id, 
              `The block fails - ${actionPlayer.name} will take Foreign Aid once ${challengedPlayer.name} loses influence.`
            );
          }
        }
      } else {
        // Player has the required card, need to reveal
        // Update game state for player to reveal a card
        game.gameState = 'reveal_challenge';
        game.pendingActionFrom = challengedId;
        
        // Make sure to check if the game state needs to advance if player is eliminated
        this.checkPlayerElimination(game, challengedPlayer);
      }
    } else {
      // Default to reveal state if we can't determine the required character
      game.gameState = 'reveal_challenge';
      game.pendingActionFrom = challengedId;
      
      // Also check if we need to advance due to player elimination
      if (challengedPlayer) {
        this.checkPlayerElimination(game, challengedPlayer);
      }
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
        
        // First check if the action was blocked and the block was accepted
        // Scenario 5: Block accepted without challenge
        const blockAccepted = game.currentAction.block && 
          game.currentAction.responses.some(r => 
            r.playerId === player.id && r.type === 'pass'
          );
        
        if (blockAccepted) {
          // Action was blocked and block was accepted
          const blockingCharacter = game.currentAction.block?.character;
          const blocker = game.players.find(p => p.id === game.currentAction?.block?.blockerId);
          
          await this.addGameLog(
            game.id,
            `${player.name}'s steal was blocked by ${blocker?.name}'s ${blockingCharacter}. No coins were stolen.`
          );
          
          this.advanceToNextPlayer(game);
          break;
        }
        
        // If we got here, the steal was successful (either no block or block was challenged successfully)
        
        // Special handling for block challenges (Scenario 3A, 3B, 3C, 3D)
        // If there was a block challenge that was resolved, handle the result
        if (game.currentAction.challenge?.isBlockChallenge && game.currentAction.block) {
          const { challengerId, challengedId } = game.currentAction.challenge;
          const blockingCharacter = game.currentAction.block.character;
          
          // If the blocker (challengedId) is eliminated, the block failed and steal proceeds
          const blocker = game.players.find(p => p.id === challengedId);
          if (blocker?.eliminated) {
            // Block challenge succeeded, continue with steal (Scenario 3B or 3D)
            await this.addGameLog(
              game.id, 
              `${blocker.name}'s block with ${blockingCharacter} failed. The steal continues.`
            );
          }
          // Challenger was eliminated, block succeeded
          else {
            const challenger = game.players.find(p => p.id === challengerId);
            if (challenger?.eliminated) {
              // Block challenge failed, block succeeds (Scenario 3A or 3C)
              await this.addGameLog(
                game.id, 
                `${challenger.name}'s challenge failed. The steal is blocked by ${blocker?.name}'s ${blockingCharacter}.`
              );
              this.advanceToNextPlayer(game);
              break;
            }
          }
        }
        
        // Handle third party challenge resolution (Scenario 4A)
        // If a challenge failed but was from a third party, target may still get to block
        if (game.currentAction.challenge && !game.currentAction.challenge.isBlockChallenge) {
          const { challengerId } = game.currentAction.challenge;
          
          // If challenger isn't the target and challenger lost, the target may have blocked after
          if (challengerId !== stealTarget.id) {
            const challenger = game.players.find(p => p.id === challengerId);
            
            if (challenger?.eliminated || game.currentAction.challenge.isResolved) {
              // Challenge failed, but the target may have blocked after
              const blockResponse = game.currentAction.responses.find(r => 
                r.playerId === stealTarget.id && r.type === 'block'
              );
              
              if (blockResponse) {
                // Target blocked after the third-party challenge failed
                await this.addGameLog(
                  game.id, 
                  `${stealTarget.name} blocked the steal with ${blockResponse.character} after the challenge failed.`
                );
                this.advanceToNextPlayer(game);
                break;
              }
            }
          }
        }
        
        // If we made it here, the steal is successful (Scenario 1, 2A, 3B, 3D, 4A)
        
        // Check if target has coins
        if (stealTarget.coins === 0) {
          await this.addGameLog(
            game.id, 
            `${player.name} attempted to steal from ${stealTarget.name}, but they had no coins to steal.`
          );
          this.advanceToNextPlayer(game);
          break;
        }
        
        // Calculate coins to steal (up to 2)
        const stolenCoins = Math.min(stealTarget.coins, 2);
        
        // Transfer coins
        stealTarget.coins -= stolenCoins;
        player.coins += stolenCoins;
        
        // Log the action
        await this.addGameLog(
          game.id, 
          `${player.name} successfully stole ${stolenCoins} coin${stolenCoins !== 1 ? 's' : ''} from ${stealTarget.name}.`
        );
        
        // End turn
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
        
        // Check if this was a successful assassination after challenges
        // Following scenario 2A from Assassinate.txt where a player challenged and lost
        if (game.currentAction.challenge) {
          // If there was a challenge to the Assassin claim that failed (challenger lost)
          // we need to check if the target should lose one or two influences
          const { challengerId, challengedId, isBlockChallenge } = game.currentAction.challenge;
          
          // Only handle special case if this wasn't a block challenge
          if (!isBlockChallenge) {
            // If the target was the challenger who lost a challenge to an Assassin
            // they should lose both influences at once - scenario 2A
            if (challengerId === assassinateTarget.id) {
              // Target loses all influence - no UI choice needed
              // Mark all cards as eliminated
              assassinateTarget.cards.forEach(card => card.eliminated = true);
              
              await this.addGameLog(
                game.id, 
                `${assassinateTarget.name} lost all influence (one for losing the challenge and one for the assassination).`
              );
              
              // Mark player as eliminated directly without calling checkPlayerElimination
              // This avoids double advancement issues
              assassinateTarget.eliminated = true;
              game.logs.push(this.createLog(`${assassinateTarget.name} has been eliminated from the game!`));
              
              // Check if the game is over
              if (this.rules.isGameOver(game)) {
                const winner = this.rules.getWinner(game);
                if (winner) {
                  game.gameState = 'game_over';
                  game.logs.push(this.createLog(`${winner.name} has won the game!`));
                  return;
                }
              }
              
              // Move to the next player - no need for lose_influence state
              this.advanceToNextPlayer(game);
              return;
            }
          }
        }
        
        // Standard assassination (no special challenge case)
        // Set up for target to lose influence - scenario 1
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
        
        // According to Exchange.txt scenario 1, the player draws 2 new cards
        // Get two cards from the deck
        const drawnCards = game.deck.slice(-2);
        game.deck = game.deck.slice(0, -2);
        
        // Store in the current action
        game.currentAction.exchangeCards = drawnCards;
        
        // Update game state to exchange_selection
        game.gameState = 'exchange_selection';
        
        await this.addGameLog(
          game.id, 
          `${player.name} draws cards from the deck for exchange.`
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