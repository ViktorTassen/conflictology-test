import { useEffect, useState } from 'react';
import { Game } from '@/domain/types/game';
import { useGameStore } from '@/store/gameStore';
import { TargetSelection } from '@/components/TargetSelection';
import CardReveal from '@/components/CardReveal';
import './style.css';

// Get URL query parameters
const getUrlParams = () => {
  const searchParams = new URLSearchParams(window.location.search);
  const gameId = searchParams.get('gameId');
  const playerId = searchParams.get('playerId');

  return { gameId, playerId };
};

export function GamePage() {
  const { gameId, playerId } = getUrlParams();
  const { 
    currentGame, 
    subscribeToGame, 
    loading, 
    error, 
    performAction,
    blockAction,
    challengeAction,
    revealCard,
    completeExchange
  } = useGameStore();
  
  // State for target selection
  const [showTargetSelection, setShowTargetSelection] = useState(false);
  const [currentActionType, setCurrentActionType] = useState<string>('');

  // Subscribe to game updates and register player info
  useEffect(() => {
    if (!gameId) {
      console.error('No gameId available');
      return;
    }

    console.log(`Initializing game with ID: ${gameId}`);
    
    // First subscribe to the game to get initial state
    const unsubscribe = subscribeToGame(gameId);
    
    // Set game info in the store once when we have both gameId and playerId
    // This is separated in its own useEffect to prevent loops
    
    return () => {
      console.log('Unsubscribing from game updates');
      unsubscribe();
    };
  }, [gameId, subscribeToGame]);
  
  // Set player info in store separately to avoid re-subscriptions
  useEffect(() => {
    if (playerId && gameId && currentGame?.players) {
      const playerName = currentGame.players.find(p => p.id === playerId)?.name || '';
      if (playerName) {
        console.log(`Setting game info in store: gameId=${gameId}, playerId=${playerId}, name=${playerName}`);
        useGameStore.getState().setGameInfo(gameId, playerId, playerName);
      }
    }
  }, [gameId, playerId, currentGame?.id]);
  
  // Auto-recovery for UI getting stuck with eliminated players
  useEffect(() => {
    // If we detect an eliminated player is in pendingActionFrom, we need to handle it
    if (currentGame?.gameState === 'lose_influence' && 
        currentGame.pendingActionFrom && 
        currentGame.players.find(p => p.id === currentGame.pendingActionFrom)?.eliminated) {
      
      console.log('Detected stuck game state with eliminated player in pendingActionFrom');
      
      // Immediately attempt to fix the game state by sending a direct refresh request
      if (gameId) {
        // Force a game state refresh
        useGameStore.getState().refreshGameState()
          .then(() => console.log('Game state refreshed for eliminated player'))
          .catch((error) => console.error('Error refreshing game state:', error));
      }
    }
  }, [currentGame?.gameState, currentGame?.pendingActionFrom, gameId]);

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

  if (!currentGame) {
    return (
      <div id="header">
        <h1>Game Not Found</h1>
        <div id="game-state">The game with ID {gameId} doesn't exist</div>
      </div>
    );
  }

  const currentPlayer = currentGame.players.find(p => p.id === playerId);
  const isCurrentTurn = currentGame.players[currentGame.currentPlayerIndex]?.id === playerId;
  
  // Handle target selection
  const handleShowTargetSelection = (actionType: string) => {
    setCurrentActionType(actionType);
    setShowTargetSelection(true);
  };
  
  const handleSelectTarget = (targetId: string) => {
    handleAction(currentActionType, targetId);
    setShowTargetSelection(false);
  };
  
  const handleCancelTargetSelection = () => {
    setShowTargetSelection(false);
  };
  
  // Handle exchange card selection
  const handleCompleteExchange = async (selectedIndices: number[]) => {
    if (!gameId || !playerId) return;
    
    try {
      console.log(`Completing exchange with selected indices: ${selectedIndices.join(', ')}`);
      
      // Fix for the bug: make sure we log the selected indices for debugging
      const currentPlayer = currentGame?.players.find(p => p.id === playerId);
      const activeCards = currentPlayer?.cards.filter(card => !card.eliminated) || [];
      const exchangeCards = currentGame?.currentAction?.exchangeCards || [];
      
      console.log('Exchange details:', {
        activeCards: activeCards.map(c => c.character),
        exchangeCards: exchangeCards.map(c => c.character),
        selectedIndices,
        selectedCards: selectedIndices.map(idx => {
          const allCards = [...activeCards, ...exchangeCards];
          return idx < allCards.length ? allCards[idx].character : 'unknown';
        })
      });
      
      // Use the selectExchangeCards function
      await useGameStore.getState().selectExchangeCards(selectedIndices);
      console.log('Exchange completed successfully');
    } catch (error) {
      console.error('Failed to complete exchange:', error);
    }
  };
  
  const handleCancelExchange = () => {
    // Can't actually cancel, so just a no-op
    console.log('Cannot cancel exchange');
  };
  
  // Handle game actions
  const handleAction = async (actionType: string, targetId?: string) => {
    try {
      console.log(`Performing action: ${actionType}`, targetId ? `with target: ${targetId}` : '');
      
      // Use the updated performAction from store
      await useGameStore.getState().performAction(actionType as any, targetId);
      
      console.log('Action performed successfully');
    } catch (error) {
      console.error('Failed to perform action:', error);
    }
  };
  
  // Handle blocking an action
  const handleBlock = async (character: string) => {
    try {
      console.log(`Blocking with ${character}`);
      // Use respondToAction instead of the old blockAction
      await useGameStore.getState().respondToAction('block', character as any);
      console.log('Block performed successfully');
    } catch (error) {
      console.error('Failed to block action:', error);
    }
  };
  
  // Handle challenging an action
  const handleChallenge = async () => {
    try {
      console.log('Challenging action');
      // Use respondToAction instead of the old challengeAction
      await useGameStore.getState().respondToAction('challenge');
      console.log('Challenge performed successfully');
    } catch (error) {
      console.error('Failed to challenge action:', error);
    }
  };
  
  // Handle revealing a card (for challenges)
  const handleRevealCard = async (cardIndex: number) => {
    if (!gameId || !playerId) {
      console.error('Missing gameId or playerId for revealCard', { gameId, playerId });
      return;
    }
    
    try {
      console.log(`Revealing card ${cardIndex}`);
      // Use the updated function with all parameters
      await useGameStore.getState().revealCard(cardIndex);
      console.log('Card revealed successfully');
    } catch (error) {
      console.error('Failed to reveal card:', error);
    }
  };
  
  // Handle losing influence
  const handleLoseInfluence = async (cardIndex: number) => {
    if (!gameId || !playerId) {
      console.error('Missing gameId or playerId for loseInfluence', { gameId, playerId });
      return;
    }
    
    try {
      console.log(`Losing influence card ${cardIndex}`);
      // Use the new loseInfluence function
      await useGameStore.getState().loseInfluence(cardIndex);
      console.log('Influence lost successfully');
    } catch (error) {
      console.error('Failed to lose influence:', error);
    }
  };
  
  // Handle accepting a block (no need to reveal card)
  const handleAcceptBlock = async () => {
    try {
      console.log('Accepting block');
      // Get store reference
      const store = useGameStore.getState();
      
      // Check if game info is properly set
      if (!store.gameId || !store.playerId) {
        console.log('Game info missing in store, setting it now');
        // Set it again as a safeguard if it's missing
        if (gameId && playerId) {
          const playerName = currentGame?.players.find(p => p.id === playerId)?.name || '';
          store.setGameInfo(gameId, playerId, playerName);
        } else {
          console.error('Cannot accept block: gameId or playerId is missing', { gameId, playerId });
          return;
        }
      }
      
      // Use respondToAction with 'pass'
      await store.respondToAction('pass');
      console.log('Block accepted successfully');
    } catch (error) {
      console.error('Failed to accept block:', error);
    }
  };
  
  // Handle challenging a block
  const handleChallengeBlock = async () => {
    try {
      console.log('Challenging block');
      // Use respondToAction with 'challenge'
      await useGameStore.getState().respondToAction('challenge');
      console.log('Block challenged successfully');
    } catch (error) {
      console.error('Failed to challenge block:', error);
    }
  };
  
  // Handle passing (allowing action)
  const handlePass = async () => {
    try {
      console.log('Passing - allowing action');
      // Make sure gameId and playerId are properly set in the store first
      // Check if the store already has the game info
      const store = useGameStore.getState();
      if (!store.gameId || !store.playerId) {
        console.log('Game info missing in store, setting it now');
        // Set it again as a safeguard if it's missing
        if (gameId && playerId) {
          const playerName = currentGame?.players.find(p => p.id === playerId)?.name || '';
          store.setGameInfo(gameId, playerId, playerName);
        } else {
          console.error('Cannot pass: gameId or playerId is missing', { gameId, playerId });
          return;
        }
      }
      
      // Use respondToAction with 'pass'
      await store.respondToAction('pass');
      console.log('Passed successfully');
    } catch (error) {
      console.error('Failed to pass:', error);
    }
  };

  return (
    <>
      <div id="header">
        <h1>Coup</h1>
        <div id="game-state">
          {currentGame.gameState === 'setup' && 'Game Setup'}
          {currentGame.gameState === 'play' && `${currentGame.players[currentGame.currentPlayerIndex]?.name}'s turn`}
          {currentGame.gameState === 'action_response' && 'Waiting for players to respond to action'}
          {currentGame.gameState === 'block_response' && 'Waiting for response to block'}
          {currentGame.gameState === 'reveal_challenge' && 'Waiting for player to reveal card'}
          {currentGame.gameState === 'lose_influence' && 
            (currentGame.pendingActionFrom && currentGame.players.find(p => p.id === currentGame.pendingActionFrom)?.eliminated 
              ? `${currentGame.players.find(p => p.id === currentGame.pendingActionFrom)?.name} has been eliminated!` 
              : 'Waiting for player to lose influence')}
          {currentGame.gameState === 'exchange_selection' && 'Waiting for player to select cards'}
          {currentGame.gameState === 'game_over' && 'Game Over - Winner: ' + 
            currentGame.players.find(p => !p.eliminated)?.name}
        </div>
      </div>
      
      {/* Court deck and treasury information removed as requested */}
      
      <div id="current-player-info">
        <h2>Current Player: <span id="current-player-name">{currentGame.players[currentGame.currentPlayerIndex]?.name}</span></h2>
        <div>Your Player: {currentPlayer?.name}</div>
      </div>

      <div id="actions-panel">
        <h2>Actions</h2>
        
        {/* Game phase message */}
        <div id="action-message" className={currentGame.gameState}>
          {/* Show special message for eliminated players regardless of game state */}
          {currentPlayer?.eliminated && currentGame.gameState !== 'game_over' ? (
            <div className="player-eliminated-message">
              <h3>You Have Been Eliminated!</h3>
              <p>You lost all influence and are out of the game. You can still watch the game progress.</p>
            </div>
          ) : !currentPlayer?.cards.some(card => !card.eliminated) && currentGame.gameState !== 'game_over' ? (
            // Catch edge cases where player has no active cards but isn't marked eliminated yet
            <div className="player-eliminated-message">
              <h3>You Have Been Eliminated!</h3>
              <p>You lost all influence and are out of the game. You can still watch the game progress.</p>
            </div>
          ) : currentGame.gameState === 'game_over' ? (
            <div className="game-over-message">
              <h3>Game Over!</h3>
              <p>Winner: {currentGame.players.find(p => !p.eliminated)?.name}</p>
              <p>Congratulations!</p>
              
              {/* Vote to restart game section */}
              <div className="restart-vote-section">
                <p className="vote-count">
                  {useGameStore.getState().getRestartVoteCount()} / {useGameStore.getState().getTotalPlayerCount()} players ready
                </p>
                
                {useGameStore.getState().hasVotedToRestart() ? (
                  <button 
                    className="vote-button voted"
                    onClick={() => useGameStore.getState().cancelRestartVote()}
                  >
                    Cancel Vote
                  </button>
                ) : (
                  <button 
                    className="vote-button"
                    onClick={() => useGameStore.getState().voteForRestart()}
                  >
                    Vote to Start Next Game
                  </button>
                )}
                
                <p className="vote-info">Game will start automatically when all players vote</p>
              </div>
            </div>
          ) : (
            <>
              {currentGame.gameState === 'play' && isCurrentTurn && 
                "It's your turn! Select an action below:"}
                
              {currentGame.gameState === 'play' && !isCurrentTurn && 
                `Waiting for ${currentGame.players[currentGame.currentPlayerIndex]?.name} to take an action...`}
                
              {currentGame.gameState === 'action_response' && currentGame.currentAction && 
                (currentGame.currentAction.responses.some(r => r.playerId === playerId) ? 
                  `You've responded to ${currentGame.players.find(p => p.id === currentGame.currentAction?.action.playerId)?.name}'s ${currentGame.currentAction.action.type}. Waiting for other players...` : 
                  `${currentGame.players.find(p => p.id === currentGame.currentAction?.action.playerId)?.name} performed ${currentGame.currentAction.action.type}. You can challenge or block.`)}
                
              {currentGame.gameState === 'reveal_challenge' && currentGame.currentAction?.challenge &&
                (currentGame.currentAction.challenge.challengedId === playerId ? 
                  `Your action was challenged! You must reveal a card to prove you have the required character.` : 
                  `${currentGame.players.find(p => p.id === currentGame.currentAction?.challenge?.challengedId)?.name}'s action was challenged. Waiting for them to respond...`)}
                
              {currentGame.gameState === 'block_response' && currentGame.currentAction?.block &&
                (currentGame.currentAction.action.playerId === playerId ? 
                  `Your action was blocked! You can challenge the block (if you think they don't have the character) or accept it.` : 
                  `${currentGame.players.find(p => p.id === currentGame.currentAction?.action.playerId)?.name}'s action was blocked. Waiting for them to respond...`)}
                  
              {currentGame.gameState === 'lose_influence' && 
                (currentGame.pendingActionFrom === playerId ? 
                  (currentPlayer?.eliminated ? 
                    `You have been eliminated!` : 
                    `You need to lose influence! Select a card to lose.`) : 
                  `${currentGame.players.find(p => p.id === currentGame.pendingActionFrom)?.name} ${
                    currentGame.players.find(p => p.id === currentGame.pendingActionFrom)?.eliminated ? 
                    'has been eliminated!' : 'is choosing which card to lose.'
                  }`)}
                  
              {currentGame.gameState === 'exchange_selection' && currentGame.currentAction?.action &&
                (currentGame.currentAction.action.playerId === playerId ? 
                  'You drew cards from the deck! Select which cards to keep.' : 
                  `${currentGame.players.find(p => p.id === currentGame.currentAction?.action.playerId)?.name} is selecting which cards to keep after drawing from the deck.`)}
            </>
          )}
        </div>
        
        {/* Regular turn actions */}
        {isCurrentTurn && currentGame.gameState === 'play' && (
          <div id="action-buttons">
            <button 
              className="action-button income" 
              onClick={() => handleAction('income')}
            >
              Income (+1 coin)
            </button>
            
            <button 
              className="action-button foreign-aid" 
              onClick={() => handleAction('foreign_aid')}
            >
              Foreign Aid (+2 coins)
            </button>
            
            <button 
              className="action-button tax" 
              onClick={() => handleAction('tax')}
            >
              Tax (+3 coins)
            </button>
            
            {currentPlayer && currentPlayer.coins >= 7 && (
              <button 
                className="action-button coup" 
                onClick={() => handleShowTargetSelection('coup')}
              >
                Coup (7 coins)
              </button>
            )}
            
            {currentPlayer && currentPlayer.coins >= 3 && (
              <button 
                className="action-button assassinate" 
                onClick={() => handleShowTargetSelection('assassinate')}
              >
                Assassinate (3 coins)
              </button>
            )}
            
            <button 
              className="action-button steal" 
              onClick={() => handleShowTargetSelection('steal')}
            >
              Steal (Captain)
            </button>
            
            <button 
              className="action-button exchange" 
              onClick={() => handleAction('exchange')}
            >
              Exchange Cards (Ambassador)
            </button>
          </div>
        )}
        
        {/* Challenge/Block options when another player takes an action */}
        {currentGame.gameState === 'action_response' && 
         currentGame.currentAction && 
         currentGame.currentAction.action.playerId !== playerId &&
         !currentPlayer?.eliminated &&  // Ensure player is not eliminated
         !currentGame.currentAction.responses.some(r => r.playerId === playerId) && (
          <div id="reaction-buttons">
            <h3>React to {currentGame.players.find(p => p.id === currentGame.currentAction?.action.playerId)?.name}'s {currentGame.currentAction.action.type} action:</h3>
            
            {/* Challenge option */}
            {['tax', 'assassinate', 'steal', 'exchange'].includes(currentGame.currentAction.action.type) && (
              <button 
                className="reaction-button challenge" 
                onClick={handleChallenge}
              >
                Challenge (They don't have the required character)
              </button>
            )}
            
            {/* Block options based on action type */}
            {currentGame.currentAction.action.type === 'foreign_aid' && (
              <button 
                className="reaction-button block" 
                onClick={() => handleBlock('Duke')}
              >
                Block with Duke
              </button>
            )}
            
            {currentGame.currentAction.action.type === 'assassinate' && 
              currentGame.currentAction.action.target === playerId && (
              <button 
                className="reaction-button block" 
                onClick={() => handleBlock('Contessa')}
              >
                Block with Contessa
              </button>
            )}
            
            {currentGame.currentAction.action.type === 'steal' && 
              currentGame.currentAction.action.target === playerId && (
              <>
                <button 
                  className="reaction-button block" 
                  onClick={() => handleBlock('Captain')}
                >
                  Block with Captain
                </button>
                <button 
                  className="reaction-button block" 
                  onClick={() => handleBlock('Ambassador')}
                >
                  Block with Ambassador
                </button>
              </>
            )}
            
            <button 
              className="reaction-button pass" 
              onClick={handlePass}
            >
              Pass (Allow action)
            </button>
          </div>
        )}
        
        {/* Lose influence section */}
        {currentGame.gameState === 'lose_influence' && 
         currentGame.pendingActionFrom === playerId && 
         !currentPlayer?.eliminated && 
         currentPlayer?.cards.some(card => !card.eliminated) && (
          <div id="lose-influence-section">
            <h3>You must lose influence! Select a card to lose:</h3>
            <div className="reveal-card-options">
              {currentPlayer?.cards
                .filter(card => !card.eliminated)
                .map((card, index) => {
                  // Get the real index in the original array
                  const originalIndex = currentPlayer.cards.findIndex(
                    (c) => c === card
                  );
                  return (
                    <button 
                      key={index}
                      className={`card-button ${card.character.toLowerCase()}`}
                      onClick={() => handleLoseInfluence(originalIndex)}
                    >
                      {card.character}
                    </button>
                  );
                })
              }
            </div>
          </div>
        )}
        
        {/* Show a message when eliminated during an action */}
        {currentGame.gameState === 'lose_influence' && 
         currentGame.pendingActionFrom === playerId && 
         (!currentPlayer?.cards.some(card => !card.eliminated)) && (
          <div id="lose-influence-section" className="eliminated-message">
            <h3>You have been eliminated!</h3>
            <p>You lost all influence and are out of the game.</p>
          </div>
        )}
        
        {/* Card reveal for challenges */}
        {currentGame.gameState === 'reveal_challenge' && 
         currentGame.pendingActionFrom === playerId &&
         !currentPlayer?.eliminated &&
         currentPlayer?.cards.some(card => !card.eliminated) && (
          <div id="reveal-card-section">
            <h3>Choose a card to reveal to respond to the challenge:</h3>
            <div className="reveal-card-options">
              {currentPlayer?.cards
                .filter(card => !card.eliminated)
                .map((card, index) => {
                  // Get the real index in the original array
                  const originalIndex = currentPlayer.cards.findIndex(
                    (c) => c === card
                  );
                  return (
                    <button 
                      key={index}
                      className={`card-button ${card.character.toLowerCase()}`}
                      onClick={() => handleRevealCard(originalIndex)}
                    >
                      {card.character}
                    </button>
                  );
                })
              }
            </div>
          </div>
        )}
        
        {/* Show a message when eliminated during an Assassinate action while in reveal state */}
        {currentGame.gameState === 'reveal_challenge' && 
         currentGame.pendingActionFrom === playerId && 
         (currentPlayer?.eliminated || !currentPlayer?.cards.some(card => !card.eliminated)) && (
          <div id="reveal-card-section" className="eliminated-message">
            <h3>You have been eliminated!</h3>
            <p>You lost all influence and are out of the game.</p>
          </div>
        )}
        
        {/* Block response options */}
        {currentGame.gameState === 'block_response' && (
          <div id="block-response-section">
            <h3>
              {currentGame.players.find(p => p.id === currentGame.currentAction?.block?.blockerId)?.name} 
              blocked with {currentGame.currentAction?.block?.character}.
            </h3>
            
            {/* Special message explaining that initiator's response resolves immediately */}
            {currentGame.currentAction?.action.playerId === playerId && 
             !currentGame.currentAction?.responses.some(r => r.playerId === playerId) && (
              <div className="initiator-note">
                <p>Your action was blocked. Your response will resolve this immediately.</p>
              </div>
            )}
            
            {/* If the initiator has challenged a block, show waiting message */}
            {currentGame.currentAction?.action.playerId !== playerId && 
             currentGame.currentAction?.responses.some(r => 
               r.playerId === currentGame.currentAction?.action.playerId && r.type === 'challenge'
             ) && (
              <div className="waiting-message">
                <p>Waiting for the result of {currentGame.players.find(p => p.id === currentGame.currentAction?.action.playerId)?.name}'s challenge...</p>
              </div>
            )}
            
            {/* Only non-eliminated players who aren't the blocker can challenge or pass */}
            {currentGame.currentAction?.block?.blockerId !== playerId && 
             /* Players can respond to blocks even if they already responded to the original action */
             !currentGame.currentAction?.responses.some(r => 
               r.playerId === playerId && 
               /* Only check for responses made in the block response phase */
               currentGame.gameState === 'block_response'
             ) && 
             !currentPlayer?.eliminated && (
              <div className="block-response-buttons">
                <button 
                  className="challenge-block-button"
                  onClick={() => handleChallengeBlock()}
                >
                  Challenge Block (They don't have {currentGame.currentAction.block?.character})
                </button>
                
                {/* Only the initiator gets the Accept Block button */}
                {currentGame.currentAction?.action.playerId === playerId ? (
                  <button 
                    className="accept-block-button initiator"
                    onClick={handleAcceptBlock}
                  >
                    Accept Block (Your action fails)
                  </button>
                ) : (
                  <button 
                    className="pass-button"
                    onClick={handlePass}
                  >
                    Pass (Don't challenge)
                  </button>
                )}
              </div>
            )}
            
            {/* Show if player has already responded */}
            {currentGame.currentAction?.responses.some(r => r.playerId === playerId) && !currentPlayer?.eliminated && (
              <div>You've responded to this block. Waiting for other players...</div>
            )}
            
            {/* Show for eliminated players */}
            {currentPlayer?.eliminated && (
              <div>You have been eliminated and cannot participate.</div>
            )}
          </div>
        )}
      </div>

      <div id="players-container">
        {currentGame.players.map(player => (
          <div 
            key={player.id} 
            className={`player-area ${player.id === playerId ? 'current' : ''} ${player.eliminated ? 'eliminated' : ''}`}
            data-player-id={player.id}
          >
            <div className="player-name">{player.name} {player.id === playerId && '(You)'}</div>
            <div className="player-coins">Coins: {player.coins}</div>
            <div className="player-cards">
              {player.eliminated ? (
                <div className="player-eliminated-status">Eliminated</div>
              ) : (
                player.cards
                  .filter(card => !card.eliminated)
                  .map((card, idx) => (
                    <div 
                      key={idx} 
                      className={`card ${card.character.toLowerCase()} ${player.id === playerId ? 'revealed' : ''}`}
                      data-card-index={idx}
                    >
                      <div className="card-name">
                        {player.id === playerId ? card.character : "Hidden"}
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        ))}
      </div>

      <div id="game-log">
        <h3>Game Log</h3>
        <div id="log-entries">
          {currentGame.logs ? 
            currentGame.logs.map((entry, idx) => (
              <div key={idx} className="log-entry">{entry.message}</div>
            )) : 
            <div className="log-entry">No logs available</div>
          }
        </div>
      </div>
      
      {/* Target selection UI overlay */}
      {showTargetSelection && currentGame && (
        <TargetSelection
          players={currentGame.players}
          currentPlayerId={playerId || ''}
          onSelectTarget={handleSelectTarget}
          onCancel={handleCancelTargetSelection}
          actionType={currentActionType}
        />
      )}
      
      {/* Exchange card selection overlay */}
      {currentGame && currentGame.gameState === 'exchange_selection' && 
       currentGame.currentAction?.action.playerId === playerId && 
       currentGame.currentAction.exchangeCards && 
       currentPlayer && (
        <CardReveal
          activeCards={currentPlayer.cards.filter(card => !card.eliminated)}
          drawnCards={currentGame.currentAction.exchangeCards}
          maxSelect={currentPlayer.cards.filter(card => !card.eliminated).length}
          onComplete={handleCompleteExchange}
          onCancel={handleCancelExchange}
        />
      )}
    </>
  );
}