import React, { useState, useEffect } from 'react';
import { Card } from '../domain/types/game';

interface CardRevealProps {
  activeCards: Card[];
  drawnCards: Card[];
  maxSelect: number;
  onComplete: (selectedIndices: number[]) => void;
  onCancel: () => void;
}

const CardReveal: React.FC<CardRevealProps> = ({
  activeCards,
  drawnCards,
  maxSelect,
  onComplete,
  onCancel
}) => {
  const [selectedCards, setSelectedCards] = useState<number[]>([]);
  const allCards = [...activeCards, ...drawnCards];
  
  // Clear selection when props change
  useEffect(() => {
    setSelectedCards([]);
  }, [activeCards, drawnCards, maxSelect]);

  const toggleCardSelection = (index: number) => {
    if (selectedCards.includes(index)) {
      // Remove from selection
      setSelectedCards(selectedCards.filter(idx => idx !== index));
    } else {
      // Add to selection if not at max
      if (selectedCards.length < maxSelect) {
        setSelectedCards([...selectedCards, index]);
      }
    }
  };

  const handleComplete = () => {
    // Only allow completion when exactly maxSelect cards are selected
    if (selectedCards.length === maxSelect) {
      console.log('Selected cards indices:', selectedCards);
      onComplete(selectedCards);
    }
  };

  // Style definitions
  const styles = {
    overlay: {
      position: 'fixed' as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      zIndex: 1000,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center'
    },
    container: {
      backgroundColor: '#1a1a1a',
      borderRadius: '8px',
      padding: '20px',
      width: '90%',
      maxWidth: '600px',
      color: 'white',
      boxShadow: '0 4px 8px rgba(0, 0, 0, 0.3)'
    },
    title: {
      textAlign: 'center' as const,
      marginBottom: '20px',
      fontSize: '1.5rem'
    },
    subtitle: {
      textAlign: 'center' as const,
      marginBottom: '15px',
      fontSize: '1rem',
      color: '#aaa'
    },
    cardsContainer: {
      display: 'flex',
      flexWrap: 'wrap' as const,
      gap: '15px',
      justifyContent: 'center',
      marginBottom: '20px'
    },
    cardSection: {
      marginBottom: '20px',
    },
    sectionTitle: {
      fontWeight: 'bold',
      marginBottom: '10px',
      color: '#ddd',
      borderBottom: '1px solid #333',
      paddingBottom: '5px',
    },
    card: {
      width: '100px',
      height: '150px',
      borderRadius: '8px',
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      transition: 'all 0.2s',
      border: '2px solid transparent',
      position: 'relative' as const,
      color: 'white',
      textShadow: '0 1px 2px rgba(0,0,0,0.5)',
      boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
    },
    selectedCard: {
      border: '2px solid #f1c40f',
      transform: 'translateY(-5px)',
      boxShadow: '0 8px 16px rgba(0,0,0,0.3)',
    },
    cardCharacter: {
      fontWeight: 'bold',
      marginBottom: '5px',
      fontSize: '1.1rem',
    },
    selectionIndicator: {
      position: 'absolute' as const,
      top: '5px',
      right: '5px',
      width: '20px',
      height: '20px',
      borderRadius: '50%',
      backgroundColor: '#f1c40f',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      fontWeight: 'bold',
      fontSize: '0.8rem',
      color: '#333',
    },
    buttonContainer: {
      display: 'flex',
      justifyContent: 'center',
      gap: '10px',
      marginTop: '20px',
    },
    button: {
      padding: '10px 20px',
      borderRadius: '4px',
      border: 'none',
      fontWeight: 'bold',
      cursor: 'pointer',
      transition: 'background-color 0.2s',
    },
    completeButton: {
      backgroundColor: '#27ae60',
      color: 'white',
    },
    completeButtonDisabled: {
      backgroundColor: '#2ecc7188',
      color: 'white',
      cursor: 'not-allowed',
    },
    cancelButton: {
      backgroundColor: '#7f8c8d',
      color: 'white',
    },
  };

  // Card background colors based on character type
  const cardColorMap: { [key: string]: string } = {
    Duke: '#3498db',
    Assassin: '#e74c3c',
    Captain: '#2ecc71',
    Ambassador: '#f39c12',
    Contessa: '#9b59b6',
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.container}>
        <div style={styles.title}>Exchange Cards</div>
        <div style={styles.subtitle}>
          {activeCards.length === 1 
            ? `Select ${maxSelect} card to keep from all cards shown below (your current card and the 2 newly drawn cards).` 
            : `Select ${maxSelect} cards to keep. The rest will be returned to the deck.`}
        </div>
        <div style={{...styles.subtitle, fontSize: '0.9rem', color: '#2ecc71'}}>
          {maxSelect === 1 
            ? "You must select exactly 1 card to keep. Choose any card from your current card or the drawn cards."
            : `You must select exactly ${maxSelect} cards to keep.`}
        </div>
        <div style={{...styles.subtitle, fontSize: '0.85rem', color: '#e74c3c', marginTop: '5px'}}>
          {`${activeCards.length + drawnCards.length - maxSelect} cards will be returned to the deck.`}
        </div>

        <div style={styles.cardSection}>
          <div style={styles.sectionTitle}>Your Current Cards:</div>
          <div style={styles.cardsContainer}>
            {activeCards.map((card, index) => (
              <div
                key={`active-${index}`}
                style={{
                  ...styles.card,
                  ...(selectedCards.includes(index) ? styles.selectedCard : {}),
                  backgroundColor: cardColorMap[card.character],
                }}
                onClick={() => toggleCardSelection(index)}
              >
                <div style={styles.cardCharacter}>{card.character}</div>
                {selectedCards.includes(index) && (
                  <div style={styles.selectionIndicator}>
                    {selectedCards.indexOf(index) + 1}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div style={styles.cardSection}>
          <div style={styles.sectionTitle}>Drawn Cards:</div>
          <div style={styles.cardsContainer}>
            {drawnCards.map((card, index) => (
              <div
                key={`drawn-${index}`}
                style={{
                  ...styles.card,
                  ...(selectedCards.includes(index + activeCards.length) ? styles.selectedCard : {}),
                  backgroundColor: cardColorMap[card.character],
                }}
                onClick={() => toggleCardSelection(index + activeCards.length)}
              >
                <div style={styles.cardCharacter}>{card.character}</div>
                {selectedCards.includes(index + activeCards.length) && (
                  <div style={styles.selectionIndicator}>
                    {selectedCards.indexOf(index + activeCards.length) + 1}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div style={styles.buttonContainer}>
          <button
            style={{
              ...styles.button,
              ...styles.cancelButton,
            }}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            style={{
              ...styles.button,
              ...(selectedCards.length === maxSelect ? styles.completeButton : styles.completeButtonDisabled),
            }}
            onClick={handleComplete}
            disabled={selectedCards.length !== maxSelect}
          >
            Confirm Selection
          </button>
        </div>
      </div>
    </div>
  );
};

export default CardReveal;