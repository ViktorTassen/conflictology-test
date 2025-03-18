import { collection, doc, getDoc, setDoc, updateDoc, onSnapshot, arrayUnion } from 'firebase/firestore';
import { db } from '@/utils/firebase';
import { IGameRepository } from '@/domain/interfaces/IGameRepository';
import { 
  Game, 
  Player, 
  PlayerID, 
  Card, 
  CardCharacter, 
  GAME_CONSTANTS,
  GameLog
} from '@/domain/types/game';
import { nanoid } from 'nanoid';

export class FirebaseGameRepository implements IGameRepository {
  private gamesCollection = collection(db, 'games');

  async createGame(playerNames: string[]): Promise<Game> {
    const gameId = nanoid();
    const hostPlayer: Player = {
      id: nanoid(),
      name: playerNames[0],
      coins: 0, // Will be set when game starts
      cards: [],
      eliminated: false
    };

    const now = new Date();
    const initialLog: GameLog = {
      message: 'Game lobby created',
      timestamp: now.getTime()
    };
    
    const game: Game = {
      id: gameId,
      players: [hostPlayer],
      currentPlayerIndex: 0,
      deck: [],
      gameState: 'setup',
      logs: [initialLog],
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    };

    await setDoc(doc(this.gamesCollection, gameId), game);
    return game;
  }

  async addPlayer(gameId: string, playerName: string): Promise<string> {
    const gameDoc = doc(this.gamesCollection, gameId);
    const game = await this.getGame(gameId);
    if (!game) throw new Error('Game not found');

    // Check if a player with the same name already exists to prevent duplicates
    const existingPlayer = game.players.find(p => p.name === playerName);
    if (existingPlayer) {
      console.log(`Player ${playerName} already exists, returning existing ID`);
      return existingPlayer.id;
    }

    const playerId = nanoid();
    const newPlayer: Player = {
      id: playerId,
      name: playerName,
      coins: 0, // Will be set when game starts
      cards: [],
      eliminated: false
    };

    const newLog: GameLog = {
      message: `${playerName} joined the game`,
      timestamp: Date.now()
    };

    // Add the player to the game
    game.players.push(newPlayer);
    game.logs.push(newLog);
    game.updatedAt = new Date().toISOString();
    
    await this.updateGame(game);
    return playerId;
  }

  async getGame(gameId: string): Promise<Game | null> {
    const gameDoc = await getDoc(doc(this.gamesCollection, gameId));
    if (!gameDoc.exists()) return null;
    
    const data = gameDoc.data() as Game;
    return data;
  }

  async updateGame(game: Game): Promise<void> {
    // Create a deep copy of the game object to avoid modifying the original
    const gameToUpdate = JSON.parse(JSON.stringify(game));
    
    // Ensure dates are properly formatted for Firestore
    gameToUpdate.updatedAt = new Date().toISOString();
    
    // Convert dates to ISO strings if they are Date objects
    if (typeof gameToUpdate.createdAt === 'object' && gameToUpdate.createdAt instanceof Date) {
      gameToUpdate.createdAt = gameToUpdate.createdAt.toISOString();
    }
    
    await updateDoc(doc(this.gamesCollection, game.id), gameToUpdate);
  }

  subscribeToGame(gameId: string, callback: (game: Game) => void): () => void {
    return onSnapshot(doc(this.gamesCollection, gameId), (snapshot) => {
      if (!snapshot.exists()) return;
      
      const data = snapshot.data() as Game;
      callback(data);
    });
  }

  async joinGame(gameId: string, playerId: PlayerID): Promise<void> {
    const game = await this.getGame(gameId);
    if (!game) throw new Error('Game not found');
    
    const playerIndex = game.players.findIndex(p => p.id === playerId);
    if (playerIndex === -1) throw new Error('Player not found in game');
    
    // In this implementation, there's no special "join" action needed
    // as players are already added to the game via addPlayer
  }

  async leaveGame(gameId: string, playerId: PlayerID): Promise<void> {
    const game = await this.getGame(gameId);
    if (!game) throw new Error('Game not found');
    
    if (game.gameState === 'setup') {
      // During setup, remove the player entirely
      const playerIndex = game.players.findIndex(p => p.id === playerId);
      if (playerIndex === -1) throw new Error('Player not found in game');
      
      const playerName = game.players[playerIndex].name;
      game.players.splice(playerIndex, 1);
      
      // Add log
      game.logs.push({
        message: `${playerName} left the game`,
        timestamp: Date.now()
      });
      
      await this.updateGame(game);
    } else {
      // During gameplay, the GameService handles player elimination
      throw new Error('Use GameService.leaveGame during active gameplay');
    }
  }
}