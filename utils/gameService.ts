// Direct GameService implementation
import { Game } from '@/domain/types/game';
import { GameService } from '@/domain/services/GameService';
import { FirebaseGameRepository } from '@/infrastructure/repositories/FirebaseGameRepository';

// Export the type for backward compatibility
export type GameState = Game;

// Create singleton instances directly
const gameRepository = new FirebaseGameRepository();
export const gameService = new GameService(gameRepository);

// Re-export subscribeToGame function for convenience
export const subscribeToGame = (
  gameId: string, 
  callback: (game: Game) => void
): (() => void) => {
  return gameService.subscribeToGame(gameId, callback);
};

export default gameService;