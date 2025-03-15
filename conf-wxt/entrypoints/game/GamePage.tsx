import { useEffect, useState } from 'react';
import { db } from '@/utils/firebase';
import { subscribeToGame, GameState } from '@/utils/gameService';
import './style.css';

// Get URL query parameters
const getUrlParams = () => {
  const searchParams = new URLSearchParams(window.location.search);
  const gameId = searchParams.get('gameId');
  const playerIdStr = searchParams.get('playerId');
  const playerId = playerIdStr ? parseInt(playerIdStr) : null;

  return { gameId, playerId };
};

export function GamePage() {
  const { gameId, playerId } = getUrlParams();
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Subscribe to game updates
  useEffect(() => {
    if (!gameId) {
      setError('No game ID provided');
      setLoading(false);
      return;
    }

    if (playerId === null) {
      setError('No player ID provided');
      setLoading(false);
      return;
    }

    const unsubscribe = subscribeToGame(gameId, (game) => {
      setGameState(game);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [gameId, playerId]);

  if (loading) {
    return (
      <div id="header">
        <h1>Loading Game...</h1>
        <div id="game-state">Please wait while we connect to Firebase</div>
      </div>
    );
  }

  if (error) {
    return (
      <div id="header">
        <h1>Error</h1>
        <div id="game-state" className="error">{error}</div>
      </div>
    );
  }

  if (!gameState) {
    return (
      <div id="header">
        <h1>Game Not Found</h1>
        <div id="game-state">The game with ID {gameId} doesn't exist</div>
      </div>
    );
  }

  // For now, we're embedding the original game HTML
  // In a full implementation, we would reimplement the game UI with React
  // and connect it to Firebase

  return (
    <>
      <div id="header">
        <h1>Coup</h1>
        <div id="game-state">
          {gameState.gameState === 'setup' && 'Game Setup'}
          {gameState.gameState === 'play' && `${gameState.players[gameState.currentPlayerIndex]?.name}'s turn`}
          {gameState.gameState === 'gameover' && 'Game Over'}
        </div>
      </div>
      
      <div id="court-deck">
        <h2>Court Deck</h2>
        <div id="deck-count">Cards remaining: {gameState.deck.length}</div>
      </div>
      
      <div id="treasury">
        <h2>Treasury</h2>
        <div id="treasury-count">Coins: {gameState.treasury}</div>
      </div>
      
      <div id="current-player-info">
        <h2>Current Player: <span id="current-player-name">{gameState.players[gameState.currentPlayerIndex]?.name}</span></h2>
        <div>Your Player: {gameState.players.find(p => p.id === playerId)?.name}</div>
      </div>

      <div id="actions-panel">
        <h2>Actions</h2>
        <div id="action-message">
          {gameState.currentPlayerIndex === playerId 
            ? "It's your turn! Action buttons will be available soon." 
            : `Waiting for ${gameState.players[gameState.currentPlayerIndex]?.name} to take an action...`}
        </div>
      </div>

      <div id="players-container">
        {gameState.players.map(player => (
          <div 
            key={player.id} 
            className={`player-area ${player.id === playerId ? 'current' : ''} ${player.eliminated ? 'eliminated' : ''}`}
            data-player-id={player.id}
          >
            <div className="player-name">{player.name} {player.id === playerId && '(You)'}</div>
            <div className="player-coins">Coins: {player.coins}</div>
            <div className="player-cards">
              {player.cards.map((card, idx) => (
                <div 
                  key={idx} 
                  className={`card ${card.character.toLowerCase()} ${card.eliminated ? 'eliminated' : ''} ${player.id === playerId ? 'revealed' : ''}`}
                  data-card-index={idx}
                >
                  <div className="card-name">
                    {(player.id === playerId || card.eliminated) ? card.character : "Hidden"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div id="game-log">
        <h3>Game Log</h3>
        <div id="log-entries">
          {gameState.log.map((entry, idx) => (
            <div key={idx} className="log-entry">{entry}</div>
          ))}
        </div>
      </div>
    </>
  );
}