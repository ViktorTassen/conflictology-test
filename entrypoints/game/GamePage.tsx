import { useEffect, useState } from 'react';
import { Game } from '@/domain/types/game';
import { useGameStore } from '@/store/gameStore';
import { TargetSelection } from '@/components/TargetSelection';
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
    revealCard
  } = useGameStore();
  
  // State for target selection
  const [showTargetSelection, setShowTargetSelection] = useState(false);
  const [currentActionType, setCurrentActionType] = useState<string>('');

  // Subscribe to game updates
  useEffect(() => {
    if (!gameId) {
      return;
    }

    if (playerId === null) {
      return;
    }

    const unsubscribe = subscribeToGame(gameId);
    return () => unsubscribe();
  }, [gameId, playerId, subscribeToGame]);

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
  
  // Handle game actions
  const handleAction = async (actionType: string, targetId?: string) => {
    if (!gameId || !playerId) return;
    
    try {
      console.log(`Performing action: ${actionType}`, targetId ? `with target: ${targetId}` : '');
      
      // Actually perform the action using the gameService
      await performAction(gameId, {
        type: actionType,
        playerId,
        target: targetId
      });
      
      console.log('Action performed successfully');
    } catch (error) {
      console.error('Failed to perform action:', error);
    }
  };
  
  // Handle blocking an action
  const handleBlock = async (character: string) => {
    if (!gameId || !playerId || !currentGame.currentAction) return;
    
    try {
      console.log(`Blocking with ${character}`);
      await blockAction(gameId, playerId, character as any);
      console.log('Block performed successfully');
    } catch (error) {
      console.error('Failed to block action:', error);
    }
  };
  
  // Handle challenging an action
  const handleChallenge = async () => {
    if (!gameId || !playerId || !currentGame.currentAction) return;
    
    try {
      console.log('Challenging action');
      await challengeAction(gameId, playerId);
      console.log('Challenge performed successfully');
    } catch (error) {
      console.error('Failed to challenge action:', error);
    }
  };
  
  // Handle revealing a card (for challenges)
  const handleRevealCard = async (cardIndex: number) => {
    if (!gameId || !playerId) return;
    
    try {
      console.log(`Revealing card ${cardIndex}`);
      await revealCard(gameId, playerId, cardIndex);
      console.log('Card revealed successfully');
    } catch (error) {
      console.error('Failed to reveal card:', error);
    }
  };
  
  // Handle accepting a block (no need to reveal card)
  const handleAcceptBlock = async () => {
    if (!gameId || !playerId || !currentGame.currentAction) return;
    
    try {
      console.log('Accepting block');
      // Use accept_block action to handle accepting block
      await performAction(gameId, {
        type: 'accept_block',
        playerId
      });
      console.log('Block accepted successfully');
    } catch (error) {
      console.error('Failed to accept block:', error);
    }
  };
  
  // Handle challenging a block
  const handleChallengeBlock = async () => {
    if (!gameId || !playerId || !currentGame.currentAction) return;
    
    try {
      console.log('Challenging block');
      // Use challenge_block action to handle challenging the block
      await performAction(gameId, {
        type: 'challenge_block',
        playerId
      });
      console.log('Block challenged successfully');
    } catch (error) {
      console.error('Failed to challenge block:', error);
    }
  };
  
  // Handle passing (allowing action)
  const handlePass = async () => {
    if (!gameId || !playerId || !currentGame.currentAction) return;
    
    try {
      console.log('Passing - allowing action');
      // For pass, we use a special action type 'pass'
      await performAction(gameId, {
        type: 'pass',
        playerId
      });
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
          {currentGame.gameState === 'gameover' && 'Game Over'}
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
          {currentGame.gameState === 'play' && isCurrentTurn && 
            "It's your turn! Select an action below:"}
            
          {currentGame.gameState === 'play' && !isCurrentTurn && 
            `Waiting for ${currentGame.players[currentGame.currentPlayerIndex]?.name} to take an action...`}
            
          {currentGame.gameState === 'action' && currentGame.currentAction && 
            ((currentGame.actionResponses && currentGame.actionResponses.includes(playerId)) ? 
              `You've responded to ${currentGame.players.find(p => p.id === currentGame.currentAction?.playerId)?.name}'s ${currentGame.currentAction.type}. Waiting for other players...` : 
              `${currentGame.players.find(p => p.id === currentGame.currentAction?.playerId)?.name} performed ${currentGame.currentAction.type}. You can challenge or block.`)}
            
          {currentGame.gameState === 'challenge' && 
            (currentGame.currentAction?.playerId === playerId ? 
              `Your action was challenged! You must reveal a card to prove you have the required character.` : 
              `${currentGame.players.find(p => p.id === currentGame.currentAction?.playerId)?.name}'s action was challenged. Waiting for them to respond...`)}
            
          {currentGame.gameState === 'block' && 
            (currentGame.currentAction?.playerId === playerId ? 
              `Your action was blocked! You can challenge the block (if you think they don't have the character) or accept it.` : 
              `${currentGame.players.find(p => p.id === currentGame.currentAction?.playerId)?.name}'s action was blocked. Waiting for them to respond...`)}
              
          {currentGame.gameState === 'coup_response' && 
            (currentGame.currentAction?.responderId === playerId ? 
              `You've been couped by ${currentGame.players.find(p => p.id === currentGame.currentAction?.playerId)?.name}! Select a card to lose.` : 
              `${currentGame.players.find(p => p.id === currentGame.currentAction?.responderId)?.name} is choosing which card to lose after being couped.`)}
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
        {currentGame.gameState === 'action' && 
         currentGame.currentAction && 
         currentGame.currentAction.playerId !== playerId &&
         !currentPlayer?.eliminated &&
         (!currentGame.actionResponses || !currentGame.actionResponses.includes(playerId)) && (
          <div id="reaction-buttons">
            <h3>React to {currentGame.players.find(p => p.id === currentGame.currentAction?.playerId)?.name}'s {currentGame.currentAction.type} action:</h3>
            
            {/* Challenge option */}
            {['tax', 'assassinate', 'steal', 'exchange'].includes(currentGame.currentAction.type) && (
              <button 
                className="reaction-button challenge" 
                onClick={handleChallenge}
              >
                Challenge (They don't have the required character)
              </button>
            )}
            
            {/* Block options based on action type */}
            {currentGame.currentAction.type === 'foreign_aid' && (
              <button 
                className="reaction-button block" 
                onClick={() => handleBlock('Duke')}
              >
                Block with Duke
              </button>
            )}
            
            {currentGame.currentAction.type === 'assassinate' && (
              <button 
                className="reaction-button block" 
                onClick={() => handleBlock('Contessa')}
              >
                Block with Contessa
              </button>
            )}
            
            {currentGame.currentAction.type === 'steal' && (
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
        
        {/* Coup response - let player choose which card to lose */}
        {currentGame.gameState === 'coup_response' && currentGame.currentAction?.responderId === playerId && (
          <div id="coup-response-section">
            <h3>You've been couped! Select a card to lose:</h3>
            <div className="reveal-card-options">
              {currentPlayer?.cards.map((card, index) => (
                !card.eliminated && (
                  <button 
                    key={index}
                    className={`card-button ${card.character.toLowerCase()}`}
                    onClick={() => handleRevealCard(index)}
                  >
                    {card.character}
                  </button>
                )
              ))}
            </div>
          </div>
        )}
        
        {/* Card reveal for challenges */}
        {currentGame.gameState === 'challenge' && currentGame.currentAction?.playerId === playerId && (
          <div id="reveal-card-section">
            <h3>Choose a card to reveal to respond to the challenge:</h3>
            <div className="reveal-card-options">
              {currentPlayer?.cards.map((card, index) => (
                !card.eliminated && (
                  <button 
                    key={index}
                    className={`card-button ${card.character.toLowerCase()}`}
                    onClick={() => handleRevealCard(index)}
                  >
                    {card.character}
                  </button>
                )
              ))}
            </div>
          </div>
        )}
        
        {/* Block response options - for the active player who was blocked */}
        {currentGame.gameState === 'block' && currentGame.currentAction?.playerId === playerId && (
          <div id="block-response-section">
            <h3>Your action was blocked! How do you respond?</h3>
            
            <div className="block-response-buttons">
              <button 
                className="challenge-block-button"
                onClick={() => handleChallengeBlock()}
              >
                Challenge Block (They don't have the character)
              </button>
              
              <button 
                className="accept-block-button"
                onClick={handleAcceptBlock}
              >
                Accept Block (Your action fails)
              </button>
            </div>
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
          {currentGame.log.map((entry, idx) => (
            <div key={idx} className="log-entry">{entry}</div>
          ))}
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
    </>
  );
}