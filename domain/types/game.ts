// Game-related types and interfaces
export type PlayerID = string;
export type CardCharacter = 'Duke' | 'Assassin' | 'Captain' | 'Ambassador' | 'Contessa';

export interface Card {
  character: CardCharacter;
  eliminated: boolean;
}

export interface Player {
  id: PlayerID;
  name: string;
  coins: number;
  cards: Card[];
  eliminated: boolean;
}

export type GameState = 'setup' | 'play' | 'action' | 'challenge' | 'block' | 'gameover' | 'coup_response';

export interface GameAction {
  type: string;
  playerId: PlayerID;
  target?: PlayerID;
  character?: CardCharacter;
  // Used for tracking responses, like who is being challenged or who needs to respond to a coup
  blockerId?: PlayerID;
  responderId?: PlayerID;
  challengeBlock?: boolean;
}

export interface Game {
  id: string;
  players: Player[];
  currentPlayerIndex: number;
  deck: Card[];
  treasury: number;
  gameState: GameState;
  currentAction?: GameAction;
  // Track which players have responded to the current action (passed or blocked)
  actionResponses?: PlayerID[];
  log: string[];
  createdAt: string | Date; // Store as ISO string in Firestore
  updatedAt: string | Date; // Store as ISO string in Firestore
}