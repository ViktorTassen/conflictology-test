import { Game, Player, CardCharacter, GameAction } from '../types/game';

export class GameRules {
  static readonly INITIAL_COINS = 2;
  static readonly COUP_COST = 7;
  static readonly ASSASSINATE_COST = 3;
  static readonly MAX_COINS = 10;

  static canPerformAction(game: Game, action: GameAction): boolean {
    const player = game.players.find(p => p.id === action.playerId);
    if (!player || player.eliminated) return false;

    switch (action.type) {
      case 'income':
        return player.coins < this.MAX_COINS;
      
      case 'foreign_aid':
        return player.coins < this.MAX_COINS;
      
      case 'coup':
        return player.coins >= this.COUP_COST;
      
      case 'tax':
        return player.coins < this.MAX_COINS;
      
      case 'assassinate':
        return player.coins >= this.ASSASSINATE_COST;
      
      case 'steal':
        return true;
      
      case 'exchange':
        return true;
        
      case 'pass':
        return game.gameState === 'action' && game.currentAction !== undefined;
      
      case 'accept_block':
        return game.gameState === 'block' && game.currentAction !== undefined &&
               game.currentAction.playerId === player.id;
               
      case 'challenge_block':
        return game.gameState === 'block' && game.currentAction !== undefined &&
               game.currentAction.playerId === player.id;
      
      default:
        return false;
    }
  }

  static canBlock(action: GameAction, character: CardCharacter): boolean {
    switch (action.type) {
      case 'foreign_aid':
        return character === 'Duke';
      
      case 'assassinate':
        return character === 'Contessa';
      
      case 'steal':
        return character === 'Captain' || character === 'Ambassador';
      
      default:
        return false;
    }
  }

  static canChallenge(action: GameAction): boolean {
    return ['tax', 'assassinate', 'steal', 'exchange'].includes(action.type);
  }

  static getRequiredCharacter(action: GameAction): CardCharacter | null {
    switch (action.type) {
      case 'tax':
        return 'Duke';
      case 'assassinate':
        return 'Assassin';
      case 'steal':
        return 'Captain';
      case 'exchange':
        return 'Ambassador';
      default:
        return null;
    }
  }

  static getBlockingCharacters(action: GameAction): CardCharacter[] {
    switch (action.type) {
      case 'foreign_aid':
        return ['Duke'];
      case 'assassinate':
        return ['Contessa'];
      case 'steal':
        return ['Captain', 'Ambassador'];
      default:
        return [];
    }
  }

  static isGameOver(game: Game): boolean {
    const activePlayers = game.players.filter(p => !p.eliminated);
    return activePlayers.length === 1;
  }
}