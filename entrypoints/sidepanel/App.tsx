import { useState, useEffect } from 'react';
import './style.css';
import { 
  createGame, 
  joinGame, 
  startGame, 
  subscribeToGame, 
  performIncome,
  performForeignAid,
  performTax,
  performAssassinate,
  performSteal,
  performExchange,
  performCoup,
  performChallenge,
  performBlock,
  performChallengeBlock,
  performLoseInfluence,
  performExchangeCards,
  allowActionToProceed,
  terminateGame,
  voteForNewGame,
  GameState 
} from '@/utils/gameService';

// For debugging - make sure console logs show up
console.log("Game service functions imported:", { 
  performIncome, performForeignAid, performTax, 
  performAssassinate, performSteal, performExchange, performCoup,
  performChallenge, performBlock, performChallengeBlock,
  performLoseInfluence, performExchangeCards, allowActionToProceed
});

// Helper function to get a character icon
const getCharacterIcon = (character: string): string => {
  switch (character) {
    case 'Duke':      return '👑'; // Crown for tax power
    case 'Assassin':  return '🗡️'; // Dagger for assassination
    case 'Captain':   return '⚓'; // Anchor for stealing
    case 'Ambassador':return '🔄'; // Exchange symbol for card swapping
    case 'Contessa':  return '🛡️'; // Shield for blocking assassination
    default:          return '❓'; // Default fallback
  }
};

function App() {
  const [view, setView] = useState<
    'home' | 'create' | 'join' | 'lobby' | 'game' | 
    'target-selection-coup' | 'target-selection-assassinate' | 'target-selection-steal' |
    'challenge-action' | 'block-action' | 'exchange-cards' | 'lose-influence'
  >('home');
  const [playerName, setPlayerName] = useState('');
  const [gameId, setGameId] = useState('');
  const [error, setError] = useState('');
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [playerId, setPlayerId] = useState<number | null>(null);
  const [selectedCards, setSelectedCards] = useState<number[]>([]);  // For card exchange
  const [processingAction, setProcessingAction] = useState(false);  // For action feedback
  
  // Helper function to check if player should go to lose influence screen
  // or be automatically eliminated
  const handleLoseInfluence = () => {
    if (!gameState || playerId === null) return;
    
    const player = gameState.players.find(p => p.id === playerId);
    if (!player) return;
    
    const aliveCards = player.cards.filter(card => !card.eliminated);
    
    if (aliveCards.length === 1) {
      // Player only has one card - automatic elimination
      console.log("Player only has one card - waiting for auto-elimination");
      // Don't change view - just wait for server update
      setTimeout(() => {
        setProcessingAction(false);
      }, 2000);
    } else {
      // Player has multiple cards - go to selection screen
      setView('lose-influence');
      setProcessingAction(false);
    }
  };
  
  // Always add this effect at the app level to ensure consistent hooks order
  useEffect(() => {
    // This effect only activates when the view is 'exchange-cards'
    if (view !== 'exchange-cards' || !gameState || !playerId) return;
    
    // Reset selected cards whenever entering the exchange view
    setSelectedCards([]);
    
    // Reset processing state when entering this view
    setProcessingAction(false);
    
    // Make validation checks
    if (!gameState.pendingAction || gameState.pendingAction.type !== 'exchange') {
      setView('game'); // Return to the game view if something is wrong
      return;
    }
    
    if (gameState.pendingAction.player?.id !== playerId) {
      setView('game'); // Return to the game view if this is not the right player
      return;
    }
    
    const player = gameState.players.find(p => p.id === playerId);
    if (!player) {
      setView('game');
      return;
    }
    
    // Get drawn cards
    const drawnCards = gameState.pendingExchangeCards || [];
    
    // Draw cards if needed
    const drawExchangeCards = async () => {
      // Only draw cards if we don't have any yet
      if (drawnCards.length === 0) {
        try {
          setProcessingAction(true);
          await performExchangeCards(gameId, playerId, []);
        } catch (err) {
          setError((err as Error).message);
          // Return to game view on error
          setTimeout(() => setView('game'), 2000);
        } finally {
          setProcessingAction(false);
        }
      } else {
        // Make sure processing state is reset even if we don't draw new cards
        setProcessingAction(false);
      }
    };
    
    // Draw exchange cards
    drawExchangeCards();
    
    // Cleanup function to ensure processing state is reset
    return () => {
      setProcessingAction(false);
    };
    
  }, [view, gameState, playerId, gameId]); // Add all dependencies needed

  // Subscribe to game updates when in lobby or game
  useEffect(() => {
    if ((view === 'lobby' || view === 'game') && gameId) {
      const unsubscribe = subscribeToGame(gameId, (game) => {
        setGameState(game);
        
        // Auto-transition from lobby to game when game starts
        if (view === 'lobby' && game.gameState === 'play') {
          setView('game');
        }
        
        // Show game over message when game is terminated
        if (game.gameState === 'gameover' && game.log.includes('Game terminated because the host left')) {
          setError('Game terminated because the host left');
          // Could also redirect to home page after a delay
          setTimeout(() => setView('home'), 5000);
        }
      });
      
      return () => {
        unsubscribe();
        // We won't automatically terminate games on unmount, as this causes issues
        // if the host is simply refreshing the page or had a connection drop
      };
    }
  }, [view, gameId, playerId]);

  const handleCreateGame = async () => {
    if (!playerName) {
      setError('Please enter your name');
      return;
    }
    
    if (!gameId) {
      setError('Please enter a game ID');
      return;
    }
    
    try {
      setError('');
      await createGame(gameId, playerName);
      setPlayerId(0); // Creator is always player 0
      setView('lobby');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleJoinGame = async () => {
    if (!playerName) {
      setError('Please enter your name');
      return;
    }
    
    if (!gameId) {
      setError('Please enter a game ID');
      return;
    }
    
    try {
      setError('');
      await joinGame(gameId, playerName);
      
      // Get the game to find out the assigned player ID
      const unsubscribe = subscribeToGame(gameId, (game) => {
        const player = game.players.find(p => p.name === playerName);
        if (player) {
          setPlayerId(player.id);
          unsubscribe();
        }
      });
      
      setView('lobby');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleStartGame = async () => {
    if (!gameId || playerId === null) {
      return;
    }
    
    try {
      setError('');
      await startGame(gameId, playerId);
      setView('game');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const renderHome = () => (
    <div className="content">
      <h1>Coup Card Game</h1>
      <div className="button-container">
        <button onClick={() => setView('create')}>Create Game</button>
        <button onClick={() => setView('join')}>Join Game</button>
      </div>
    </div>
  );

  const renderCreateGame = () => (
    <div className="content">
      <h1>Create Game</h1>
      <div className="form">
        <input
          type="text"
          placeholder="Your Name"
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
        />
        <input
          type="text"
          placeholder="Game ID"
          value={gameId}
          onChange={(e) => setGameId(e.target.value)}
        />
        {error && <div className="error">{error}</div>}
        <div className="button-container">
          <button onClick={handleCreateGame}>Create Game</button>
          <button onClick={() => setView('home')}>Back</button>
        </div>
      </div>
    </div>
  );

  const renderJoinGame = () => (
    <div className="content">
      <h1>Join Game</h1>
      <div className="form">
        <input
          type="text"
          placeholder="Your Name"
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
        />
        <input
          type="text"
          placeholder="Game ID"
          value={gameId}
          onChange={(e) => setGameId(e.target.value)}
        />
        {error && <div className="error">{error}</div>}
        <div className="button-container">
          <button onClick={handleJoinGame}>Join Game</button>
          <button onClick={() => setView('home')}>Back</button>
        </div>
      </div>
    </div>
  );

  const renderLobby = () => {
    if (!gameState) return <div>Loading...</div>;
    
    return (
      <div className="content">
        <h1>Game Lobby: {gameState.id}</h1>
        <h2>Players:</h2>
        <ul className="player-list">
          {gameState.players.map((player) => (
            <li key={player.id} className={player.id === playerId ? 'current-player' : ''}>
              {player.name} {player.id === 0 ? '(Host)' : ''}
              {player.id === playerId && ' (You)'}
            </li>
          ))}
        </ul>
        
        {error && <div className="error">{error}</div>}
        
        <div className="game-log">
          <h3>Game Log:</h3>
          <div className="log-entries">
            {gameState.log.map((entry, index) => (
              <div key={index} className="log-entry">{entry}</div>
            ))}
          </div>
        </div>
        
        <div className="button-container">
          {playerId === 0 && gameState.players.length >= 2 && (
            <button onClick={handleStartGame}>Start Game</button>
          )}
          {playerId !== 0 && (
            <div className="waiting-msg">Waiting for host to start the game...</div>
          )}
        </div>
      </div>
    );
  };

  const renderGame = () => {
    if (!gameState) return <div>Loading game...</div>;
    
    // Check if the game is over (gameState === "gameover")
    const isGameOver = gameState.gameState === 'gameover';
    
    // Check if the current player has already voted for a new game
    const hasVoted = gameState.newGameVotes?.includes(playerId!) || false;
    
    return (
      <div className="content">
        <h1>Game: {gameState.id}</h1>
        <div className="game-info">
          {isGameOver ? (
            <div className="game-over-panel">
              <h2 className="game-over-title">Game Over!</h2>
              {gameState.winner && <p className="winner-announcement">{gameState.winner.name} Wins!</p>}
              
              {!hasVoted ? (
                <button 
                  className="new-game-button"
                  onClick={async () => {
                    try {
                      setProcessingAction(true);
                      await voteForNewGame(gameId, playerId!);
                    } catch (err) {
                      setError((err as Error).message);
                    } finally {
                      setProcessingAction(false);
                    }
                  }}
                >
                  {processingAction ? "Processing..." : "Vote for New Game"}
                </button>
              ) : (
                <p className="vote-confirmation">You voted for a new game</p>
              )}
              
              <div className="vote-count">
                {/* Count all players, even eliminated ones */}
                <p>Votes: {gameState.newGameVotes?.length || 0} / {gameState.players.length}</p>
              </div>
            </div>
          ) : (
            <>
              <p>Current Player: {gameState.players[gameState.currentPlayerIndex]?.name}</p>
              <p>Your Name: {gameState.players.find(p => p.id === playerId)?.name}</p>
            </>
          )}
          
          {playerId === 0 && !isGameOver && (
            <button 
              className="danger-button"
              onClick={async () => {
                if (window.confirm("Are you sure you want to terminate this game? This cannot be undone.")) {
                  try {
                    await terminateGame(gameId);
                    setView('home');
                  } catch (err) {
                    setError((err as Error).message);
                  }
                }
              }}
            >
              Terminate Game
            </button>
          )}
        </div>
        
        {!isGameOver && (
          <div className="players-container">
            {gameState.players.map((player) => (
              <div 
                key={player.id} 
                className={`player-box ${player.id === playerId ? 'your-player' : ''} ${player.id === gameState.currentPlayerIndex ? 'active-player' : ''}`}
              >
                <div className="player-name">{player.name} {player.id === playerId && '(You)'}</div>
                <div className="player-coins">Coins: {player.coins}</div>
                
                {/* Show only active cards or eliminated status */}
                {player.eliminated || player.cards.every(c => c.eliminated) ? (
                  <div className="player-eliminated">Eliminated</div>
                ) : (
                  <div className="player-cards">
                    {/* Only show cards that are not eliminated */}
                    {player.cards.filter(card => !card.eliminated).map((card, idx) => (
                      <div 
                        key={idx} 
                        className={`card ${card.character.toLowerCase()}`}
                      >
                        {/* Only show character name to the card owner */}
                        {player.id === playerId ? card.character : '?'}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        
        {/* Game actions - only show if game is not over */}
        {!isGameOver && (
          <div className="game-actions">
            {gameState.currentPlayerIndex === playerId && !gameState.pendingAction && (
              <div className="action-buttons">
                <h3>Game Actions</h3>
                {/* Check if player has 10 or more coins */}
                {gameState.players[playerId]?.coins >= 10 ? (
                  <div>
                    <div className="coup-mandatory-message" style={{
                      backgroundColor: '#fff3cd',
                      color: '#856404',
                      padding: '10px',
                      borderRadius: '4px',
                      marginBottom: '10px',
                      fontWeight: 'bold',
                      textAlign: 'center'
                    }}>
                      You have 10 or more coins. You must perform a Coup.
                    </div>
                    <button 
                      onClick={() => setView('target-selection-coup')} 
                      style={{
                        padding: '12px',
                        width: '100%',
                        backgroundColor: '#d9534f',
                        color: 'white',
                        fontWeight: 'bold',
                        fontSize: '16px',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}>
                      Coup (7 coins) - MANDATORY
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="action-group">
                      <button 
                        onClick={async () => {
                          try {
                            console.log("Income action clicked with gameId:", gameId, "playerId:", playerId);
                            setError("");
                            await performIncome(gameId, playerId!);
                            console.log("Income action completed successfully");
                          } catch (err) {
                            console.error("Income action failed:", err);
                            setError((err as Error).message);
                          }
                        }}
                      >
                        Income (1 coin)
                      </button>
                      
                      <button onClick={async () => {
                        try {
                          await performForeignAid(gameId, playerId);
                        } catch (err) {
                          setError((err as Error).message);
                        }
                      }}>Foreign Aid (2 coins)</button>
                      
                      <button 
                        onClick={() => setView('target-selection-coup')} 
                        disabled={gameState.players[playerId]?.coins < 7}>
                        Coup (7 coins)
                      </button>
                    </div>
                    <div className="action-group">
                      <button onClick={async () => {
                        try {
                          await performTax(gameId, playerId);
                        } catch (err) {
                          setError((err as Error).message);
                        }
                      }}>Tax - Duke (3 coins)</button>
                      
                      <button 
                        onClick={() => setView('target-selection-assassinate')}
                        disabled={gameState.players[playerId]?.coins < 3}>
                        Assassinate - Assassin (3 coins)
                      </button>
                      
                      <button 
                        onClick={() => setView('target-selection-steal')}>
                        Steal - Captain (2 coins)
                      </button>
                      
                      <button onClick={async () => {
                        try {
                          await performExchange(gameId, playerId);
                        } catch (err) {
                          setError((err as Error).message);
                        }
                      }}>Exchange - Ambassador</button>
                    </div>
                  </>
                )}
              </div>
            )}
            
            {gameState.pendingAction && (
            <div className="pending-action">
              <h3>Pending Action</h3>
              <div className="pending-action-details">
                <p className="pending-action-title">
                  <span className="action-type">
                    {gameState.pendingAction.type.charAt(0).toUpperCase() + gameState.pendingAction.type.slice(1)} action
                  </span> 
                  {gameState.pendingAction.player && (
                    <> by <span className="actor-name">
                      {gameState.pendingAction.player.id === playerId ? "You" : gameState.pendingAction.player.name}
                    </span></>
                  )}
                  {gameState.pendingAction.character && (
                    <> (using <span className="character-name">{gameState.pendingAction.character}</span>)</>
                  )}
                </p>
                
                {gameState.pendingAction.target && (
                  <p className="action-target">
                    Target: <span className="target-name">
                      {gameState.pendingAction.target.id === playerId ? "You" : gameState.pendingAction.target.name}
                    </span>
                  </p>
                )}
                
                {/* Display who is selecting a card to lose */}
                {gameState.pendingAction.type === 'loseInfluence' && gameState.pendingAction.player && (
                  <p className="waiting-for-player">
                    {gameState.pendingAction.player.id === playerId ? 
                      "You are" : 
                      `${gameState.pendingAction.player.name} is`} selecting a card to lose...
                  </p>
                )}
                
                {/* Universal lose influence action - only show when player can't respond in other ways */}
                {/* For loseInfluence, always show. For assassinate, only show if player has already responded */}
                {((gameState.pendingAction.type === 'loseInfluence' && gameState.pendingAction.player?.id === playerId) ||
                 ((gameState.pendingAction.type === 'coup' && gameState.pendingAction.target?.id === playerId) ||
                  (gameState.pendingAction.type === 'assassinate' && 
                   gameState.pendingAction.target?.id === playerId && 
                   gameState.actionResponders?.includes(playerId)))) && 
                   !processingAction && (
                  <div className="action-required">
                    <p>You must lose influence!</p>
                    <button
                      onClick={() => {
                        setProcessingAction(true);
                        handleLoseInfluence();
                      }}
                      className="required-action-btn"
                    >
                      Choose Influence to Lose
                    </button>
                  </div>
                )}
                
                {/* Status message for the initiator of targeted actions - only show for coup or when player responses aren't visible */}
                {(gameState.pendingAction.type === 'coup' || 
                  (gameState.pendingAction.type === 'assassinate' && 
                   gameState.pendingAction.player?.id === playerId && 
                   gameState.pendingAction.target && 
                   // Only show this message if we're not showing player responses (to avoid redundancy)
                   (!gameState.actionResponders || gameState.pendingBlockBy))) && (
                  <div className="waiting-status" style={{
                    backgroundColor: '#f5f5f5',
                    padding: '8px 12px',
                    borderRadius: '4px',
                    margin: '10px 0'
                  }}>
                    <p style={{ margin: 0 }}>
                      {gameState.pendingAction.type === 'coup' ? (
                        // For Coup (which can't be blocked or challenged)
                        `Waiting for ${gameState.pendingAction.target.name} to choose which influence to lose...`
                      ) : (
                        // For Assassinate (which can be challenged or blocked)
                        `Waiting for ${gameState.pendingAction.target.name} to respond to your assassination...`
                      )}
                    </p>
                  </div>
                )}
                
                {/* Display player response status - only when no block is in progress */}
                {gameState.pendingAction && gameState.actionResponders && 
                 (gameState.pendingAction.challengeable || gameState.pendingAction.blockableBy) && 
                 !gameState.pendingBlockBy && (
                  <div className="player-responses" style={{
                    margin: '10px 0',
                    padding: '10px',
                    backgroundColor: '#f5f5f5',
                    borderRadius: '6px'
                  }}>
                    <p className="responses-title" style={{
                      fontWeight: 'bold',
                      margin: '0 0 8px 0',
                      fontSize: '14px'
                    }}>OTHER PLAYER RESPONSES:</p>
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '5px'
                    }}>
                    {gameState.players
                      // Only include non-eliminated players and exclude the action initiator
                      // Include the target - all non-eliminated, non-initiating players can challenge
                      .filter(p => !p.eliminated && p.id !== gameState.pendingAction?.player?.id)
                      .map(player => {
                        // Special case for Exchange action with cards drawn:
                        // Mark all players as responded if cards have been drawn
                        const hasResponded = gameState.actionResponders?.includes(player.id) || 
                                           (gameState.pendingAction.type === 'exchange' && 
                                            gameState.pendingExchangeCards && 
                                            gameState.pendingExchangeCards.length > 0);
                        
                        // Is this player a special player (like the target)
                        const isTarget = gameState.pendingAction?.target?.id === player.id;
                        
                        return (
                          <div key={player.id} className="player-response-status" style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '6px 10px',
                            backgroundColor: isTarget ? '#ffe9c7' : '#fff',
                            borderRadius: '4px',
                            border: isTarget ? '1px solid #ffcc80' : '1px solid #ddd'
                          }}>
                            <span className="response-player-name" style={{
                              fontWeight: isTarget ? 'bold' : 'normal',
                              display: 'flex',
                              alignItems: 'center'
                            }}>
                              {player.id === playerId ? "You" : player.name}
                              {isTarget && <span style={{ fontSize: '11px', marginLeft: '5px', color: '#ff9800' }}>(Target)</span>}
                            </span>
                            <span className={`response-status ${hasResponded ? 'responded' : 'waiting'}`} style={{
                              backgroundColor: hasResponded ? '#4caf50' : '#f9de95',
                              color: hasResponded ? 'white' : '#8b6c42',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '12px',
                              fontWeight: 'bold'
                            }}>
                              {hasResponded ? '✓ ALLOWED' : '⌛ WAITING'}
                            </span>
                          </div>
                        );
                      })
                    }
                    </div>
                  </div>
                )}
                {/* Exchange action - only show the exchange option if all players have responded */}
                {gameState.pendingAction.type === 'exchange' && 
                 gameState.pendingAction.player?.id === playerId &&
                 !processingAction && (
                  <div className="action-required">
                    {/* Only check if cards are available for exchange - action responders should be maintained */}
                    {(gameState.pendingExchangeCards && gameState.pendingExchangeCards.length > 0) ? (
                      <>
                        <p>You can now exchange your cards as Ambassador</p>
                        <button
                          onClick={() => {
                            setView('exchange-cards');
                          }}
                          className="required-action-btn"
                          disabled={processingAction}
                        >
                          {processingAction ? "Loading..." : "Exchange Cards"}
                        </button>
                      </>
                    ) : (
                      <p>Waiting for other players to respond to your Ambassador action...</p>
                    )}
                  </div>
                )}
                {/* Create a response UI for any player who has not yet responded */}
                {gameState.pendingAction && !gameState.pendingBlockBy && 
                 // Not the initiator of the action
                 playerId !== gameState.pendingAction.player?.id && 
                 // Haven't responded yet
                 !gameState.actionResponders?.includes(playerId!) && 
                 // Not processing an action (immediately hide UI when responding)
                 !processingAction &&
                 // Not eliminated
                 !gameState.players.find(p => p.id === playerId)?.eliminated &&
                 // Check that action can be challenged or blocked
                 (gameState.pendingAction.challengeable || 
                  (gameState.pendingAction.blockableBy && 
                   (!gameState.pendingAction.target || gameState.pendingAction.target.id === playerId))) && (
                  <div className="player-response-ui">
                    {/* Both challenge and block options available - only for the target */}
                    {gameState.pendingAction.challengeable && gameState.pendingAction.blockableBy && 
                     // Only the target can block with characters
                     gameState.pendingAction.target?.id === playerId && (
                      <div className="action-response-container">
                        <h4>Your Response:</h4>
                        <div className="response-options">
                          {/* Challenge Option */}
                          <button
                            className="response-button challenge-button"
                            onClick={async () => {
                              try {
                                setProcessingAction(true);
                                await performChallenge(gameId, playerId!);
                              } catch (err) {
                                setError((err as Error).message);
                              } finally {
                                setProcessingAction(false);
                              }
                            }}
                            style={{
                              backgroundColor: '#e74c3c',
                              color: 'white',
                              fontWeight: 'bold',
                              padding: '10px 16px',
                              margin: '5px',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '14px'
                            }}
                          >
                            ⚔️ CHALLENGE (Claim: No {gameState.pendingAction.character})
                          </button>
                          
                          {/* Block Options */}
                          <div className="block-options-container" style={{ margin: '10px 0' }}>
                            <div style={{ 
                              fontWeight: 'bold', 
                              marginBottom: '5px', 
                              fontSize: '14px' 
                            }}>BLOCK WITH:</div>
                            
                            <div className="block-buttons" style={{ display: 'flex', gap: '5px' }}>
                              {gameState.pendingAction.blockableBy.map(character => (
                                <button
                                  key={character}
                                  onClick={async () => {
                                    try {
                                      setProcessingAction(true);
                                      await performBlock(gameId, playerId!, character);
                                    } catch (err) {
                                      setError((err as Error).message);
                                    } finally {
                                      setProcessingAction(false);
                                    }
                                  }}
                                  style={{
                                    backgroundColor: '#3498db',
                                    color: 'white',
                                    fontWeight: 'bold',
                                    padding: '10px 16px',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    flex: 1,
                                    fontSize: '14px'
                                  }}
                                >
                                  {getCharacterIcon(character)} {character}
                                </button>
                              ))}
                            </div>
                          </div>
                          
                          {/* Conditional Pass/Lose Influence button based on action type and target */}
                          {gameState.pendingAction.type === 'assassinate' && 
                           gameState.pendingAction.target?.id === playerId ? (
                            // Special case for assassination targets - show "Lose Influence" instead of "Pass"
                            <button
                              className="response-button lose-influence-button"
                              onClick={() => {
                                try {
                                  setProcessingAction(true);
                                  // First allow the action to proceed
                                  allowActionToProceed(gameId, playerId!)
                                    .then(() => {
                                      // Then go to the lose influence screen
                                      setView('lose-influence');
                                      setProcessingAction(false);
                                    })
                                    .catch(err => {
                                      setError((err as Error).message);
                                      setProcessingAction(false);
                                    });
                                } catch (err) {
                                  setError((err as Error).message);
                                  setProcessingAction(false);
                                }
                              }}
                              style={{
                                backgroundColor: '#e67e22',
                                color: 'white',
                                padding: '10px 16px',
                                margin: '5px',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '14px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              <span style={{ marginRight: '6px' }}>💀</span> 
                              LOSE INFLUENCE (Choose Card)
                            </button>
                          ) : (
                            // Standard pass button for other actions
                            <button
                              className="response-button pass-button"
                              onClick={async () => {
                                try {
                                  setProcessingAction(true);
                                  await allowActionToProceed(gameId, playerId!);
                                } catch (err) {
                                  setError((err as Error).message);
                                } finally {
                                  setProcessingAction(false);
                                }
                              }}
                              style={{
                                backgroundColor: '#7f8c8d',
                                color: 'white',
                                padding: '10px 16px',
                                margin: '5px',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '14px'
                              }}
                            >
                              ✓ PASS (Allow Action)
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* Challenge only - for non-targets or actions without block options */}
                    {gameState.pendingAction.challengeable && 
                     // Either there are no block options OR this player is not the target
                     (!gameState.pendingAction.blockableBy || 
                      (gameState.pendingAction.target && gameState.pendingAction.target.id !== playerId)) && 
                     (
                      <div className="action-response-container">
                        <h4>Your Response:</h4>
                        <div className="response-options">
                          {/* Challenge Option */}
                          <button
                            className="response-button challenge-button"
                            onClick={async () => {
                              try {
                                setProcessingAction(true);
                                await performChallenge(gameId, playerId!);
                              } catch (err) {
                                setError((err as Error).message);
                              } finally {
                                setProcessingAction(false);
                              }
                            }}
                            style={{
                              backgroundColor: '#e74c3c',
                              color: 'white',
                              fontWeight: 'bold',
                              padding: '10px 16px',
                              margin: '5px',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '14px'
                            }}
                          >
                            ⚔️ CHALLENGE (Claim: No {gameState.pendingAction.character})
                          </button>
                          
                          {/* Conditional Pass/Lose Influence button based on action type and target */}
                          {gameState.pendingAction.type === 'assassinate' && 
                           gameState.pendingAction.target?.id === playerId ? (
                            // Special case for assassination targets - show "Lose Influence" instead of "Pass"
                            <button
                              className="response-button lose-influence-button"
                              onClick={() => {
                                try {
                                  setProcessingAction(true);
                                  // First allow the action to proceed
                                  allowActionToProceed(gameId, playerId!)
                                    .then(() => {
                                      // Then go to the lose influence screen
                                      setView('lose-influence');
                                      setProcessingAction(false);
                                    })
                                    .catch(err => {
                                      setError((err as Error).message);
                                      setProcessingAction(false);
                                    });
                                } catch (err) {
                                  setError((err as Error).message);
                                  setProcessingAction(false);
                                }
                              }}
                              style={{
                                backgroundColor: '#e67e22',
                                color: 'white',
                                padding: '10px 16px',
                                margin: '5px',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '14px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              <span style={{ marginRight: '6px' }}>💀</span> 
                              LOSE INFLUENCE (Choose Card)
                            </button>
                          ) : (
                            // Standard pass button for other actions
                            <button
                              className="response-button pass-button"
                              onClick={async () => {
                                try {
                                  setProcessingAction(true);
                                  await allowActionToProceed(gameId, playerId!);
                                } catch (err) {
                                  setError((err as Error).message);
                                } finally {
                                  setProcessingAction(false);
                                }
                              }}
                              style={{
                                backgroundColor: '#7f8c8d',
                                color: 'white',
                                padding: '10px 16px',
                                margin: '5px',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '14px'
                              }}
                            >
                              ✓ PASS (Allow Action)
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* Block only */}
                    {!gameState.pendingAction.challengeable && gameState.pendingAction.blockableBy && 
                     (gameState.pendingAction.target?.id === playerId || 
                      (!gameState.pendingAction.target && playerId !== gameState.pendingAction.player?.id)) && (
                      <div className="action-response-container">
                        <h4>Your Response:</h4>
                        <div className="response-options">
                          {/* Block Options */}
                          <div className="block-options-container" style={{ margin: '10px 0' }}>
                            <div style={{ 
                              fontWeight: 'bold', 
                              marginBottom: '5px', 
                              fontSize: '14px' 
                            }}>BLOCK WITH:</div>
                            
                            <div className="block-buttons" style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                              {gameState.pendingAction.blockableBy.map(character => (
                                <button
                                  key={character}
                                  onClick={async () => {
                                    try {
                                      setProcessingAction(true);
                                      await performBlock(gameId, playerId!, character);
                                    } catch (err) {
                                      setError((err as Error).message);
                                    } finally {
                                      setProcessingAction(false);
                                    }
                                  }}
                                  style={{
                                    backgroundColor: '#3498db',
                                    color: 'white',
                                    fontWeight: 'bold',
                                    padding: '10px 16px',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    flex: '1 0 40%',
                                    fontSize: '14px',
                                    margin: '3px'
                                  }}
                                >
                                  {getCharacterIcon(character)} {character}
                                </button>
                              ))}
                            </div>
                          </div>
                          
                          {/* Conditional Pass/Lose Influence button based on action type and target */}
                          {gameState.pendingAction.type === 'assassinate' && 
                           gameState.pendingAction.target?.id === playerId ? (
                            // Special case for assassination targets - show "Lose Influence" instead of "Pass"
                            <button
                              className="response-button lose-influence-button"
                              onClick={() => {
                                try {
                                  setProcessingAction(true);
                                  // First allow the action to proceed
                                  allowActionToProceed(gameId, playerId!)
                                    .then(() => {
                                      // Then go to the lose influence screen
                                      setView('lose-influence');
                                      setProcessingAction(false);
                                    })
                                    .catch(err => {
                                      setError((err as Error).message);
                                      setProcessingAction(false);
                                    });
                                } catch (err) {
                                  setError((err as Error).message);
                                  setProcessingAction(false);
                                }
                              }}
                              style={{
                                backgroundColor: '#e67e22',
                                color: 'white',
                                padding: '10px 16px',
                                margin: '5px',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '14px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              <span style={{ marginRight: '6px' }}>💀</span> 
                              LOSE INFLUENCE (Choose Card)
                            </button>
                          ) : (
                            // Standard pass button for other actions
                            <button
                              className="response-button pass-button"
                              onClick={async () => {
                                try {
                                  setProcessingAction(true);
                                  await allowActionToProceed(gameId, playerId!);
                                } catch (err) {
                                  setError((err as Error).message);
                                } finally {
                                  setProcessingAction(false);
                                }
                              }}
                              style={{
                                backgroundColor: '#7f8c8d',
                                color: 'white',
                                padding: '10px 16px',
                                margin: '5px',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '14px'
                              }}
                            >
                              ✓ PASS (Allow Action)
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
          
          {gameState.pendingBlockBy && (
            <div className="pending-block">
              <div className="pending-block-details" style={{
                backgroundColor: '#f8f9fa',
                borderRadius: '8px',
                padding: '16px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}>
                {/* Block attempt banner with character icon */}
                <div style={{
                  backgroundColor: '#3498db',
                  padding: '10px',
                  borderRadius: '6px 6px 0 0',
                  color: 'white',
                  fontWeight: 'bold',
                  fontSize: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '12px'
                }}>
                  <span style={{ marginRight: '8px' }}>{getCharacterIcon(gameState.pendingBlockBy.character)}</span>
                  BLOCK ATTEMPT
                </div>
                
                <p style={{ 
                  fontSize: '15px', 
                  textAlign: 'center', 
                  margin: '0 0 12px 0',
                  fontWeight: 'bold'
                }}>
                  {gameState.pendingBlockBy.player.name} is attempting to block with {gameState.pendingBlockBy.character}
                </p>
                
                {/* Only the non-eliminated player whose action is being blocked should see these options */}
                {gameState.pendingAction?.player?.id === playerId && 
                 !gameState.players.find(p => p.id === playerId)?.eliminated &&
                 !processingAction && (
                  <div className="challenge-block-options">
                    <div className="response-options" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {/* Challenge Option */}
                      <button
                        onClick={async () => {
                          try {
                            setProcessingAction(true);
                            await performChallengeBlock(gameId, playerId!);
                          } catch (err) {
                            setError((err as Error).message);
                          } finally {
                            setProcessingAction(false);
                          }
                        }}
                        style={{
                          backgroundColor: '#e74c3c',
                          color: 'white',
                          fontWeight: 'bold',
                          padding: '12px 16px',
                          margin: '5px',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '14px'
                        }}
                      >
                        ⚔️ CHALLENGE (Claim: No {gameState.pendingBlockBy.character})
                      </button>
                      
                      {/* Accept Option */}
                      <button
                        onClick={async () => {
                          // Accept the block, which cancels your action
                          try {
                            setProcessingAction(true);
                            await allowActionToProceed(gameId, playerId!);
                          } catch (err) {
                            setError((err as Error).message);
                          } finally {
                            setProcessingAction(false);
                          }
                        }}
                        style={{
                          backgroundColor: '#7f8c8d',
                          color: 'white',
                          padding: '12px 16px',
                          margin: '5px',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '14px'
                        }}
                      >
                        ✓ ACCEPT BLOCK (Your action fails)
                      </button>
                    </div>
                  </div>
                )}
                
                {/* If you're not the blocker or the person being blocked, just show a waiting message */}
                {gameState.pendingAction?.player?.id !== playerId && gameState.pendingBlockBy.player.id !== playerId && (
                  <div className="waiting-msg" style={{
                    backgroundColor: '#ecf0f1',
                    padding: '10px',
                    borderRadius: '4px',
                    textAlign: 'center',
                    margin: '10px 0'
                  }}>
                    Waiting for {gameState.pendingAction?.player?.name} to respond to the block...
                  </div>
                )}
              </div>
            </div>
          )}
          {gameState.players.find(p => p.id === playerId)?.eliminated ? (
            <div className="eliminated-msg" style={{
              backgroundColor: '#ffcdd2',
              color: '#b71c1c',
              padding: '12px',
              borderRadius: '6px',
              fontWeight: 'bold',
              textAlign: 'center',
              margin: '15px 0'
            }}>
              You have been eliminated from the game. 
              You can only observe but cannot participate in any actions.
            </div>
          ) : gameState.currentPlayerIndex !== playerId && (
            <div className="waiting-msg">
              Waiting for {gameState.players[gameState.currentPlayerIndex]?.name} to take their turn...
            </div>
          )}
          </div>
        )}
        
        <div className="game-log">
          <h3>Game Log:</h3>
          <div className="log-entries">
            {gameState.log.slice(-10).map((entry, index) => (
              <div key={index} className="log-entry">{entry}</div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // Lose influence (choose card(s) to eliminate)
  const renderLoseInfluence = () => {
    if (!gameState) return <div>Loading...</div>;
    
    // Check if this is the correct player who should be losing influence
    // Could be from loseInfluence action or as a target of coup/assassinate
    const shouldLoseInfluence = 
      // From loseInfluence action
      (gameState.pendingAction?.type === 'loseInfluence' && gameState.pendingAction?.player?.id === playerId) ||
      // Or target of coup/assassinate
      ((gameState.pendingAction?.type === 'coup' || gameState.pendingAction?.type === 'assassinate') && 
       gameState.pendingAction?.target?.id === playerId);
    
    if (!shouldLoseInfluence) {
      // Redirect back to the game if this player shouldn't be losing influence
      setView('game');
      return <div>Redirecting...</div>;
    }
    
    const player = gameState.players.find(p => p.id === playerId);
    if (!player) return <div>Player not found</div>;
    
    // Only show non-eliminated cards
    const aliveCards = player.cards.filter(card => !card.eliminated);
    
    // If player only has one card left, they will be automatically eliminated by the server
    // Redirect back to game view immediately
    if (aliveCards.length === 1) {
      console.log("Player only has one card left. Auto-elimination will occur.");
      setView('game');
      return <div>You will be automatically eliminated...</div>;
    }
    
    // Check if this is a "lose second influence" case
    const isSecondInfluence = gameState.pendingAction?.reason === 'assassination';
    
    // Determine how many cards need to be selected
    const requiredSelections = 1; // Always 1 for now
    
    // Rendering the UI with cards to choose from (similar to exchange UI)
    return (
      <div className="content">
        <h1>Choose Card to Lose</h1>
        <p className="lose-influence-instruction" style={{ marginBottom: '15px' }}>
          {isSecondInfluence 
            ? "Select your second card to lose due to assassination:" 
            : "Select which influence you want to lose:"}
        </p>
        
        {aliveCards.length === 0 ? (
          <div className="error">Error: No cards to choose from!</div>
        ) : (
          <>
            <div className="card-selection" style={{ 
              display: 'flex', 
              flexWrap: 'wrap',
              gap: '15px',
              justifyContent: 'center',
              marginBottom: '20px'
            }}>
              {aliveCards.map((card, idx) => {
                // Create a mapping of each alive card to its original index
                const aliveCardIndices = player.cards
                  .map((c, index) => ({ card: c, index }))
                  .filter(item => !item.card.eliminated)
                  .map(item => item.index);
                
                // Use the mapping to get the original index for this card
                const originalIndex = aliveCardIndices[idx];
                
                return (
                  <div 
                    key={idx} 
                    className="card-choice" 
                    style={{ 
                      border: '2px solid #ddd',
                      borderRadius: '8px',
                      padding: '10px',
                      width: '120px',
                      cursor: 'pointer',
                      textAlign: 'center',
                      backgroundColor: selectedCards.includes(originalIndex) ? '#fff3cd' : 'white',
                      boxShadow: selectedCards.includes(originalIndex) ? '0 0 5px #ffcc00' : 'none',
                      transition: 'all 0.2s'
                    }}
                    onClick={() => {
                      if (selectedCards.includes(originalIndex)) {
                        // Remove from selection
                        setSelectedCards(prev => prev.filter(i => i !== originalIndex));
                      } else if (selectedCards.length < requiredSelections) {
                        // Add to selection
                        setSelectedCards(prev => [...prev, originalIndex]);
                      }
                    }}
                  >
                    <div 
                      className={`card ${card.character.toLowerCase()}`}
                      style={{ 
                        fontSize: '20px', 
                        fontWeight: 'bold',
                        marginBottom: '10px'
                      }}
                    >
                      {card.character}
                    </div>
                    <div style={{ 
                      fontSize: '14px',
                      color: selectedCards.includes(originalIndex) ? '#b7791f' : '#666',
                      fontWeight: selectedCards.includes(originalIndex) ? 'bold' : 'normal'
                    }}>
                      {selectedCards.includes(originalIndex) ? 'Selected' : 'Click to select'}
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div style={{ textAlign: 'center' }}>
              <button 
                onClick={async () => {
                  try {
                    if (selectedCards.length !== requiredSelections) {
                      setError(`Please select ${requiredSelections} card${requiredSelections > 1 ? 's' : ''}`);
                      return;
                    }
                    
                    setProcessingAction(true);
                    await performLoseInfluence(gameId, playerId!, selectedCards[0]);
                    setSelectedCards([]);
                    setView('game');
                  } catch (err) {
                    setError((err as Error).message);
                    setProcessingAction(false);
                  }
                }}
                disabled={selectedCards.length !== requiredSelections || processingAction}
                style={{
                  backgroundColor: '#d9534f',
                  color: 'white',
                  padding: '12px 25px',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: selectedCards.length === requiredSelections && !processingAction ? 'pointer' : 'not-allowed',
                  opacity: selectedCards.length === requiredSelections && !processingAction ? 1 : 0.7
                }}
              >
                {processingAction 
                  ? "Processing..." 
                  : `Confirm Card Selection${isSecondInfluence ? ' (2nd loss)' : ''}`}
              </button>
              
              {error && <div className="error" style={{ marginTop: '15px', color: '#d9534f' }}>{error}</div>}
            </div>
          </>
        )}
      </div>
    );
  };
  
  // Card exchange UI (for Ambassador ability)
  const renderExchangeCards = () => {
    // Exit early if data is missing
    if (!gameState || !gameState.pendingAction || gameState.pendingAction.type !== 'exchange') {
      return <div>Checking game state...</div>;
    }
    
    // Get player and card data
    const player = gameState.players.find(p => p.id === playerId);
    if (!player) return <div>Player not found</div>;
    
    // Get player's living cards and any drawn cards
    const aliveCards = player.cards.filter(card => !card.eliminated);
    const drawnCards = gameState.pendingExchangeCards || [];
    const allCards = [...aliveCards, ...drawnCards];
    
    // Players must select the same number of cards as their current influence
    const requiredSelections = aliveCards.length;
    
    // Function to handle card selection
    const toggleCardSelection = (index: number) => {
      // Use functional updates to ensure we're working with the latest state
      setSelectedCards(prevSelected => {
        if (prevSelected.includes(index)) {
          // Remove from selection
          return prevSelected.filter(i => i !== index);
        } else {
          // Add to selection if not at max
          if (prevSelected.length < requiredSelections) {
            return [...prevSelected, index];
          }
          // If already at max, don't change selection
          return prevSelected;
        }
      });
    };
    
    // If no drawn cards, show loading
    if (drawnCards.length === 0) {
      return (
        <div className="content">
          <h1>Exchange Cards</h1>
          <p>Drawing cards for exchange...</p>
          <div className="loading-indicator">
            <p>{processingAction ? "Drawing cards... Please wait." : "Waiting for cards..."}</p>
          </div>
          {error && <div className="error">{error}</div>}
        </div>
      );
    }
    
    return (
      <div className="content">
        <h1>Exchange Cards</h1>
        <p className="exchange-instruction">
          Select {requiredSelections} cards to keep ({selectedCards.length}/{requiredSelections} selected):
        </p>
        
        <div className="card-selection">
          {allCards.map((card, index) => (
            <div 
              key={index} 
              className={`card-choice ${selectedCards.includes(index) ? 'selected' : ''}`}
              onClick={() => toggleCardSelection(index)}
            >
              <div className={`card ${card.character.toLowerCase()}`}>
                <div className="card-name">{card.character}</div>
              </div>
              <div className="card-select-indicator">
                {selectedCards.includes(index) ? '✓' : ' '}
              </div>
            </div>
          ))}
        </div>
        
        {error && <div className="error">{error}</div>}
        
        <div className="button-container">
          <button 
            onClick={async () => {
              try {
                if (selectedCards.length !== requiredSelections) {
                  setError(`You must select exactly ${requiredSelections} cards`);
                  return;
                }
                
                setProcessingAction(true);
                await performExchangeCards(gameId, playerId!, [...selectedCards]); // Make a copy of the array
                setSelectedCards([]);
                setView('game');
              } catch (err) {
                setError((err as Error).message);
              } finally {
                setProcessingAction(false);
              }
            }}
            disabled={selectedCards.length !== requiredSelections || processingAction}
          >
            Confirm Selection
          </button>
          
          {processingAction && (
            <div className="loading-status">Processing your selection...</div>
          )}
        </div>
      </div>
    );
  };
  
  // Target selection views
  const renderTargetSelectionCoup = () => {
    if (!gameState) return <div>Loading...</div>;
    
    // Find valid targets (all other alive players)
    const validTargets = gameState.players.filter(p => 
      p.id !== playerId && !p.eliminated && p.cards.some(card => !card.eliminated)
    );
    
    return (
      <div className="content">
        <h1>Select Target for Coup</h1>
        <div className="target-list">
          {validTargets.map(target => (
            <div key={target.id} className="target-item">
              <div className="target-name">{target.name}</div>
              <div className="target-info">Influence: {target.cards.filter(c => !c.eliminated).length}</div>
              <button onClick={async () => {
                try {
                  await performCoup(gameId, playerId!, target.id);
                  setView('game');
                } catch (err) {
                  setError((err as Error).message);
                }
              }}>Select {target.name}</button>
            </div>
          ))}
        </div>
        <button onClick={() => setView('game')} className="back-button">Cancel</button>
      </div>
    );
  };
  
  const renderTargetSelectionAssassinate = () => {
    if (!gameState) return <div>Loading...</div>;
    
    // Find valid targets (all other alive players)
    const validTargets = gameState.players.filter(p => 
      p.id !== playerId && !p.eliminated && p.cards.some(card => !card.eliminated)
    );
    
    return (
      <div className="content">
        <h1>Select Target for Assassination</h1>
        <div className="target-list">
          {validTargets.map(target => (
            <div key={target.id} className="target-item">
              <div className="target-name">{target.name}</div>
              <div className="target-info">Influence: {target.cards.filter(c => !c.eliminated).length}</div>
              <button onClick={async () => {
                try {
                  await performAssassinate(gameId, playerId!, target.id);
                  setView('game');
                } catch (err) {
                  setError((err as Error).message);
                }
              }}>Assassinate {target.name}</button>
            </div>
          ))}
        </div>
        <button onClick={() => setView('game')} className="back-button">Cancel</button>
      </div>
    );
  };
  
  const renderTargetSelectionSteal = () => {
    if (!gameState) return <div>Loading...</div>;
    
    // Find valid targets (all other alive players with coins)
    const validTargets = gameState.players.filter(p => 
      p.id !== playerId && !p.eliminated && p.cards.some(card => !card.eliminated) && p.coins > 0
    );
    
    return (
      <div className="content">
        <h1>Select Target to Steal From</h1>
        <div className="target-list">
          {validTargets.map(target => (
            <div key={target.id} className="target-item">
              <div className="target-name">{target.name}</div>
              <div className="target-info">Coins: {target.coins}</div>
              <button onClick={async () => {
                try {
                  await performSteal(gameId, playerId!, target.id);
                  setView('game');
                } catch (err) {
                  setError((err as Error).message);
                }
              }}>Steal from {target.name}</button>
            </div>
          ))}
        </div>
        <button onClick={() => setView('game')} className="back-button">Cancel</button>
      </div>
    );
  };

  // Render appropriate view
  switch (view) {
    case 'home':
      return renderHome();
    case 'create':
      return renderCreateGame();
    case 'join':
      return renderJoinGame();
    case 'lobby':
      return renderLobby();
    case 'game':
      return renderGame();
    case 'target-selection-coup':
      return renderTargetSelectionCoup();
    case 'target-selection-assassinate':
      return renderTargetSelectionAssassinate();
    case 'target-selection-steal':
      return renderTargetSelectionSteal();
    case 'lose-influence':
      // If player only has one card left, don't render the lose influence view
      // This will prevent showing the selection screen even if setView is called
      const player = gameState?.players.find(p => p.id === playerId);
      if (player) {
        const aliveCards = player.cards.filter(card => !card.eliminated);
        if (aliveCards.length === 1) {
          console.log("Player only has one card - redirecting to game view");
          // Redirect to game view
          setTimeout(() => {
            setView('game');
          }, 0);
          return <div>You will be automatically eliminated...</div>;
        }
      }
      return renderLoseInfluence();
    case 'exchange-cards':
      return renderExchangeCards();
    default:
      return renderHome();
  }
}

export default App;