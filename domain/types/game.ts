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

// All possible game states
export type GameState = 
  | 'setup' // Initial game state when players are joining
  | 'play' // Player's turn to select an action
  | 'action_response' // Action was announced, waiting for challenges or blocks
  | 'block_response' // Action was blocked, waiting for challenges to the block
  | 'reveal_challenge' // Player needs to reveal a card due to challenge
  | 'lose_influence' // Player needs to choose a card to lose
  | 'exchange_selection' // Player choosing cards during exchange action
  | 'game_over' // Game is over, showing results

// All possible action types
export type ActionType = 
  | 'income' 
  | 'foreign_aid' 
  | 'tax' 
  | 'coup' 
  | 'steal' 
  | 'assassinate' 
  | 'exchange';

// All possible response types
export type ResponseType = 
  | 'pass' // Allow action to proceed
  | 'block' // Block an action with a character
  | 'challenge'; // Challenge an action or block

export interface ActionRequest {
  type: ActionType;
  playerId: PlayerID;
  target?: PlayerID; // Required for targeted actions (coup, steal, assassinate)
}

export interface Response {
  type: ResponseType;
  playerId: PlayerID;
  character?: CardCharacter; // Required when blocking
}

export interface GameAction {
  action: ActionRequest;
  responses: Response[];
  isResolved: boolean;
  
  // For tracking challenge and block state
  challenge?: {
    challengerId: PlayerID;
    challengedId: PlayerID;
    isBlockChallenge: boolean;
    isResolved?: boolean; // Set to true if challenge was auto-resolved (player had no card)
    specialAssassinCase?: boolean; // Set to true for Scenario 2A in Assassinate.txt (target challenged Assassin and lost)
  };
  
  block?: {
    blockerId: PlayerID;
    character: CardCharacter;
  };
  
  // For tracking who needs to take an action
  pendingResponseFrom?: PlayerID;
  
  // For exchange action
  exchangeCards?: Card[];
}

export interface GameLog {
  message: string;
  timestamp: number;
}

export interface Game {
  id: string;
  players: Player[];
  currentPlayerIndex: number;
  deck: Card[];
  gameState: GameState;
  currentAction?: GameAction;
  logs: GameLog[];
  createdAt: string | Date; // Store as ISO string in Firestore
  updatedAt: string | Date; // Store as ISO string in Firestore
  
  // For tracking who needs to respond to the current state
  pendingActionFrom?: PlayerID;
  
  // For tracking votes to restart game
  restartVotes?: PlayerID[];
}

// Character abilities
export interface CharacterAbility {
  character: CardCharacter;
  blockableActions: ActionType[];
  requiredForActions: ActionType[];
}

export const CHARACTER_ABILITIES: Record<CardCharacter, CharacterAbility> = {
  Duke: {
    character: 'Duke',
    blockableActions: ['foreign_aid'],
    requiredForActions: ['tax']
  },
  Assassin: {
    character: 'Assassin',
    blockableActions: [],
    requiredForActions: ['assassinate']
  },
  Captain: {
    character: 'Captain',
    blockableActions: ['steal'],
    requiredForActions: ['steal']
  },
  Ambassador: {
    character: 'Ambassador',
    blockableActions: ['steal'],
    requiredForActions: ['exchange']
  },
  Contessa: {
    character: 'Contessa',
    blockableActions: ['assassinate'],
    requiredForActions: []
  }
};

// Action costs and properties
export interface ActionProperty {
  type: ActionType;
  cost: number;
  targetRequired: boolean;
  blockable: boolean;
  challengeable: boolean;
  requiredCharacter?: CardCharacter;
  blockingCharacters: CardCharacter[];
}

export const ACTION_PROPERTIES: Record<ActionType, ActionProperty> = {
  income: {
    type: 'income',
    cost: 0,
    targetRequired: false,
    blockable: false,
    challengeable: false,
    blockingCharacters: []
  },
  foreign_aid: {
    type: 'foreign_aid',
    cost: 0,
    targetRequired: false,
    blockable: true,
    challengeable: false,
    blockingCharacters: ['Duke']
  },
  tax: {
    type: 'tax',
    cost: 0,
    targetRequired: false,
    blockable: false,
    challengeable: true,
    requiredCharacter: 'Duke',
    blockingCharacters: []
  },
  coup: {
    type: 'coup',
    cost: 7,
    targetRequired: true,
    blockable: false,
    challengeable: false,
    blockingCharacters: []
  },
  steal: {
    type: 'steal',
    cost: 0,
    targetRequired: true,
    blockable: true,
    challengeable: true,
    requiredCharacter: 'Captain',
    blockingCharacters: ['Captain', 'Ambassador']
  },
  assassinate: {
    type: 'assassinate',
    cost: 3,
    targetRequired: true,
    blockable: true,
    challengeable: true,
    requiredCharacter: 'Assassin',
    blockingCharacters: ['Contessa']
  },
  exchange: {
    type: 'exchange',
    cost: 0,
    targetRequired: false,
    blockable: false,
    challengeable: true,
    requiredCharacter: 'Ambassador',
    blockingCharacters: []
  }
};

// Game constants
export const GAME_CONSTANTS = {
  MAX_PLAYERS: 6,
  MIN_PLAYERS: 3,
  STARTING_COINS: 2,
  CARDS_PER_PLAYER: 2,
  CHARACTERS_PER_TYPE: 3,
  MAX_COINS_BEFORE_COUP: 10,
  RESPONSE_TIME_LIMIT: 15000, // 15 seconds in milliseconds
};