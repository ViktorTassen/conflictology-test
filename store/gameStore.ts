import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { Game, GameAction, PlayerID, CardCharacter } from '@/domain/types/game';
import { gameService } from '@/utils/gameService';

interface GameState {
  currentGame: Game | null;
  loading: boolean;
  error: string | null;
  // Actions
  createGame: (players: string[]) => Promise<Game | null>;
  startGame: (gameId: string) => Promise<void>;
  joinGame: (gameId: string, playerName: string) => Promise<string>;
  leaveGame: (gameId: string, playerId: PlayerID) => Promise<void>;
  performAction: (gameId: string, action: GameAction) => Promise<void>;
  challengeAction: (gameId: string, challengerId: PlayerID) => Promise<void>;
  blockAction: (gameId: string, blockerId: PlayerID, character: CardCharacter) => Promise<void>;
  revealCard: (gameId: string, playerId: PlayerID, cardIndex: number) => Promise<void>;
  subscribeToGame: (gameId: string) => () => void;
  setError: (error: string | null) => void;
}

export const useGameStore = create<GameState>()(
  immer((set, get) => ({
    currentGame: null,
    loading: false,
    error: null,

    createGame: async (players) => {
      set({ loading: true, error: null });
      try {
        const game = await gameService.createGame(players);
        set({ currentGame: game });
        return game;
      } catch (error) {
        set({ error: (error as Error).message });
        return null;
      } finally {
        set({ loading: false });
      }
    },

    startGame: async (gameId) => {
      set({ loading: true, error: null });
      try {
        await gameService.startGame(gameId);
      } catch (error) {
        set({ error: (error as Error).message });
      } finally {
        set({ loading: false });
      }
    },

    joinGame: async (gameId, playerName) => {
      set({ loading: true, error: null });
      try {
        const playerId = await gameService.joinGame(gameId, playerName);
        return playerId;
      } catch (error) {
        set({ error: (error as Error).message });
        return '';
      } finally {
        set({ loading: false });
      }
    },

    leaveGame: async (gameId, playerId) => {
      set({ loading: true, error: null });
      try {
        await gameService.leaveGame(gameId, playerId);
      } catch (error) {
        set({ error: (error as Error).message });
      } finally {
        set({ loading: false });
      }
    },

    performAction: async (gameId, action) => {
      set({ loading: true, error: null });
      try {
        await gameService.performAction(gameId, action);
      } catch (error) {
        set({ error: (error as Error).message });
      } finally {
        set({ loading: false });
      }
    },

    challengeAction: async (gameId, challengerId) => {
      set({ loading: true, error: null });
      try {
        await gameService.challengeAction(gameId, challengerId);
      } catch (error) {
        set({ error: (error as Error).message });
      } finally {
        set({ loading: false });
      }
    },

    blockAction: async (gameId, blockerId, character) => {
      set({ loading: true, error: null });
      try {
        await gameService.blockAction(gameId, blockerId, character);
      } catch (error) {
        set({ error: (error as Error).message });
      } finally {
        set({ loading: false });
      }
    },

    revealCard: async (gameId, playerId, cardIndex) => {
      set({ loading: true, error: null });
      try {
        await gameService.revealCard(gameId, playerId, cardIndex);
      } catch (error) {
        set({ error: (error as Error).message });
      } finally {
        set({ loading: false });
      }
    },

    subscribeToGame: (gameId) => {
      return gameService.subscribeToGame(gameId, (game) => {
        set({ currentGame: game });
      });
    },

    setError: (error) => set({ error }),
  }))
);