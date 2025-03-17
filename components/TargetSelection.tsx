import React from 'react';
import { Player } from '../domain/types/game';

interface TargetSelectionProps {
  players: Player[];
  currentPlayerId: string;
  onSelectTarget: (targetId: string) => void;
  onCancel: () => void;
  actionType: string;
}

export const TargetSelection: React.FC<TargetSelectionProps> = ({
  players,
  currentPlayerId,
  onSelectTarget,
  onCancel,
  actionType
}) => {
  const validTargets = players.filter(
    player => !player.eliminated && player.id !== currentPlayerId
  );

  // Style definitions
  const styles = {
    overlay: {
      position: 'fixed' as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      zIndex: 1000,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center'
    },
    container: {
      backgroundColor: '#1a1a1a',
      borderRadius: '8px',
      padding: '20px',
      width: '80%',
      maxWidth: '500px',
      color: 'white',
      boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)'
    },
    title: {
      textAlign: 'center' as const,
      marginBottom: '20px',
      fontSize: '1.5rem'
    },
    playerList: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
      gap: '10px',
      marginBottom: '20px'
    },
    playerCard: {
      padding: '15px',
      borderRadius: '4px',
      backgroundColor: '#2a2a2a',
      cursor: 'pointer',
      transition: 'background-color 0.2s',
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      border: '1px solid #444'
    },
    playerName: {
      fontWeight: 'bold',
      marginBottom: '5px'
    },
    playerCoins: {
      color: '#ffd700',
      fontSize: '0.9rem'
    },
    playerCards: {
      display: 'flex',
      gap: '5px',
      marginTop: '5px'
    },
    card: {
      width: '20px',
      height: '30px',
      backgroundColor: '#444',
      borderRadius: '3px',
      border: '1px solid #555'
    },
    buttonContainer: {
      display: 'flex',
      justifyContent: 'center',
      gap: '10px'
    },
    button: {
      padding: '8px 16px',
      borderRadius: '4px',
      border: 'none',
      cursor: 'pointer'
    },
    cancelButton: {
      backgroundColor: '#555',
      color: 'white'
    },
    actionTypeLabel: {
      textTransform: 'capitalize' as const,
      color: '#ff9900'
    }
  };

  const getActionTitle = () => {
    switch(actionType) {
      case 'coup':
        return 'Select a player to coup';
      case 'assassinate':
        return 'Select a player to assassinate';
      case 'steal':
        return 'Select a player to steal from';
      default:
        return 'Select a target';
    }
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.container}>
        <div style={styles.title}>
          {getActionTitle()}
        </div>
        
        {validTargets.length === 0 ? (
          <p>No valid targets available.</p>
        ) : (
          <div style={styles.playerList}>
            {validTargets.map((player) => (
              <div 
                key={player.id}
                style={styles.playerCard}
                onClick={() => onSelectTarget(player.id)}
              >
                <div style={styles.playerName}>{player.name}</div>
                <div style={styles.playerCoins}>{player.coins} coins</div>
                <div style={styles.playerCards}>
                  {Array.from({ length: player.cards.filter(c => !c.eliminated).length }).map((_, i) => (
                    <div key={i} style={styles.card}></div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        
        <div style={styles.buttonContainer}>
          <button 
            style={{...styles.button, ...styles.cancelButton}}
            onClick={onCancel}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default TargetSelection;