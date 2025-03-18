// GameService utility with exported singleton instance
import { 
  Game, 
  PlayerID, 
  CardCharacter, 
  ActionType,
  ResponseType,
  ActionRequest,
  ACTION_PROPERTIES
} from '@/domain/types/game';
import { GameService } from '@/domain/services/GameService';
import { FirebaseGameRepository } from '@/infrastructure/repositories/FirebaseGameRepository';

// Create singleton instances
const gameRepository = new FirebaseGameRepository();
export const gameService = new GameService(gameRepository);

// Re-export the subscribeToGame function for convenience
export const subscribeToGame = (
  gameId: string, 
  callback: (game: Game) => void
): (() => void) => {
  return gameService.subscribeToGame(gameId, callback);
};

// Utility exports for convenience:

// Get valid action types for a player
export const getValidActions = (game: Game, playerId: PlayerID): ActionType[] => {
  return gameService.getValidActions(game, playerId);
};

// Get valid response types for a player
export const getValidResponses = (game: Game, playerId: PlayerID): ResponseType[] => {
  return gameService.getValidResponses(game, playerId);
};

// Get characters that can block an action
export const getBlockingCharacters = (actionType: ActionType): CardCharacter[] => {
  return ACTION_PROPERTIES[actionType].blockingCharacters;
};

// Check if it's a player's turn
export const isPlayerTurn = (game: Game, playerId: PlayerID): boolean => {
  return game.gameState === 'play' && 
         game.players[game.currentPlayerIndex].id === playerId;
};

// Check if a player needs to take an action
export const isWaitingForPlayer = (game: Game, playerId: PlayerID): boolean => {
  return game.pendingActionFrom === playerId;
};

// Format the game log for display
export const formatGameLog = (game: Game): string[] => {
  return game.logs.map(log => log.message);
};

// Helper function to get the display name for an action
export const getActionDisplayName = (actionType: ActionType): string => {
  switch (actionType) {
    case 'income': return 'Income';
    case 'foreign_aid': return 'Foreign Aid';
    case 'tax': return 'Tax';
    case 'coup': return 'Coup';
    case 'steal': return 'Steal';
    case 'assassinate': return 'Assassinate';
    case 'exchange': return 'Exchange';
    default: return actionType;
  }
};

// Helper function to get the action cost
export const getActionCost = (actionType: ActionType): number => {
  return ACTION_PROPERTIES[actionType].cost;
};

// Export the game service as the default
export default gameService;