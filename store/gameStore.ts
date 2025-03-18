import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { 
  Game, 
  PlayerID, 
  CardCharacter, 
  ActionType,
  ResponseType,
  ActionRequest
} from '@/domain/types/game';
import { gameService } from '@/utils/gameService';

interface GameState {
  currentGame: Game | null;
  playerId: PlayerID | null;
  playerName: string | null;
  gameId: string | null;
  loading: boolean;
  error: string | null;
  
  // Game lifecycle
  createGame: (hostPlayerName: string) => Promise<Game | null>;
  startGame: (gameId: string) => Promise<void>;
  joinGame: (gameId: string, playerName: string) => Promise<string>;
  leaveGame: () => Promise<void>;
  
  // Game actions
  performAction: (actionType: ActionType, targetId?: PlayerID) => Promise<void>;
  respondToAction: (responseType: ResponseType, character?: CardCharacter) => Promise<void>;
  revealCard: (cardIndex: number) => Promise<void>;
  loseInfluence: (cardIndex: number) => Promise<void>;
  selectExchangeCards: (keptCardIndices: number[]) => Promise<void>;
  
  // Game state
  subscribeToGame: (gameId: string) => () => void;
  setGameInfo: (gameId: string, playerId: PlayerID, playerName: string) => void;
  setError: (error: string | null) => void;
  resetGameState: () => void;
  
  // Game queries
  getValidActions: () => ActionType[];
  getValidResponses: () => ResponseType[];
  getValidBlockingCharacters: () => CardCharacter[];
  isPlayerTurn: () => boolean;
  isWaitingForPlayer: () => boolean;
  isCurrentAction: (actionType: ActionType) => boolean;
  
  // Game end and restart
  voteForRestart: () => Promise<void>;
  cancelRestartVote: () => Promise<void>;
  hasVotedToRestart: () => boolean;
  getRestartVoteCount: () => number;
  getTotalPlayerCount: () => number;
}

export const useGameStore = create<GameState>()(
  immer((set, get) => ({
    currentGame: null,
    playerId: null,
    playerName: null,
    gameId: null,
    loading: false,
    error: null,

    // Game lifecycle
    createGame: async (hostPlayerName) => {
      set({ loading: true, error: null });
      try {
        const game = await gameService.createGame(hostPlayerName);
        
        // Store player info
        if (game && game.players.length > 0) {
          const playerId = game.players[0].id;
          set({ 
            currentGame: game,
            gameId: game.id,
            playerId,
            playerName: hostPlayerName
          });
        }
        
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
        
        // Store player info
        set({ 
          gameId,
          playerId,
          playerName
        });
        
        return playerId;
      } catch (error) {
        set({ error: (error as Error).message });
        return '';
      } finally {
        set({ loading: false });
      }
    },

    leaveGame: async () => {
      const { gameId, playerId } = get();
      
      if (!gameId || !playerId) {
        set({ error: 'No active game or player' });
        return;
      }
      
      set({ loading: true, error: null });
      try {
        await gameService.leaveGame(gameId, playerId);
        set({ 
          gameId: null,
          playerId: null,
          playerName: null
        });
      } catch (error) {
        set({ error: (error as Error).message });
      } finally {
        set({ loading: false });
      }
    },

    // Game actions
    performAction: async (actionType, targetId) => {
      const { gameId, playerId, currentGame } = get();
      
      if (!gameId || !playerId || !currentGame) {
        set({ error: 'No active game or player' });
        return;
      }
      
      set({ loading: true, error: null });
      try {
        const action: ActionRequest = {
          type: actionType,
          playerId,
          target: targetId
        };
        
        await gameService.performAction(gameId, action);
      } catch (error) {
        set({ error: (error as Error).message });
      } finally {
        set({ loading: false });
      }
    },

    respondToAction: async (responseType, character) => {
      const { gameId, playerId } = get();
      
      if (!gameId || !playerId) {
        const errorMsg = `Cannot respond to action: ${!gameId ? 'gameId' : 'playerId'} is not defined`;
        console.error(errorMsg, { gameId, playerId, responseType });
        set({ error: errorMsg });
        return;
      }
      
      set({ loading: true, error: null });
      try {
        console.log(`Responding to action with ${responseType}`, { gameId, playerId, character });
        await gameService.respondToAction(gameId, playerId, responseType, character);
      } catch (error) {
        const errorMsg = (error as Error).message;
        console.error(`Error responding to action: ${errorMsg}`, { gameId, playerId, responseType });
        set({ error: errorMsg });
      } finally {
        set({ loading: false });
      }
    },

    revealCard: async (cardIndex) => {
      const { gameId, playerId } = get();
      
      if (!gameId || !playerId) {
        set({ error: 'No active game or player' });
        return;
      }
      
      set({ loading: true, error: null });
      try {
        await gameService.revealCard(gameId, playerId, cardIndex);
      } catch (error) {
        set({ error: (error as Error).message });
      } finally {
        set({ loading: false });
      }
    },
    
    loseInfluence: async (cardIndex) => {
      const { gameId, playerId } = get();
      
      if (!gameId || !playerId) {
        set({ error: 'No active game or player' });
        return;
      }
      
      set({ loading: true, error: null });
      try {
        await gameService.loseInfluence(gameId, playerId, cardIndex);
      } catch (error) {
        set({ error: (error as Error).message });
      } finally {
        set({ loading: false });
      }
    },
    
    selectExchangeCards: async (keptCardIndices) => {
      const { gameId, playerId } = get();
      
      if (!gameId || !playerId) {
        set({ error: 'No active game or player' });
        return;
      }
      
      set({ loading: true, error: null });
      try {
        await gameService.selectExchangeCards(gameId, playerId, keptCardIndices);
      } catch (error) {
        set({ error: (error as Error).message });
      } finally {
        set({ loading: false });
      }
    },

    // Game state
    subscribeToGame: (gameId) => {
      return gameService.subscribeToGame(gameId, (game) => {
        set({ currentGame: game });
      });
    },
    
    setGameInfo: (gameId, playerId, playerName) => {
      set({ 
        gameId,
        playerId,
        playerName
      });
    },

    setError: (error) => set({ error }),
    
    resetGameState: () => {
      set({
        currentGame: null,
        playerId: null,
        playerName: null,
        gameId: null,
        error: null
      });
    },
    
    // Game queries
    getValidActions: () => {
      const { currentGame, playerId } = get();
      
      if (!currentGame || !playerId) {
        return [];
      }
      
      return gameService.getValidActions(currentGame, playerId);
    },
    
    getValidResponses: () => {
      const { currentGame, playerId } = get();
      
      if (!currentGame || !playerId) {
        return [];
      }
      
      return gameService.getValidResponses(currentGame, playerId);
    },
    
    getValidBlockingCharacters: () => {
      const { currentGame } = get();
      
      if (!currentGame || !currentGame.currentAction) {
        return [];
      }
      
      const actionType = currentGame.currentAction.action.type;
      return gameService.getBlockingCharacters(actionType);
    },
    
    isPlayerTurn: () => {
      const { currentGame, playerId } = get();
      
      if (!currentGame || !playerId) {
        return false;
      }
      
      return currentGame.gameState === 'play' && 
             currentGame.players[currentGame.currentPlayerIndex].id === playerId;
    },
    
    isWaitingForPlayer: () => {
      const { currentGame, playerId } = get();
      
      if (!currentGame || !playerId) {
        return false;
      }
      
      return currentGame.pendingActionFrom === playerId;
    },
    
    isCurrentAction: (actionType) => {
      const { currentGame } = get();
      
      if (!currentGame || !currentGame.currentAction) {
        return false;
      }
      
      return currentGame.currentAction.action.type === actionType;
    },
    
    // Game end and restart methods
    voteForRestart: async () => {
      const { gameId, playerId } = get();
      
      if (!gameId || !playerId) {
        set({ error: 'No active game or player' });
        return;
      }
      
      set({ loading: true, error: null });
      try {
        await gameService.voteForRestart(gameId, playerId);
      } catch (error) {
        set({ error: (error as Error).message });
      } finally {
        set({ loading: false });
      }
    },
    
    cancelRestartVote: async () => {
      const { gameId, playerId } = get();
      
      if (!gameId || !playerId) {
        set({ error: 'No active game or player' });
        return;
      }
      
      set({ loading: true, error: null });
      try {
        await gameService.cancelRestartVote(gameId, playerId);
      } catch (error) {
        set({ error: (error as Error).message });
      } finally {
        set({ loading: false });
      }
    },
    
    hasVotedToRestart: () => {
      const { currentGame, playerId } = get();
      
      if (!currentGame || !playerId || !currentGame.restartVotes) {
        return false;
      }
      
      return currentGame.restartVotes.includes(playerId);
    },
    
    getRestartVoteCount: () => {
      const { currentGame } = get();
      
      if (!currentGame || !currentGame.restartVotes) {
        return 0;
      }
      
      return currentGame.restartVotes.length;
    },
    
    getTotalPlayerCount: () => {
      const { currentGame } = get();
      
      if (!currentGame) {
        return 0;
      }
      
      return currentGame.players.length;
    }
  }))
);