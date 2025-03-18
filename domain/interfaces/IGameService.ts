import { 
  Game, 
  PlayerID, 
  CardCharacter, 
  ActionType,
  ResponseType,
  ActionRequest
} from '../types/game';

// Game lifecycle management
export interface IGameLifecycleService {
  createGame(hostPlayer: string): Promise<Game>;
  joinGame(gameId: string, playerName: string): Promise<PlayerID>;
  startGame(gameId: string): Promise<void>;
  leaveGame(gameId: string, playerId: PlayerID): Promise<void>;
}

// Game state management
export interface IGameStateService {
  getCurrentState(gameId: string): Promise<Game>;
  subscribeToGame(gameId: string, callback: (game: Game) => void): () => void;
}

// Game action execution
export interface IGameActionService {
  performAction(gameId: string, action: ActionRequest): Promise<void>;
  respondToAction(gameId: string, playerId: PlayerID, responseType: ResponseType, character?: CardCharacter): Promise<void>;
  revealCard(gameId: string, playerId: PlayerID, cardIndex: number): Promise<void>;
  loseInfluence(gameId: string, playerId: PlayerID, cardIndex: number): Promise<void>;
  selectExchangeCards(gameId: string, playerId: PlayerID, keptCardIndices: number[]): Promise<void>;
}

// Game validation
export interface IGameValidationService {
  canPerformAction(game: Game, action: ActionRequest): boolean;
  canRespondWithBlock(game: Game, playerId: PlayerID, character: CardCharacter): boolean;
  canRespondWithChallenge(game: Game, playerId: PlayerID): boolean;
  getValidActions(game: Game, playerId: PlayerID): ActionType[];
  getValidResponses(game: Game, playerId: PlayerID): ResponseType[];
}

// Game end and restart management
export interface IGameEndService {
  voteForRestart(gameId: string, playerId: PlayerID): Promise<void>;
  cancelRestartVote(gameId: string, playerId: PlayerID): Promise<void>;
}

// Combined interface for the main service
export interface IGameService extends 
  IGameLifecycleService, 
  IGameStateService, 
  IGameActionService, 
  IGameValidationService,
  IGameEndService {}