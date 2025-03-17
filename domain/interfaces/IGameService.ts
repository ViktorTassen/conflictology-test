import { Game, PlayerID, CardCharacter, GameAction } from '../types/game';

export interface IGameService {
  // Game lifecycle
  createGame(players: string[]): Promise<Game>;
  startGame(gameId: string): Promise<void>;
  joinGame(gameId: string, playerName: string): Promise<string>;
  leaveGame(gameId: string, playerId: PlayerID): Promise<void>;
  
  // Game actions
  performAction(gameId: string, action: GameAction): Promise<void>;
  challengeAction(gameId: string, challengerId: PlayerID): Promise<void>;
  blockAction(gameId: string, blockerId: PlayerID, character: CardCharacter): Promise<void>;
  revealCard(gameId: string, playerId: PlayerID, cardIndex: number): Promise<void>;
  
  // Game state
  getCurrentState(gameId: string): Promise<Game>;
  subscribeToGame(gameId: string, callback: (game: Game) => void): () => void;
}