import { IGameService } from '../interfaces/IGameService';
import { IGameRepository } from '../interfaces/IGameRepository';
import { Game, PlayerID, CardCharacter, GameAction, Card } from '../types/game';
import { GameRules } from './GameRules';

export class GameService implements IGameService {
  constructor(private repository: IGameRepository) {}

  async createGame(players: string[]): Promise<Game> {
    // Create game with just the host player initially
    if (!players.length) {
      throw new Error('At least one player (host) is required');
    }

    // Create initial game state with just the host
    const game = await this.repository.createGame([players[0]]);
    return game;
  }

  async joinGame(gameId: string, playerName: string): Promise<string> {
    const game = await this.repository.getGame(gameId);
    if (!game) throw new Error('Game not found');

    if (game.gameState !== 'setup') {
      throw new Error('Cannot join a game that has already started');
    }

    if (game.players.length >= 6) {
      throw new Error('Game is full (maximum 6 players)');
    }

    // Add new player to the game
    const playerId = await this.repository.addPlayer(gameId, playerName);
    return playerId;
  }

  async startGame(gameId: string): Promise<void> {
    const game = await this.repository.getGame(gameId);
    if (!game) throw new Error('Game not found');

    if (game.players.length < 3) {
      throw new Error('At least 3 players required to start');
    }

    if (game.players.length > 6) {
      throw new Error('Maximum 6 players allowed');
    }
    
    // Create a fresh deck to prevent issues with previously mutated deck
    const characters: CardCharacter[] = ['Duke', 'Assassin', 'Captain', 'Ambassador', 'Contessa'];
    const newDeck: Card[] = [];
    
    // Create 3 of each character card
    characters.forEach(character => {
      for (let i = 0; i < 3; i++) {
        newDeck.push({ character, eliminated: false });
      }
    });
    
    // Shuffle the fresh deck
    game.deck = newDeck.sort(() => Math.random() - 0.5);

    // Deal two cards to each player using non-mutating approach
    for (const player of game.players) {
      // Check if we have enough cards
      if (game.deck.length < 2) {
        throw new Error('Not enough cards in the deck');
      }
      
      // Get 2 cards from the end of the deck without mutating the original
      const cardsForPlayer = game.deck.slice(-2);
      game.deck = game.deck.slice(0, -2); // Remove those cards from the deck
      
      player.cards = cardsForPlayer;
      
      // Also reset other player stats
      player.coins = 2; // Start with 2 coins
      player.eliminated = false;
    }

    // Update game state to 'play'
    game.gameState = 'play';
    game.currentPlayerIndex = 0; // Start with the first player
    game.log = ['Game started']; // Reset log
    
    await this.repository.updateGame(game);
  }

  async leaveGame(gameId: string, playerId: PlayerID): Promise<void> {
    await this.repository.leaveGame(gameId, playerId);
  }

  async performAction(gameId: string, action: GameAction): Promise<void> {
    const game = await this.repository.getGame(gameId);
    if (!game) throw new Error('Game not found');

    if (!GameRules.canPerformAction(game, action)) {
      throw new Error('Invalid action');
    }

    // Update game state based on action
    const player = game.players.find(p => p.id === action.playerId);
    if (!player) throw new Error('Player not found');

    switch (action.type) {
      case 'income':
        player.coins += 1;
        game.log.push(`${player.name} took income (+1 coin)`);
        // Move to next player after income
        game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.players.length;
        break;

      case 'foreign_aid':
        game.log.push(`${player.name} attempted to take foreign aid`);
        // No next player yet - wait for potential block
        game.gameState = 'action';
        game.currentAction = action;
        // Initialize the array of players who have responded to this action
        game.actionResponses = [];
        break;

      case 'tax':
        player.coins += 3;
        game.log.push(`${player.name} collected tax as Duke (+3 coins)`);
        // Can be challenged, so set current action
        game.gameState = 'action';
        game.currentAction = action;
        // Initialize the array of players who have responded to this action
        game.actionResponses = [];
        break;

      case 'coup':
        if (!action.target) throw new Error('Target required for coup');
        const coupTargetPlayer = game.players.find(p => p.id === action.target);
        if (!coupTargetPlayer) throw new Error('Target player not found');
        
        player.coins -= GameRules.COUP_COST;
        
        // Check if target player has any non-eliminated cards
        const activeCards = coupTargetPlayer.cards.filter(card => !card.eliminated);
        
        if (activeCards.length === 0) {
          throw new Error('Target player has no cards to lose');
        } else if (activeCards.length === 1) {
          // If only one card, automatically eliminate it
          const cardIndex = coupTargetPlayer.cards.findIndex(card => !card.eliminated);
          coupTargetPlayer.cards[cardIndex].eliminated = true;
          
          // Check if player is eliminated
          if (coupTargetPlayer.cards.every(card => card.eliminated)) {
            coupTargetPlayer.eliminated = true;
            game.log.push(`${player.name} launched a coup against ${coupTargetPlayer.name}. ${coupTargetPlayer.name} lost their last influence and was eliminated!`);
          } else {
            game.log.push(`${player.name} launched a coup against ${coupTargetPlayer.name}. ${coupTargetPlayer.name} lost an influence!`);
          }
          
          // Move to next player
          game.gameState = 'play';
          game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.players.length;
          
          // Skip eliminated players
          while (game.players[game.currentPlayerIndex].eliminated) {
            game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.players.length;
          }
        } else {
          // Target player must choose which card to reveal
          game.log.push(`${player.name} launched a coup against ${coupTargetPlayer.name}. ${coupTargetPlayer.name} must lose an influence.`);
          
          // Set game state to indicate the target player needs to choose a card to lose
          game.gameState = 'coup_response';
          game.currentAction = { 
            ...action,
            // Store the target player who needs to respond
            responderId: action.target
          };
        }
        break;
        
      case 'assassinate':
        if (!action.target) throw new Error('Target required for assassination');
        const assassinateTargetPlayer = game.players.find(p => p.id === action.target);
        if (!assassinateTargetPlayer) throw new Error('Target player not found');
        
        player.coins -= GameRules.ASSASSINATE_COST;
        game.log.push(`${player.name} attempted to assassinate ${assassinateTargetPlayer.name}`);
        game.gameState = 'action';
        game.currentAction = action;
        game.actionResponses = [];
        break;
        
      case 'steal':
        if (!action.target) throw new Error('Target required for stealing');
        const stealTargetPlayer = game.players.find(p => p.id === action.target);
        if (!stealTargetPlayer) throw new Error('Target player not found');
        
        game.log.push(`${player.name} attempted to steal from ${stealTargetPlayer.name}`);
        game.gameState = 'action';
        game.currentAction = action;
        game.actionResponses = [];
        break;
        
      case 'exchange':
        game.log.push(`${player.name} attempted to exchange cards with the court`);
        game.gameState = 'action';
        game.currentAction = action;
        game.actionResponses = [];
        break;
        
      case 'pass':
        // Player is passing/allowing an action
        if (!game.currentAction) {
          throw new Error('No action to pass on');
        }
        
        // Add this player to the list of responses
        if (!game.actionResponses) {
          game.actionResponses = [];
        }
        
        // If this player hasn't already responded
        if (!game.actionResponses.includes(player.id)) {
          game.actionResponses.push(player.id);
          game.log.push(`${player.name} allowed the action`);
        }
        
        // Get all active players who need to respond (excluding the action initiator)
        const activePlayers = game.players.filter(p => 
          !p.eliminated && 
          p.id !== game.currentAction!.playerId
        );
        
        // Check if all active players have responded
        const allPlayersResponded = activePlayers.every(p => 
          game.actionResponses!.includes(p.id)
        );
        
        if (allPlayersResponded) {
          // All players have passed on the action, complete it
          game.log.push(`All players allowed the action, it succeeds!`);
          
          // If it's a foreign aid action, add coins to player
          if (game.currentAction?.type === 'foreign_aid') {
            const actionPlayer = game.players.find(p => p.id === game.currentAction.playerId);
            if (actionPlayer) {
              actionPlayer.coins += 2;
              game.log.push(`${actionPlayer.name} successfully took foreign aid (+2 coins)`);
            }
          }
          
          // Complete the action and move to next player
          game.gameState = 'play';
          game.currentAction = undefined;
          game.actionResponses = undefined;
          game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.players.length;
          
          // Skip eliminated players
          while (game.players[game.currentPlayerIndex].eliminated) {
            game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.players.length;
          }
        }
        
        break;
        
      case 'accept_block':
        // Player is accepting a block without revealing a card
        if (game.gameState !== 'block' || !game.currentAction) {
          throw new Error('No block to accept');
        }
        
        if (game.currentAction.playerId !== player.id) {
          throw new Error('Only the player being blocked can accept the block');
        }
        
        game.log.push(`${player.name} accepted the block. The action failed.`);
        
        // Action is over, move to next player
        game.gameState = 'play';
        game.currentAction = undefined;
        game.actionResponses = undefined;
        game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.players.length;
        
        // Skip eliminated players
        while (game.players[game.currentPlayerIndex].eliminated) {
          game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.players.length;
        }
        
        break;
        
      case 'challenge_block':
        // Player is challenging a block
        if (game.gameState !== 'block' || !game.currentAction) {
          throw new Error('No block to challenge');
        }
        
        if (game.currentAction.playerId !== player.id) {
          throw new Error('Only the player being blocked can challenge the block');
        }
        
        // Find the blocker (the player who blocked the action)
        const blocker = game.players.find(p => game.actionResponses?.includes(p.id) && p.id !== game.currentAction!.playerId);
        
        if (!blocker) {
          throw new Error('Could not determine who blocked the action');
        }
        
        game.log.push(`${player.name} challenged ${blocker.name}'s block.`);
        
        // Update game state to indicate challenge of block
        game.gameState = 'challenge';
        
        // Set the challenge as a special case to track who's being challenged
        game.currentAction = {
          ...game.currentAction,
          // Mark this as a block challenge by setting a property
          challengeBlock: true,
          // Store the blocker's ID
          blockerId: blocker.id
        };
        
        break;
    }

    await this.repository.updateGame(game);
  }

  async challengeAction(gameId: string, challengerId: PlayerID): Promise<void> {
    const game = await this.repository.getGame(gameId);
    if (!game) throw new Error('Game not found');
    
    if (!game.currentAction) throw new Error('No action to challenge');
    if (!GameRules.canChallenge(game.currentAction)) {
      throw new Error('Action cannot be challenged');
    }

    // Update game state to challenge mode
    game.gameState = 'challenge';
    const challenger = game.players.find(p => p.id === challengerId);
    const actionPlayer = game.players.find(p => p.id === game.currentAction!.playerId);
    
    if (!challenger || !actionPlayer) {
      throw new Error('Player not found');
    }
    
    // Add this player to the list of responses
    if (!game.actionResponses) {
      game.actionResponses = [];
    }
    game.actionResponses.push(challengerId);
    
    game.log.push(`${challenger.name} challenged the action by ${actionPlayer.name}`);
    
    await this.repository.updateGame(game);
  }
  
  async revealCard(gameId: string, playerId: PlayerID, cardIndex: number): Promise<void> {
    const game = await this.repository.getGame(gameId);
    if (!game) throw new Error('Game not found');
    
    const player = game.players.find(p => p.id === playerId);
    if (!player) throw new Error('Player not found');
    
    if (cardIndex < 0 || cardIndex >= player.cards.length) {
      throw new Error('Invalid card index');
    }
    
    const revealedCard = player.cards[cardIndex];
    
    // For a coup response
    if (game.gameState === 'coup_response' && game.currentAction?.responderId === playerId) {
      // Mark the card as eliminated
      player.cards[cardIndex].eliminated = true;
      game.log.push(`${player.name} lost their ${revealedCard.character} to the coup.`);
      
      // Check if player is eliminated
      if (player.cards.every(card => card.eliminated)) {
        player.eliminated = true;
        game.log.push(`${player.name} has been eliminated from the game!`);
      }
      
      // Move to next player
      game.gameState = 'play';
      game.currentAction = undefined;
      game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.players.length;
      
      // Skip eliminated players
      while (game.players[game.currentPlayerIndex].eliminated) {
        game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.players.length;
      }
    }
    // For a block challenge
    else if (game.gameState === 'challenge' && game.currentAction?.challengeBlock) {
      // The blocker is being challenged to reveal they have the claimed character
      const blockerId = game.currentAction.blockerId;
      const blocker = game.players.find(p => p.id === blockerId);
      
      if (!blocker) {
        throw new Error('Blocker not found');
      }
      
      // Determine required character for the block based on action type
      const requiredCharacter = GameRules.getRequiredCharacter(game.currentAction);
      const blockingCharacter = GameRules.getBlockingCharacters(game.currentAction)[0]; // Use first blocking character
      
      // If the blocker has the required character
      if (revealedCard.character === blockingCharacter) {
        // Blocker succeeded - reveal and replace the card
        game.log.push(`${player.name} revealed ${revealedCard.character} to prove the block. The action fails.`);
        
        // The action is blocked, so we advance to next player
        game.gameState = 'play';
        game.currentAction = undefined;
        game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.players.length;
        
        // Skip eliminated players
        while (game.players[game.currentPlayerIndex].eliminated) {
          game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.players.length;
        }
      } else {
        // Blocker failed - lose card and action goes through
        player.cards[cardIndex].eliminated = true;
        game.log.push(`${player.name} revealed ${revealedCard.character} which is not ${blockingCharacter}. The block fails.`);
        
        // Check if player is eliminated (lost all cards)
        if (player.cards.every(card => card.eliminated)) {
          player.eliminated = true;
          game.log.push(`${player.name} has been eliminated from the game`);
        }
        
        // The action completes successfully since the block failed
        const originalAction = game.currentAction;
        const actionPlayer = game.players.find(p => p.id === originalAction!.playerId);
        
        // Execute the action that was previously blocked
        if (originalAction?.type === 'foreign_aid' && actionPlayer) {
          actionPlayer.coins += 2;
          game.log.push(`${actionPlayer.name}'s action succeeds! (+2 coins from foreign aid)`);
        } else {
          game.log.push(`${actionPlayer?.name}'s action succeeds!`);
        }
        
        // Continue game
        game.gameState = 'play';
        game.currentAction = undefined;
        game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.players.length;
        
        // Skip eliminated players
        while (game.players[game.currentPlayerIndex].eliminated) {
          game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.players.length;
        }
      }
    } 
    // Regular challenge
    else if (game.gameState === 'challenge') {
      // Determine if the player has the required character
      const requiredCharacter = GameRules.getRequiredCharacter(game.currentAction!);
      
      if (revealedCard.character === requiredCharacter) {
        // Player succeeded - reveal and replace the card
        game.log.push(`${player.name} revealed ${revealedCard.character} to prove the claim. The action succeeds.`);
        
        // The challenger loses influence
        const challenger = game.players.find(p => game.actionResponses?.includes(p.id));
        if (challenger) {
          // Force the challenger to reveal a card next
          game.log.push(`${challenger.name} must now lose an influence.`);
          // This would be handled by another UI element for card selection
        }
        
        // Continue game - action succeeds
        game.gameState = 'play';
        game.currentAction = undefined;
        game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.players.length;
        
        // Skip eliminated players
        while (game.players[game.currentPlayerIndex].eliminated) {
          game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.players.length;
        }
      } else {
        // Player failed - lose card and action fails
        player.cards[cardIndex].eliminated = true;
        game.log.push(`${player.name} revealed ${revealedCard.character} which is not ${requiredCharacter}. The action fails.`);
        
        // Check if player is eliminated (lost all cards)
        if (player.cards.every(card => card.eliminated)) {
          player.eliminated = true;
          game.log.push(`${player.name} has been eliminated from the game`);
        }
        
        // Continue game
        game.gameState = 'play';
        game.currentAction = undefined;
        game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.players.length;
        
        // Skip eliminated players
        while (game.players[game.currentPlayerIndex].eliminated) {
          game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.players.length;
        }
      }
    }
    // Simple reveal with card loss
    else {
      // Mark the card as eliminated
      player.cards[cardIndex].eliminated = true;
      game.log.push(`${player.name} revealed and lost ${revealedCard.character}`);
      
      // Check if player is eliminated (lost all cards)
      if (player.cards.every(card => card.eliminated)) {
        player.eliminated = true;
        game.log.push(`${player.name} has been eliminated from the game`);
      }
      
      // Continue to next player's turn
      game.gameState = 'play';
      game.currentAction = undefined;
      game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.players.length;
      
      // Skip eliminated players
      while (game.players[game.currentPlayerIndex].eliminated) {
        game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.players.length;
      }
    }
    
    // Check if game is over (only one player left)
    if (GameRules.isGameOver(game)) {
      game.gameState = 'gameover';
      const winner = game.players.find(p => !p.eliminated);
      if (winner) {
        game.log.push(`${winner.name} has won the game!`);
      }
    }
    
    await this.repository.updateGame(game);
  }

  async blockAction(gameId: string, blockerId: PlayerID, character: CardCharacter): Promise<void> {
    const game = await this.repository.getGame(gameId);
    if (!game) throw new Error('Game not found');
    
    if (!game.currentAction) throw new Error('No action to block');
    if (!GameRules.canBlock(game.currentAction, character)) {
      throw new Error('Action cannot be blocked with this character');
    }
    
    // Add this player to the list of responses
    if (!game.actionResponses) {
      game.actionResponses = [];
    }
    game.actionResponses.push(blockerId);

    game.gameState = 'block';
    game.log.push(`${game.players.find(p => p.id === blockerId)?.name} blocked with ${character}`);
    
    await this.repository.updateGame(game);
  }

  async getCurrentState(gameId: string): Promise<Game> {
    const game = await this.repository.getGame(gameId);
    if (!game) throw new Error('Game not found');
    return game;
  }

  subscribeToGame(gameId: string, callback: (game: Game) => void): () => void {
    return this.repository.subscribeToGame(gameId, callback);
  }
}