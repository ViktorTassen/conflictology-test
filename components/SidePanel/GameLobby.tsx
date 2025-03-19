import React from 'react';
import { useGameStore } from '@/store/gameStore';
import { Game } from '@/domain/types/game';

interface GameLobbyProps {
  game: Game;
  playerId: string;
  onLeaveGame: () => void;
}

export const GameLobby: React.FC<GameLobbyProps> = ({ game, playerId, onLeaveGame }) => {
  const { leaveGame, startGame, error } = useGameStore();

  const handleLeaveGame = async () => {
    try {
      await leaveGame();
      onLeaveGame();
    } catch (err) {
      console.error('Failed to leave game:', err);
    }
  };

  const handleStartGame = async () => {
    try {
      await startGame(game.id);
    } catch (err) {
      console.error('Failed to start game:', err);
    }
  };

  const handleCopyGameId = () => {
    navigator.clipboard.writeText(game.id);
    alert('Game ID copied to clipboard!');
  };

  const isHost = game.players[0].id === playerId;
  const canStartGame = game.players.length >= 3 && game.players.length <= 6;

  return (
    <div className="game-lobby">
      <h2>Game Lobby</h2>
      
      <div className="game-info">
        <div className="game-id-section">
          <h3>Game ID</h3>
          <div className="game-id-container">
            <code className="game-id">{game.id}</code>
            <button onClick={handleCopyGameId} className="copy-button">
              Copy
            </button>
          </div>
          <p className="share-instruction">
            Share this Game ID with your friends so they can join!
          </p>
        </div>

        <div className="game-status">
          <p>Players: {game.players.length}/6</p>
          <p>Status: Waiting for players ({game.players.length < 3 ? `need ${3 - game.players.length} more` : 'ready to start'})</p>
        </div>
      </div>

      <div className="players-list">
        <h3>Players</h3>
        {game.players.map(player => (
          <div 
            key={player.id} 
            className={`player-item ${player.id === playerId ? 'current-player' : ''}`}
          >
            <span className="player-name">
              {player.name}
              {player.id === game.players[0].id && ' (Host)'}
              {player.id === playerId && ' (You)'}
            </span>
          </div>
        ))}
      </div>

      <div className="game-actions">
        {isHost && (
          <button 
            onClick={handleStartGame}
            disabled={!canStartGame}
            className="start-game-button"
          >
            Start Game {!canStartGame && `(Need ${Math.max(3 - game.players.length, 0)} more players)`}
          </button>
        )}
        
        <button onClick={handleLeaveGame} className="leave-game-button">
          Leave Game
        </button>
      </div>

      {error && <div className="error">{error}</div>}
    </div>
  );
};