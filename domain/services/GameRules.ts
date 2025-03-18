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
  ACTION_PROPERTIES,
  CHARACTER_ABILITIES,
  GAME_CONSTANTS
} from '../types/game';
import { IGameValidationService } from '../interfaces/IGameService';

export class GameRules implements IGameValidationService {
  // Check if a player can perform an action
  canPerformAction(game: Game, action: ActionRequest): boolean {
    // Game must be in 'play' state
    if (game.gameState !== 'play') {
      return false;
    }
    
    // Must be the player's turn
    const currentPlayer = game.players[game.currentPlayerIndex];
    if (currentPlayer.id !== action.playerId || currentPlayer.eliminated) {
      return false;
    }
    
    // Get action properties
    const actionProps = ACTION_PROPERTIES[action.type];
    
    // Check if player has enough coins
    if (currentPlayer.coins < actionProps.cost) {
      return false;
    }
    
    // For targeted actions, target must be valid
    if (actionProps.targetRequired) {
      if (!action.target) {
        return false;
      }
      
      // Target must exist and not be eliminated
      const targetPlayer = game.players.find(p => p.id === action.target);
      if (!targetPlayer || targetPlayer.eliminated) {
        return false;
      }
      
      // Can't target yourself
      if (targetPlayer.id === currentPlayer.id) {
        return false;
      }
    }
    
    // If player has 10+ coins, they must coup
    if (currentPlayer.coins >= GAME_CONSTANTS.MAX_COINS_BEFORE_COUP && action.type !== 'coup') {
      return false;
    }
    
    return true;
  }
  
  // Check if a player can block an action with a character
  canRespondWithBlock(game: Game, playerId: PlayerID, character: CardCharacter): boolean {
    // Game must be in action_response state
    if (game.gameState !== 'action_response' || !game.currentAction) {
      return false;
    }
    
    // Get the current action
    const action = game.currentAction.action;
    const actionProps = ACTION_PROPERTIES[action.type];
    
    // Action must be blockable
    if (!actionProps.blockable) {
      return false;
    }
    
    // Character must be able to block this action
    if (!actionProps.blockingCharacters.includes(character)) {
      return false;
    }
    
    // For targeted actions, only the target can block
    if (actionProps.targetRequired) {
      return action.target === playerId;
    }
    
    // For non-targeted actions (like foreign aid), anyone except the action player can block
    return playerId !== action.playerId;
  }
  
  // Check if a player can challenge an action or block
  canRespondWithChallenge(game: Game, playerId: PlayerID): boolean {
    // Player should not be eliminated
    const player = game.players.find(p => p.id === playerId);
    if (!player || player.eliminated) {
      return false;
    }
    
    // For an action challenge
    if (game.gameState === 'action_response' && game.currentAction) {
      const action = game.currentAction.action;
      const actionProps = ACTION_PROPERTIES[action.type];
      
      // Action must be challengeable
      if (!actionProps.challengeable) {
        return false;
      }
      
      // Cannot challenge your own action
      if (playerId === action.playerId) {
        return false;
      }
      
      // Players can always challenge actions regardless of whether the target has passed
      // This is removed as per Coup rules - any player can challenge at any time
      
      return true;
    }
    
    // For a block challenge
    if (game.gameState === 'block_response' && game.currentAction?.block) {
      // Any player can challenge a character claim except the blocker themselves
      // Can't challenge your own block
      return playerId !== game.currentAction.block.blockerId;
    }
    
    return false;
  }
  
  // Get a list of valid actions for a player
  getValidActions(game: Game, playerId: PlayerID): ActionType[] {
    // Game must be in play state
    if (game.gameState !== 'play') {
      return [];
    }
    
    // Must be the player's turn
    const currentPlayer = game.players[game.currentPlayerIndex];
    if (currentPlayer.id !== playerId || currentPlayer.eliminated) {
      return [];
    }
    
    const validActions: ActionType[] = [];
    
    // Check if mandatory coup is required
    if (currentPlayer.coins >= GAME_CONSTANTS.MAX_COINS_BEFORE_COUP) {
      return ['coup'];
    }
    
    // Check each action
    Object.values(ACTION_PROPERTIES).forEach(actionProps => {
      // Check if player has enough coins
      if (currentPlayer.coins >= actionProps.cost) {
        validActions.push(actionProps.type);
      }
    });
    
    return validActions;
  }
  
  // Get a list of valid responses for a player
  getValidResponses(game: Game, playerId: PlayerID): ResponseType[] {
    const validResponses: ResponseType[] = [];
    
    // Pass is always a valid response in response states
    if (
      (game.gameState === 'action_response' || game.gameState === 'block_response') &&
      this.canRespondWithPass(game, playerId)
    ) {
      validResponses.push('pass');
    }
    
    // Check if player can challenge
    if (this.canRespondWithChallenge(game, playerId)) {
      validResponses.push('challenge');
    }
    
    // Check if player can block
    if (
      game.gameState === 'action_response' && 
      game.currentAction && 
      ACTION_PROPERTIES[game.currentAction.action.type].blockable
    ) {
      const blockingCharacters = ACTION_PROPERTIES[game.currentAction.action.type].blockingCharacters;
      
      // Add block if any blocking character is valid
      for (const character of blockingCharacters) {
        if (this.canRespondWithBlock(game, playerId, character)) {
          validResponses.push('block');
          break;
        }
      }
    }
    
    return validResponses;
  }
  
  // Helper methods
  
  // Check if a player can pass on responding to an action
  private canRespondWithPass(game: Game, playerId: PlayerID): boolean {
    // Player should not be eliminated
    const player = game.players.find(p => p.id === playerId);
    if (!player || player.eliminated) {
      return false;
    }
    
    // Can't pass on your own action
    if (game.currentAction && game.currentAction.action.playerId === playerId) {
      return false;
    }
    
    // Check if already responded
    if (
      game.currentAction && 
      game.currentAction.responses.some(r => r.playerId === playerId)
    ) {
      return false;
    }
    
    return true;
  }
  
  // Check if the game is over (only one player left)
  isGameOver(game: Game): boolean {
    const activePlayers = game.players.filter(p => !p.eliminated);
    return activePlayers.length === 1;
  }
  
  // Get the winning player (if game is over)
  getWinner(game: Game): Player | null {
    if (this.isGameOver(game)) {
      return game.players.find(p => !p.eliminated) || null;
    }
    return null;
  }
  
  // Check if a player has a certain character
  playerHasCharacter(player: Player, character: CardCharacter): boolean {
    return player.cards.some(card => !card.eliminated && card.character === character);
  }
  
  // Get characters that can block an action
  getBlockingCharacters(actionType: ActionType): CardCharacter[] {
    return ACTION_PROPERTIES[actionType].blockingCharacters;
  }
  
  // Get character required for an action
  getRequiredCharacter(actionType: ActionType): CardCharacter | undefined {
    return ACTION_PROPERTIES[actionType].requiredCharacter;
  }
}