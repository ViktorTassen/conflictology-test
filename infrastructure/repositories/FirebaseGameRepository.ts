import { collection, doc, getDoc, setDoc, updateDoc, onSnapshot, arrayUnion } from 'firebase/firestore';
import { db } from '@/utils/firebase';
import { IGameRepository } from '@/domain/interfaces/IGameRepository';
import { Game, Player, PlayerID, Card, CardCharacter } from '@/domain/types/game';
import { nanoid } from 'nanoid';

export class FirebaseGameRepository implements IGameRepository {
  private gamesCollection = collection(db, 'games');

  private createInitialDeck(): Card[] {
    const characters: CardCharacter[] = ['Duke', 'Assassin', 'Captain', 'Ambassador', 'Contessa'];
    const deck: Card[] = [];
    
    // Create 3 of each character card
    characters.forEach(character => {
      for (let i = 0; i < 3; i++) {
        deck.push({ character, eliminated: false });
      }
    });

    // Shuffle the deck
    return deck.sort(() => Math.random() - 0.5);
  }

  async createGame(playerNames: string[]): Promise<Game> {
    const gameId = nanoid();
    const hostPlayer: Player = {
      id: nanoid(),
      name: playerNames[0],
      coins: 2,
      cards: [],
      eliminated: false
    };

    const now = new Date();
    const game: Game = {
      id: gameId,
      players: [hostPlayer],
      currentPlayerIndex: 0,
      deck: this.createInitialDeck(),
      treasury: 50,
      gameState: 'setup',
      log: ['Game lobby created'],
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

    const playerId = nanoid();
    const newPlayer: Player = {
      id: playerId,
      name: playerName,
      coins: 2,
      cards: [],
      eliminated: false
    };

    await updateDoc(gameDoc, {
      players: arrayUnion(newPlayer),
      log: arrayUnion(`${playerName} joined the game`),
      updatedAt: new Date().toISOString()
    });

    return playerId;
  }

  async getGame(gameId: string): Promise<Game | null> {
    const gameDoc = await getDoc(doc(this.gamesCollection, gameId));
    if (!gameDoc.exists()) return null;
    
    const data = gameDoc.data() as Game;
    // Dates are already stored as ISO strings, no need to convert
    return data;
  }

  async updateGame(game: Game): Promise<void> {
    // Create a deep copy of the game object to avoid modifying the original
    const gameToUpdate = JSON.parse(JSON.stringify(game));
    
    // Ensure dates are properly formatted for Firestore
    gameToUpdate.updatedAt = new Date();
    
    // Convert dates to Firestore timestamp or ISO string format
    if (typeof gameToUpdate.createdAt === 'object' && gameToUpdate.createdAt instanceof Date) {
      gameToUpdate.createdAt = gameToUpdate.createdAt.toISOString();
    }
    gameToUpdate.updatedAt = gameToUpdate.updatedAt.toISOString();
    
    await updateDoc(doc(this.gamesCollection, game.id), gameToUpdate);
  }

  subscribeToGame(gameId: string, callback: (game: Game) => void): () => void {
    return onSnapshot(doc(this.gamesCollection, gameId), (snapshot) => {
      if (!snapshot.exists()) return;
      
      const data = snapshot.data() as Game;
      // Dates are already stored as ISO strings, no need to convert
      callback(data);
    });
  }

  async joinGame(gameId: string, playerId: PlayerID): Promise<void> {
    const game = await this.getGame(gameId);
    if (!game) throw new Error('Game not found');
    
    const playerIndex = game.players.findIndex(p => p.id === playerId);
    if (playerIndex === -1) throw new Error('Player not found in game');
    
    // Update player status or other join-related logic here
    await this.updateGame(game);
  }

  async leaveGame(gameId: string, playerId: PlayerID): Promise<void> {
    const game = await this.getGame(gameId);
    if (!game) throw new Error('Game not found');
    
    const playerIndex = game.players.findIndex(p => p.id === playerId);
    if (playerIndex === -1) throw new Error('Player not found in game');
    
    // Mark player as eliminated
    game.players[playerIndex].eliminated = true;
    game.log.push(`${game.players[playerIndex].name} left the game`);
    
    await this.updateGame(game);
  }
}