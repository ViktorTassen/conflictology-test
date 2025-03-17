import React, { useState } from 'react';
import { useGameStore } from '@/store/gameStore';

interface CreateGameProps {
  onGameCreated: (gameId: string, playerId: string) => void;
}

export const CreateGame: React.FC<CreateGameProps> = ({ onGameCreated }) => {
  const { createGame, error } = useGameStore();
  const [playerName, setPlayerName] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!playerName.trim()) {
      alert('Please enter your name');
      return;
    }

    try {
      const game = await createGame([playerName]);
      console.log('Game created:', game);
      if (game && game.players && game.players.length > 0) {
        const playerId = game.players[0].id;
        console.log('Game ID:', game.id, 'Player ID:', playerId);
        onGameCreated(game.id, playerId);
      } else {
        console.error('Game created but missing expected data:', game);
      }
    } catch (err) {
      console.error('Failed to create game:', err);
    }
  };

  return (
    <div className="create-game">
      <h2>Create New Game</h2>
      
      <form onSubmit={handleSubmit} className="create-game-form">
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

        <button type="submit" className="create-game-button">
          Create Game
        </button>
      </form>

      {error && <div className="error">{error}</div>}
    </div>
  );
};