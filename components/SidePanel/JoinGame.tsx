import React, { useState } from 'react';
import { useGameStore } from '@/store/gameStore';

interface JoinGameProps {
  onGameJoined: (gameId: string, playerId: string) => void;
}

export const JoinGame: React.FC<JoinGameProps> = ({ onGameJoined }) => {
  const { joinGame, error } = useGameStore();
  const [gameId, setGameId] = useState('');
  const [playerName, setPlayerName] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!playerName.trim()) {
      alert('Please enter your name');
      return;
    }
    
    try {
      const playerId = await joinGame(gameId, playerName);
      if (playerId) {
        onGameJoined(gameId, playerId);
      }
    } catch (err) {
      console.error('Failed to join game:', err);
    }
  };

  return (
    <div className="join-game">
      <h2>Join Game</h2>
      
      <form onSubmit={handleSubmit} className="join-game-form">
        <div className="form-group">
          <label htmlFor="gameId">Game ID</label>
          <input
            id="gameId"
            type="text"
            value={gameId}
            onChange={(e) => setGameId(e.target.value)}
            placeholder="Enter game ID"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="playerName">Your Name</label>
          <input
            id="playerName"
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="Enter your name"
            required
          />
        </div>

        <button type="submit" className="join-game-button">
          Join Game
        </button>
      </form>

      {error && <div className="error">{error}</div>}
    </div>
  );
};