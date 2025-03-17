import React, { useState, useEffect } from 'react';
import { CreateGame } from './CreateGame';
import { JoinGame } from './JoinGame';
import { GameLobby } from './GameLobby';
import { useGameStore } from '@/store/gameStore';

export const SidePanel: React.FC = () => {
  const { currentGame, subscribeToGame } = useGameStore();
  const [view, setView] = useState<'create' | 'join' | 'lobby'>('create');
  const [gameId, setGameId] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  
  // Subscribe to game updates when gameId changes
  useEffect(() => {
    if (gameId) {
      const unsubscribe = subscribeToGame(gameId);
      return () => unsubscribe();
    }
  }, [gameId, subscribeToGame]);
  
  // Redirect to the game page when game state changes to 'play'
  useEffect(() => {
    if (currentGame && currentGame.gameState === 'play' && gameId && playerId) {
      console.log('Game started! Redirecting to game page...');
      // Redirect to the game page with gameId and playerId as URL parameters
      window.location.href = `/game.html?gameId=${gameId}&playerId=${playerId}`;
    }
  }, [currentGame, gameId, playerId]);

  const handleGameCreated = (newGameId: string, newPlayerId: string) => {
    setGameId(newGameId);
    setPlayerId(newPlayerId);
    setView('lobby');
  };

  const handleGameJoined = (newGameId: string, newPlayerId: string) => {
    setGameId(newGameId);
    setPlayerId(newPlayerId);
    setView('lobby');
  };

  const handleLeaveGame = () => {
    setGameId(null);
    setPlayerId(null);
    setView('create');
  };

  return (
    <div className="side-panel">
      <div className="panel-header">
        <h1>Coup Card Game</h1>
        {!currentGame && (
          <div className="view-toggle">
            <button
              className={view === 'create' ? 'active' : ''}
              onClick={() => setView('create')}
            >
              Create Game
            </button>
            <button
              className={view === 'join' ? 'active' : ''}
              onClick={() => setView('join')}
            >
              Join Game
            </button>
          </div>
        )}
      </div>

      <div className="panel-content">
        {view === 'create' && (
          <CreateGame onGameCreated={handleGameCreated} />
        )}
        
        {view === 'join' && (
          <JoinGame onGameJoined={handleGameJoined} />
        )}
        
        {view === 'lobby' && currentGame && gameId && playerId && (
          <GameLobby
            game={currentGame}
            playerId={playerId}
            onLeaveGame={handleLeaveGame}
          />
        )}
      </div>
    </div>
  );
};