import { Game, PlayerID } from '../types/game';

export interface IGameRepository {
  createGame(players: string[]): Promise<Game>;
  getGame(gameId: string): Promise<Game | null>;
  updateGame(game: Game): Promise<void>;
  subscribeToGame(gameId: string, callback: (game: Game) => void): () => void;
  joinGame(gameId: string, playerId: PlayerID): Promise<void>;
  leaveGame(gameId: string, playerId: PlayerID): Promise<void>;
  addPlayer(gameId: string, playerName: string): Promise<string>;
}