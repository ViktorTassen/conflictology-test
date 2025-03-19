export interface Influence {
  card: string;
}

export interface Player {
  id: number;
  name: string;
  coins: number;
  color: string;
  avatar: string;
  influence: Influence[];
}

export type LogType = 
  | 'income'
  | 'foreign-aid'
  | 'coup'
  | 'tax'
  | 'assassinate'
  | 'steal'
  | 'exchange'
  | 'block'
  | 'challenge'
  | 'challenge-success'
  | 'challenge-fail'
  | 'lose-influence'
  | 'allow'
  | 'exchange-complete';

export interface GameLogEntry {
  type: LogType;
  player: string;
  playerColor: string;
  target?: string;
  targetColor?: string;
  card?: string;
  targetCard?: string;
  coins?: number;
}

export type View = 'lobby' | 'game';

// Actions that require targeting another player
export type TargetableAction = 'steal' | 'assassinate' | 'coup';

export interface GameAction {
  icon: any;
  name: string;
  description: string;
  type: 'income' | 'foreign-aid' | TargetableAction | 'duke' | 'ambassador';
  cost?: number;
}

export type GameState = 
  | 'waiting_for_action'
  | 'waiting_for_target'
  | 'waiting_for_response'
  | 'waiting_for_exchange';