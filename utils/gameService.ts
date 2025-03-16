import { db } from './firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  onSnapshot,
  Timestamp,
  arrayUnion
} from 'firebase/firestore';

// Game types
export interface Card {
  character: string;
  eliminated: boolean;
}

export interface Player {
  id: number;
  name: string;
  coins: number;
  cards: Card[];
  eliminated: boolean;
}

export interface GameAction {
  type: string;
  player?: Player;
  target?: Player;
  character?: string;
  blockableBy?: string[];
  challengeable?: boolean;
  loseInfluence?: boolean;
  reason?: string; // For tracking why an influence is being lost (e.g., "assassination")
}

export interface GameState {
  id: string;
  players: Player[];
  deck: Card[];
  currentPlayerIndex: number;
  gameState: 'setup' | 'play' | 'gameover';
  treasury: number;
  log: string[];
  pendingAction: GameAction | null;
  pendingTarget: Player | null;
  pendingBlockBy: { player: Player, character: string } | null;
  pendingExchangeCards: Card[];
  nextPendingAction?: GameAction | null; // For special cases like double influence loss
  lastUpdated: Timestamp;
  newGameVotes?: number[]; // Array of player IDs who have voted for a new game
  winner?: Player; // The winner of the game when it ends
  actionResponders?: number[]; // Array of player IDs who have already responded to the current pending action
}

// Collection reference
const gamesCollection = collection(db, 'games');

// Terminate game when host leaves
export const terminateGame = async (gameId: string): Promise<boolean> => {
  try {
    const gameRef = doc(gamesCollection, gameId);
    const gameDoc = await getDoc(gameRef);
    
    if (!gameDoc.exists()) {
      throw new Error('Game not found');
    }
    
    // Add termination log and set game state to gameover
    await updateDoc(gameRef, {
      gameState: 'gameover',
      log: arrayUnion('Game terminated because the host left'),
      lastUpdated: Timestamp.now()
    });
    
    return true;
  } catch (error) {
    console.error('Error terminating game:', error);
    throw error;
  }
};

// Vote for a new game
export const voteForNewGame = async (gameId: string, playerId: number): Promise<boolean> => {
  try {
    const gameRef = doc(gamesCollection, gameId);
    const gameDoc = await getDoc(gameRef);
    
    if (!gameDoc.exists()) {
      throw new Error('Game not found');
    }
    
    const gameData = gameDoc.data() as GameState;
    
    // Game must be over to vote for a new game
    if (gameData.gameState !== 'gameover') {
      throw new Error('Cannot vote for a new game while current game is in progress');
    }
    
    // Check if player exists
    const player = gameData.players.find(p => p.id === playerId);
    if (!player) {
      throw new Error('Player not found');
    }
    
    // Allow eliminated players to vote - remove the elimination check
    
    // Initialize newGameVotes if it doesn't exist
    const newGameVotes = gameData.newGameVotes || [];
    
    // Check if player has already voted
    if (newGameVotes.includes(playerId)) {
      throw new Error('You have already voted for a new game');
    }
    
    // Add player's vote
    const updatedVotes = [...newGameVotes, playerId];
    
    // Add log entry
    const logEntry = `${gameData.players.find(p => p.id === playerId)?.name} voted to start a new game`;
    
    // Check if all players have voted (including eliminated players)
    const allPlayers = gameData.players;
    const allVoted = allPlayers.every(p => updatedVotes.includes(p.id));
    
    await updateDoc(gameRef, {
      newGameVotes: updatedVotes,
      log: arrayUnion(logEntry),
      lastUpdated: Timestamp.now()
    });
    
    // If all players have voted, start a new game
    if (allVoted) {
      await startNewGameWithSamePlayers(gameId, gameData);
    }
    
    return true;
  } catch (error) {
    console.error('Error voting for new game:', error);
    throw error;
  }
};

// Start a new game with the same players
const startNewGameWithSamePlayers = async (gameId: string, oldGameData: GameState): Promise<boolean> => {
  try {
    const gameRef = doc(gamesCollection, gameId);
    
    // Create a fresh deck
    const characters = ['Duke', 'Assassin', 'Captain', 'Ambassador', 'Contessa'];
    const deck: Card[] = [];
    
    for (const character of characters) {
      for (let i = 0; i < 3; i++) {
        deck.push({ character, eliminated: false });
      }
    }
    
    // Shuffle the deck
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    
    // Reset all players
    const updatedPlayers = oldGameData.players.map(player => {
      // Deal 2 new cards to each player
      const newCards = [deck.pop()!, deck.pop()!];
      
      return {
        ...player,
        coins: 2, // Reset coins
        cards: newCards,
        eliminated: false
      };
    });
    
    // New game state
    const newGameState: GameState = {
      id: gameId,
      players: updatedPlayers,
      deck,
      currentPlayerIndex: 0, // First player starts
      gameState: 'play',
      treasury: 50 - (updatedPlayers.length * 2), // Remove coins given to players
      log: ['New game started with the same players', `${updatedPlayers.length} players: ${updatedPlayers.map(p => p.name).join(', ')}`, `${updatedPlayers[0].name}'s turn`],
      pendingAction: null,
      pendingTarget: null,
      pendingBlockBy: null,
      pendingExchangeCards: [],
      lastUpdated: Timestamp.now()
    };
    
    // Update game in Firestore
    await setDoc(gameRef, newGameState);
    
    return true;
  } catch (error) {
    console.error('Error starting new game:', error);
    throw error;
  }
};

// Create a new game
export const createGame = async (gameId: string, playerName: string): Promise<string> => {
  try {
    const gameRef = doc(gamesCollection, gameId);
    const gameDoc = await getDoc(gameRef);
    
    // Check if game already exists
    if (gameDoc.exists()) {
      throw new Error('Game with this ID already exists');
    }

    // Create a fresh deck
    const characters = ['Duke', 'Assassin', 'Captain', 'Ambassador', 'Contessa'];
    const deck: Card[] = [];
    
    for (const character of characters) {
      for (let i = 0; i < 3; i++) {
        deck.push({ character, eliminated: false });
      }
    }

    // Shuffle the deck
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    // Initialize game with first player
    const player: Player = {
      id: 0,
      name: playerName,
      coins: 2,
      cards: [deck.pop()!, deck.pop()!], // Deal 2 cards
      eliminated: false
    };

    const initialState: GameState = {
      id: gameId,
      players: [player],
      deck,
      currentPlayerIndex: 0,
      gameState: 'setup',
      treasury: 50 - 2, // Remove coins given to player
      log: [`Game created by ${playerName}`, 'Waiting for other players to join...'],
      pendingAction: null,
      pendingTarget: null, 
      pendingBlockBy: null,
      pendingExchangeCards: [],
      lastUpdated: Timestamp.now()
    };

    await setDoc(gameRef, initialState);
    return gameId;
  } catch (error) {
    console.error('Error creating game:', error);
    throw error;
  }
};

// Join an existing game
export const joinGame = async (gameId: string, playerName: string): Promise<boolean> => {
  try {
    const gameRef = doc(gamesCollection, gameId);
    const gameDoc = await getDoc(gameRef);
    
    if (!gameDoc.exists()) {
      throw new Error('Game not found');
    }
    
    const gameData = gameDoc.data() as GameState;
    
    // Check if game is already in progress
    if (gameData.gameState !== 'setup') {
      throw new Error('Game already in progress');
    }
    
    // Check if max players reached (cap at 6)
    if (gameData.players.length >= 6) {
      throw new Error('Game is full');
    }
    
    // Check if player name is already taken
    if (gameData.players.some(p => p.name === playerName)) {
      throw new Error('Player name already taken');
    }
    
    // Create a new player
    const newPlayerId = gameData.players.length;
    const newPlayer: Player = {
      id: newPlayerId,
      name: playerName,
      coins: 2,
      cards: [gameData.deck.pop()!, gameData.deck.pop()!], // Deal 2 cards
      eliminated: false
    };
    
    // Update game state
    await updateDoc(gameRef, {
      players: [...gameData.players, newPlayer],
      deck: gameData.deck,
      treasury: gameData.treasury - 2, // Remove coins given to player
      log: arrayUnion(`${playerName} joined the game`),
      lastUpdated: Timestamp.now()
    });
    
    return true;
  } catch (error) {
    console.error('Error joining game:', error);
    throw error;
  }
};

// Start game
export const startGame = async (gameId: string, playerId: number): Promise<boolean> => {
  try {
    const gameRef = doc(gamesCollection, gameId);
    const gameDoc = await getDoc(gameRef);
    
    if (!gameDoc.exists()) {
      throw new Error('Game not found');
    }
    
    const gameData = gameDoc.data() as GameState;
    
    // Check if game already started
    if (gameData.gameState !== 'setup') {
      throw new Error('Game already started');
    }
    
    // Verify that the player requesting to start is the creator (player 0)
    if (playerId !== 0) {
      throw new Error('Only the game creator can start the game');
    }
    
    // Need at least 2 players to start
    if (gameData.players.length < 2) {
      throw new Error('Need at least 2 players to start');
    }
    
    // Update game state
    await updateDoc(gameRef, {
      gameState: 'play',
      log: arrayUnion('Game started', `${gameData.players.length} players: ${gameData.players.map(p => p.name).join(', ')}`, `${gameData.players[0].name}'s turn`),
      lastUpdated: Timestamp.now()
    });
    
    return true;
  } catch (error) {
    console.error('Error starting game:', error);
    throw error;
  }
};

// Subscribe to game changes
export const subscribeToGame = (gameId: string, callback: (game: GameState) => void) => {
  const gameRef = doc(gamesCollection, gameId);
  
  return onSnapshot(gameRef, (snapshot) => {
    if (snapshot.exists()) {
      callback(snapshot.data() as GameState);
    } else {
      console.error('Game not found');
    }
  });
};

// Basic game actions
export const performIncome = async (gameId: string, playerId: number) => {
  try {
    const gameRef = doc(gamesCollection, gameId);
    const gameDoc = await getDoc(gameRef);
    
    if (!gameDoc.exists()) {
      throw new Error('Game not found');
    }
    
    const gameData = gameDoc.data() as GameState;
    
    // Check if it's the player's turn
    if (gameData.currentPlayerIndex !== playerId) {
      throw new Error('Not your turn');
    }
    
    // Find the player
    const player = gameData.players.find(p => p.id === playerId);
    if (!player) {
      throw new Error('Player not found');
    }
    
    // Check if player has 10 or more coins (must coup)
    if (player.coins >= 10) {
      throw new Error('You have 10 or more coins. You must perform a Coup action.');
    }
    
    // Get player index for updating
    const playerIndex = gameData.players.findIndex(p => p.id === playerId);
    
    // Clone players array to avoid mutation
    const updatedPlayers = [...gameData.players];
    
    // Add 1 coin to player
    updatedPlayers[playerIndex] = {
      ...updatedPlayers[playerIndex],
      coins: updatedPlayers[playerIndex].coins + 1
    };
    
    // Subtract from treasury
    const updatedTreasury = gameData.treasury - 1;
    
    // Add log entry
    const logEntry = `${updatedPlayers[playerIndex].name} took Income (+1 coin)`;
    
    // Calculate next player index
    const nextPlayerIndex = findNextPlayerIndex(updatedPlayers, playerIndex);
    
    // Update game state
    await updateDoc(gameRef, {
      players: updatedPlayers,
      treasury: updatedTreasury,
      pendingAction: null,
      currentPlayerIndex: nextPlayerIndex,
      log: arrayUnion(logEntry),
      lastUpdated: Timestamp.now()
    });
    
    return true;
  } catch (error) {
    console.error('Error performing Income action:', error);
    throw error;
  }
};

export const performForeignAid = async (gameId: string, playerId: number) => {
  try {
    const gameRef = doc(gamesCollection, gameId);
    const gameDoc = await getDoc(gameRef);
    
    if (!gameDoc.exists()) {
      throw new Error('Game not found');
    }
    
    const gameData = gameDoc.data() as GameState;
    
    // Check if it's the player's turn
    if (gameData.currentPlayerIndex !== playerId) {
      throw new Error('Not your turn');
    }
    
    // Find the player
    const player = gameData.players.find(p => p.id === playerId);
    if (!player) {
      throw new Error('Player not found');
    }
    
    // Check if player has 10 or more coins (must coup)
    if (player.coins >= 10) {
      throw new Error('You have 10 or more coins. You must perform a Coup action.');
    }
    
    // Add pending action for foreign aid (can be blocked by Duke)
    const pendingAction: GameAction = {
      type: 'foreignAid',
      player: player,
      blockableBy: ['Duke']
    };
    
    // Add log entry
    const logEntry = `${player.name} is attempting Foreign Aid (+2 coins)`;
    
    // Reset the action responders since this is a new action
    const actionResponders = [playerId]; // The player who initiated the action has implicitly responded
    
    // Update game state
    await updateDoc(gameRef, {
      pendingAction: pendingAction,
      actionResponders: actionResponders,
      log: arrayUnion(logEntry),
      lastUpdated: Timestamp.now()
    });
    
    return true;
  } catch (error) {
    console.error('Error performing Foreign Aid action:', error);
    throw error;
  }
};

export const performTax = async (gameId: string, playerId: number) => {
  try {
    const gameRef = doc(gamesCollection, gameId);
    const gameDoc = await getDoc(gameRef);
    
    if (!gameDoc.exists()) {
      throw new Error('Game not found');
    }
    
    const gameData = gameDoc.data() as GameState;
    
    // Check if it's the player's turn
    if (gameData.currentPlayerIndex !== playerId) {
      throw new Error('Not your turn');
    }
    
    // Find the player
    const player = gameData.players.find(p => p.id === playerId);
    if (!player) {
      throw new Error('Player not found');
    }
    
    // Check if player has 10 or more coins (must coup)
    if (player.coins >= 10) {
      throw new Error('You have 10 or more coins. You must perform a Coup action.');
    }
    
    // Add pending action for tax (can be challenged)
    const pendingAction: GameAction = {
      type: 'tax',
      player: player,
      character: 'Duke',
      challengeable: true
    };
    
    // Add log entry
    const logEntry = `${player.name} is attempting Tax (as Duke, +3 coins)`;
    
    // Reset the action responders since this is a new action
    const actionResponders = [playerId]; // The player who initiated the action has implicitly responded
    
    // Update game state
    await updateDoc(gameRef, {
      pendingAction: pendingAction,
      actionResponders: actionResponders,
      log: arrayUnion(logEntry),
      lastUpdated: Timestamp.now()
    });
    
    return true;
  } catch (error) {
    console.error('Error performing Tax action:', error);
    throw error;
  }
};

export const performAssassinate = async (gameId: string, playerId: number, targetId: number) => {
  try {
    const gameRef = doc(gamesCollection, gameId);
    const gameDoc = await getDoc(gameRef);
    
    if (!gameDoc.exists()) {
      throw new Error('Game not found');
    }
    
    const gameData = gameDoc.data() as GameState;
    
    // Check if it's the player's turn
    if (gameData.currentPlayerIndex !== playerId) {
      throw new Error('Not your turn');
    }
    
    // Find the player and target
    const player = gameData.players.find(p => p.id === playerId);
    const target = gameData.players.find(p => p.id === targetId);
    
    if (!player) {
      throw new Error('Player not found');
    }
    
    // Check if player has 10 or more coins (must coup)
    if (player.coins >= 10) {
      throw new Error('You have 10 or more coins. You must perform a Coup action.');
    }
    
    if (!target) {
      throw new Error('Target player not found');
    }
    
    // Check if player has enough coins
    if (player.coins < 3) {
      throw new Error('Not enough coins to assassinate');
    }
    
    // Deduct 3 coins
    const updatedPlayers = [...gameData.players];
    const playerIndex = updatedPlayers.findIndex(p => p.id === playerId);
    updatedPlayers[playerIndex] = {
      ...updatedPlayers[playerIndex],
      coins: updatedPlayers[playerIndex].coins - 3
    };
    
    // Add to treasury
    const updatedTreasury = gameData.treasury + 3;
    
    // Add pending action for assassination (can be challenged or blocked by Contessa)
    const pendingAction: GameAction = {
      type: 'assassinate',
      player: player,
      character: 'Assassin',
      challengeable: true,
      target: target,
      blockableBy: ['Contessa']
    };
    
    // Add log entry
    const logEntry = `${player.name} is attempting to Assassinate (as Assassin) ${target.name}`;
    
    // Reset the action responders since this is a new action
    const actionResponders = [playerId]; // The player who initiated the action has implicitly responded
    
    // Update game state
    await updateDoc(gameRef, {
      players: updatedPlayers,
      treasury: updatedTreasury,
      pendingAction: pendingAction,
      actionResponders: actionResponders,
      log: arrayUnion(logEntry),
      lastUpdated: Timestamp.now()
    });
    
    return true;
  } catch (error) {
    console.error('Error performing Assassinate action:', error);
    throw error;
  }
};

export const performSteal = async (gameId: string, playerId: number, targetId: number) => {
  try {
    const gameRef = doc(gamesCollection, gameId);
    const gameDoc = await getDoc(gameRef);
    
    if (!gameDoc.exists()) {
      throw new Error('Game not found');
    }
    
    const gameData = gameDoc.data() as GameState;
    
    // Check if it's the player's turn
    if (gameData.currentPlayerIndex !== playerId) {
      throw new Error('Not your turn');
    }
    
    // Find the player and target
    const player = gameData.players.find(p => p.id === playerId);
    const target = gameData.players.find(p => p.id === targetId);
    
    if (!player) {
      throw new Error('Player not found');
    }
    
    // Check if player has 10 or more coins (must coup)
    if (player.coins >= 10) {
      throw new Error('You have 10 or more coins. You must perform a Coup action.');
    }
    
    if (!target) {
      throw new Error('Target player not found');
    }
    
    // Check if target has coins
    if (target.coins === 0) {
      throw new Error('Target has no coins to steal');
    }
    
    // Add pending action for steal (can be challenged or blocked by Captain/Ambassador)
    const pendingAction: GameAction = {
      type: 'steal',
      player: player,
      character: 'Captain',
      challengeable: true,
      target: target,
      blockableBy: ['Captain', 'Ambassador']
    };
    
    // Add log entry
    const logEntry = `${player.name} is attempting to Steal (as Captain) from ${target.name}`;
    
    // Reset the action responders since this is a new action
    const actionResponders = [playerId]; // The player who initiated the action has implicitly responded
    
    // Update game state
    await updateDoc(gameRef, {
      pendingAction: pendingAction,
      actionResponders: actionResponders,
      log: arrayUnion(logEntry),
      lastUpdated: Timestamp.now()
    });
    
    return true;
  } catch (error) {
    console.error('Error performing Steal action:', error);
    throw error;
  }
};

export const performExchange = async (gameId: string, playerId: number) => {
  try {
    const gameRef = doc(gamesCollection, gameId);
    const gameDoc = await getDoc(gameRef);
    
    if (!gameDoc.exists()) {
      throw new Error('Game not found');
    }
    
    const gameData = gameDoc.data() as GameState;
    
    // Check if it's the player's turn
    if (gameData.currentPlayerIndex !== playerId) {
      throw new Error('Not your turn');
    }
    
    // Find the player
    const player = gameData.players.find(p => p.id === playerId);
    if (!player) {
      throw new Error('Player not found');
    }
    
    // Check if player has 10 or more coins (must coup)
    if (player.coins >= 10) {
      throw new Error('You have 10 or more coins. You must perform a Coup action.');
    }
    
    // Add pending action for exchange (can be challenged)
    const pendingAction: GameAction = {
      type: 'exchange',
      player: player,
      character: 'Ambassador',
      challengeable: true
    };
    
    // Add log entry
    const logEntry = `${player.name} is attempting to Exchange cards (as Ambassador)`;
    
    // Reset the action responders since this is a new action
    const actionResponders = [playerId]; // The player who initiated the action has implicitly responded
    
    // Update game state
    await updateDoc(gameRef, {
      pendingAction: pendingAction,
      actionResponders: actionResponders,
      log: arrayUnion(logEntry),
      lastUpdated: Timestamp.now()
    });
    
    return true;
  } catch (error) {
    console.error('Error performing Exchange action:', error);
    throw error;
  }
};

export const performCoup = async (gameId: string, playerId: number, targetId: number) => {
  try {
    const gameRef = doc(gamesCollection, gameId);
    const gameDoc = await getDoc(gameRef);
    
    if (!gameDoc.exists()) {
      throw new Error('Game not found');
    }
    
    const gameData = gameDoc.data() as GameState;
    
    // Check if it's the player's turn
    if (gameData.currentPlayerIndex !== playerId) {
      throw new Error('Not your turn');
    }
    
    // Find the player and target
    const player = gameData.players.find(p => p.id === playerId);
    const target = gameData.players.find(p => p.id === targetId);
    
    if (!player) {
      throw new Error('Player not found');
    }
    
    if (!target) {
      throw new Error('Target player not found');
    }
    
    // Check if player has enough coins
    if (player.coins < 7) {
      throw new Error('Not enough coins to coup');
    }
    
    // Deduct 7 coins
    const updatedPlayers = [...gameData.players];
    const playerIndex = updatedPlayers.findIndex(p => p.id === playerId);
    updatedPlayers[playerIndex] = {
      ...updatedPlayers[playerIndex],
      coins: updatedPlayers[playerIndex].coins - 7
    };
    
    // Add to treasury
    const updatedTreasury = gameData.treasury + 7;
    
    // Add pending action for coup
    const pendingAction: GameAction = {
      type: 'coup',
      player: player,
      target: target,
      loseInfluence: true
    };
    
    // Add log entry
    const logEntry = `${player.name} launched a Coup against ${target.name}`;
    
    // Update game state
    await updateDoc(gameRef, {
      players: updatedPlayers,
      treasury: updatedTreasury,
      pendingAction: pendingAction,
      log: arrayUnion(logEntry),
      lastUpdated: Timestamp.now()
    });
    
    return true;
  } catch (error) {
    console.error('Error performing Coup action:', error);
    throw error;
  }
};

// Helper function to find the next player
function findNextPlayerIndex(players: Player[], currentIndex: number): number {
  const startIndex = (currentIndex + 1) % players.length;
  let index = startIndex;
  
  do {
    // If this player is alive, return their index
    if (!players[index].eliminated && players[index].cards.some(card => !card.eliminated)) {
      return index;
    }
    
    // Move to next player
    index = (index + 1) % players.length;
  } while (index !== startIndex);
  
  // If no alive players were found (shouldn't happen), return the current index
  return currentIndex;
}

// Challenge an action
export const performChallenge = async (gameId: string, challengerId: number) => {
  try {
    const gameRef = doc(gamesCollection, gameId);
    const gameDoc = await getDoc(gameRef);
    
    if (!gameDoc.exists()) {
      throw new Error('Game not found');
    }
    
    const gameData = gameDoc.data() as GameState;
    
    // Check if challenger is eliminated
    const playerChallenger = gameData.players.find(p => p.id === challengerId);
    if (!playerChallenger) {
      throw new Error('Challenger not found');
    }
    
    if (playerChallenger.eliminated) {
      throw new Error('Eliminated players cannot challenge actions');
    }
    
    // Check if there's a pending action that can be challenged
    if (!gameData.pendingAction || !gameData.pendingAction.challengeable) {
      throw new Error('No challengeable action pending');
    }
    const challenged = gameData.pendingAction.player;
    
    if (!playerChallenger) {
      throw new Error('Challenger not found');
    }
    
    if (!challenged) {
      throw new Error('Challenged player not found');
    }
    
    // Check if player has already responded to this action
    const actionResponders = gameData.actionResponders || [];
    if (actionResponders.includes(challengerId)) {
      throw new Error('You have already responded to this action');
    }
    
    // Add this player to the action responders list since they have responded with a challenge
    actionResponders.push(challengerId);
    
    // Add log entry
    const logEntry = `${playerChallenger.name} challenges ${challenged.name}'s claim to have ${gameData.pendingAction.character}`;
    
    // Check if player actually has the claimed character
    const hasCharacter = challenged.cards.some(card => 
      !card.eliminated && card.character === gameData.pendingAction.character
    );
    
    if (hasCharacter) {
      // Challenge failed - the player had the card
      // Find the card index
      const cardIndex = challenged.cards.findIndex(card => 
        !card.eliminated && card.character === gameData.pendingAction.character
      );
      
      // Get the card and create a copy of the deck
      const revealedCard = { ...challenged.cards[cardIndex] };
      let updatedDeck = [...gameData.deck, revealedCard];
      
      // Shuffle the deck
      for (let i = updatedDeck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [updatedDeck[i], updatedDeck[j]] = [updatedDeck[j], updatedDeck[i]];
      }
      
      // Draw a new card for the challenged player
      const newCard = updatedDeck.pop();
      
      // Update the challenged player's cards
      const updatedPlayers = [...gameData.players];
      const challengedIndex = updatedPlayers.findIndex(p => p.id === challenged.id);
      
      if (newCard) {
        updatedPlayers[challengedIndex] = {
          ...updatedPlayers[challengedIndex],
          cards: updatedPlayers[challengedIndex].cards.map((card, i) => 
            i === cardIndex ? newCard : card
          )
        };
      }
      
      // Challenger loses influence (will be prompted to choose which influence to lose)
      // Add a pendingAction for losing influence
      const pendingAction: GameAction = {
        type: 'loseInfluence',
        player: playerChallenger,
        loseInfluence: true
      };
      
      // Add log entries
      const failedLog = `Challenge failed! ${challenged.name} reveals ${gameData.pendingAction.character}`;
      const returnLog = `${challenged.name} returns the revealed card to the deck and draws a new one`;
      const loseLog = `${playerChallenger.name} loses influence`;
      
      // Special handling for assassination challenges where the challenger is the target
      const wasAssassination = gameData.pendingAction.type === 'assassinate';
      const challengerIsTarget = wasAssassination && gameData.pendingAction.target?.id === playerChallenger.id;
      
      if (wasAssassination && challengerIsTarget) {
        // For assassination challenges where challenger is target, immediately eliminate the player
        // First, mark all their cards as eliminated
        const challengerIndex = updatedPlayers.findIndex(p => p.id === playerChallenger.id);
        
        // Make sure we have an updated deck to work with
        const updatedDeckCopy = [...updatedDeck];
        
        // Mark each card as eliminated and add to deck
        updatedPlayers[challengerIndex].cards.forEach(card => {
          if (!card.eliminated) {
            card.eliminated = true;
            // Return card to deck
            updatedDeckCopy.push({ ...card, eliminated: false });
          }
        });
        
        // Update our reference to the updated deck
        updatedDeck = updatedDeckCopy;
        
        // Mark player as eliminated
        updatedPlayers[challengerIndex].eliminated = true;
        
        // Add special log messages
        const eliminatedLog = `${playerChallenger.name} is eliminated after losing challenge to assassination`;
        
        // Check if game is over after elimination
        const remainingPlayers = updatedPlayers.filter(p => !p.eliminated);
        let gameStateValue = gameData.gameState;
        let winner = undefined;
        let additionalLogs = [];
        
        if (remainingPlayers.length === 1) {
          gameStateValue = 'gameover';
          winner = remainingPlayers[0];
          additionalLogs.push(`Game over! ${remainingPlayers[0].name} wins!`);
          additionalLogs.push('Players may vote to start a new game with the same participants.');
        }
        
        // Update game state - player eliminated, possibly game over
        // Determine next player
        const nextPlayerIndex = findNextPlayerIndex(updatedPlayers, gameData.currentPlayerIndex);
        
        if (winner) {
          await updateDoc(gameRef, {
            players: updatedPlayers,
            deck: updatedDeck,
            pendingAction: null,
            currentPlayerIndex: nextPlayerIndex,
            gameState: gameStateValue,
            winner: winner,
            newGameVotes: [],
            log: arrayUnion(logEntry, failedLog, returnLog, eliminatedLog, ...additionalLogs),
            lastUpdated: Timestamp.now()
          });
        } else {
          await updateDoc(gameRef, {
            players: updatedPlayers,
            deck: updatedDeck,
            pendingAction: null,
            currentPlayerIndex: nextPlayerIndex,
            log: arrayUnion(logEntry, failedLog, returnLog, eliminatedLog),
            lastUpdated: Timestamp.now()
          });
        }
      } else {
        // Regular challenge failure - only lose one influence
        await updateDoc(gameRef, {
          players: updatedPlayers,
          deck: updatedDeck,
          pendingAction: pendingAction,
          log: arrayUnion(logEntry, failedLog, returnLog, loseLog),
          lastUpdated: Timestamp.now()
        });
      }
      
      return true;
    } else {
      // Challenge succeeded - the player didn't have the card
      // Challenged player loses influence
      const updatedPlayers = [...gameData.players];
      const challengedIndex = updatedPlayers.findIndex(p => p.id === challenged.id);
      
      // Add a pendingAction for losing influence
      const pendingAction: GameAction = {
        type: 'loseInfluence',
        player: challenged,
        loseInfluence: true
      };
      
      // Add log entries
      const succeededLog = `Challenge succeeded! ${challenged.name} does not have ${gameData.pendingAction.character}`;
      
      // Update game state
      await updateDoc(gameRef, {
        players: updatedPlayers,
        pendingAction: pendingAction,
        log: arrayUnion(logEntry, succeededLog),
        lastUpdated: Timestamp.now()
      });
      
      return true;
    }
  } catch (error) {
    console.error('Error performing challenge:', error);
    throw error;
  }
};

// Block an action
export const performBlock = async (gameId: string, blockerId: number, blockingCharacter: string) => {
  try {
    const gameRef = doc(gamesCollection, gameId);
    const gameDoc = await getDoc(gameRef);
    
    if (!gameDoc.exists()) {
      throw new Error('Game not found');
    }
    
    const gameData = gameDoc.data() as GameState;
    
    // Check if blocker is eliminated
    const playerBlocker = gameData.players.find(p => p.id === blockerId);
    if (!playerBlocker) {
      throw new Error('Blocker not found');
    }
    
    if (playerBlocker.eliminated) {
      throw new Error('Eliminated players cannot block actions');
    }
    
    // Check if there's a pending action that can be blocked
    if (!gameData.pendingAction || !gameData.pendingAction.blockableBy || !gameData.pendingAction.blockableBy.includes(blockingCharacter)) {
      throw new Error('No blockable action pending or invalid blocking character');
    }
    const blocked = gameData.pendingAction.player;
    
    if (!playerBlocker) {
      throw new Error('Blocker not found');
    }
    
    if (!blocked) {
      throw new Error('Blocked player not found');
    }
    
    // Check that player is not trying to block their own action
    if (blocked.id === blockerId) {
      throw new Error('You cannot block your own action');
    }
    
    // Check if player has already responded to this action
    const actionResponders = gameData.actionResponders || [];
    if (actionResponders.includes(blockerId)) {
      throw new Error('You have already responded to this action');
    }
    
    // Add this player to the action responders list
    actionResponders.push(blockerId);
    
    // Create blockBy object
    const pendingBlockBy = {
      player: playerBlocker,
      character: blockingCharacter
    };
    
    // Add log entry
    const logEntry = `${playerBlocker.name} blocks with ${blockingCharacter}`;
    
    // Update game state
    await updateDoc(gameRef, {
      pendingBlockBy: pendingBlockBy,
      actionResponders: actionResponders,
      log: arrayUnion(logEntry),
      lastUpdated: Timestamp.now()
    });
    
    return true;
  } catch (error) {
    console.error('Error performing block:', error);
    throw error;
  }
};

// Challenge a block
export const performChallengeBlock = async (gameId: string, challengerId: number) => {
  try {
    const gameRef = doc(gamesCollection, gameId);
    const gameDoc = await getDoc(gameRef);
    
    if (!gameDoc.exists()) {
      throw new Error('Game not found');
    }
    
    const gameData = gameDoc.data() as GameState;
    
    // Check if challenger is eliminated
    const blockChallenger = gameData.players.find(p => p.id === challengerId);
    if (!blockChallenger) {
      throw new Error('Challenger not found');
    }
    
    if (blockChallenger.eliminated) {
      throw new Error('Eliminated players cannot challenge blocks');
    }
    
    // Check if there's a pending block that can be challenged
    if (!gameData.pendingBlockBy) {
      throw new Error('No block to challenge');
    }
    const challenged = gameData.pendingBlockBy.player;
    const claimedCharacter = gameData.pendingBlockBy.character;
    
    if (!blockChallenger) {
      throw new Error('Challenger not found');
    }
    
    if (!challenged) {
      throw new Error('Challenged blocker not found');
    }
    
    // Add log entry
    const logEntry = `${blockChallenger.name} challenges ${challenged.name}'s claim to have ${claimedCharacter}`;
    
    // Check if blocker actually has the claimed character
    const hasCharacter = challenged.cards.some(card => 
      !card.eliminated && card.character === claimedCharacter
    );
    
    if (hasCharacter) {
      // Challenge failed - the blocker had the card
      // Find the card index
      const cardIndex = challenged.cards.findIndex(card => 
        !card.eliminated && card.character === claimedCharacter
      );
      
      // Get the card and create a copy of the deck
      const revealedCard = { ...challenged.cards[cardIndex] };
      let updatedDeck = [...gameData.deck, revealedCard];
      
      // Shuffle the deck
      for (let i = updatedDeck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [updatedDeck[i], updatedDeck[j]] = [updatedDeck[j], updatedDeck[i]];
      }
      
      // Draw a new card for the challenged blocker
      const newCard = updatedDeck.pop();
      
      // Update the challenged blocker's cards
      const updatedPlayers = [...gameData.players];
      const challengedIndex = updatedPlayers.findIndex(p => p.id === challenged.id);
      
      if (newCard) {
        updatedPlayers[challengedIndex] = {
          ...updatedPlayers[challengedIndex],
          cards: updatedPlayers[challengedIndex].cards.map((card, i) => 
            i === cardIndex ? newCard : card
          )
        };
      }
      
      // Challenger loses influence
      // Add a pendingAction for losing influence
      const pendingAction: GameAction = {
        type: 'loseInfluence',
        player: blockChallenger,
        loseInfluence: true
      };
      
      // Add log entries
      const failedLog = `Challenge failed! ${challenged.name} reveals ${claimedCharacter}`;
      const returnLog = `${challenged.name} returns the revealed card to the deck and draws a new one`;
      const loseLog = `${blockChallenger.name} loses influence`;
      const blockLog = `${challenged.name}'s block succeeds`;
      
      // Update game state - block succeeds
      await updateDoc(gameRef, {
        players: updatedPlayers,
        deck: updatedDeck,
        pendingAction: pendingAction,
        pendingBlockBy: null,
        log: arrayUnion(logEntry, failedLog, returnLog, loseLog, blockLog),
        lastUpdated: Timestamp.now()
      });
      
      return true;
    } else {
      // Challenge succeeded - the blocker didn't have the card
      // Blocker loses influence
      const updatedPlayers = [...gameData.players];
      const challengedIndex = updatedPlayers.findIndex(p => p.id === challenged.id);
      
      // Check if this was an assassination being blocked
      const wasAssassination = gameData.pendingAction?.type === 'assassinate';
      
      // Add log entries
      const succeededLog = `Challenge succeeded! ${challenged.name} does not have ${claimedCharacter}`;
      const failedLog = `${challenged.name}'s block fails`;
      let extraLogs = [];
      
      // Special handling for assassination
      if (wasAssassination && gameData.pendingAction?.target?.id === challenged.id) {
        // The failed blocker is also the assassination target
        // Immediately eliminate the player (all cards)
        
        const challengedIndex = updatedPlayers.findIndex(p => p.id === challenged.id);
        
        // Create updated deck
        const updatedDeck = [...gameData.deck];
        
        // Mark each card as eliminated and add to deck
        updatedPlayers[challengedIndex].cards.forEach(card => {
          if (!card.eliminated) {
            card.eliminated = true;
            // Return card to deck
            updatedDeck.push({ ...card, eliminated: false });
          }
        });
        
        // Mark player as eliminated
        updatedPlayers[challengedIndex].eliminated = true;
        
        // Add special log message
        const eliminatedLog = `${challenged.name} is eliminated after failing to block assassination`;
        extraLogs.push(eliminatedLog);
        
        // Check if game is over after elimination
        const remainingPlayers = updatedPlayers.filter(p => !p.eliminated);
        let gameStateValue = gameData.gameState;
        let winner = undefined;
        
        if (remainingPlayers.length === 1) {
          gameStateValue = 'gameover';
          winner = remainingPlayers[0];
          extraLogs.push(`Game over! ${remainingPlayers[0].name} wins!`);
          extraLogs.push('Players may vote to start a new game with the same participants.');
        }
        
        // Calculate next player index
        const nextPlayerIndex = findNextPlayerIndex(updatedPlayers, gameData.currentPlayerIndex);
        
        // Update game state
        if (winner) {
          await updateDoc(gameRef, {
            players: updatedPlayers,
            pendingAction: null,
            pendingBlockBy: null,
            currentPlayerIndex: nextPlayerIndex,
            gameState: gameStateValue,
            winner: winner,
            newGameVotes: [],
            deck: updatedDeck,
            log: arrayUnion(logEntry, succeededLog, failedLog, ...extraLogs),
            lastUpdated: Timestamp.now()
          });
        } else {
          await updateDoc(gameRef, {
            players: updatedPlayers,
            pendingAction: null,
            pendingBlockBy: null,
            currentPlayerIndex: nextPlayerIndex,
            deck: updatedDeck,
            log: arrayUnion(logEntry, succeededLog, failedLog, ...extraLogs),
            lastUpdated: Timestamp.now()
          });
        }
      } else {
        // Standard case for failed blocks (non-assassination or block by a different player)
        const pendingAction: GameAction = {
          type: 'loseInfluence',
          player: challenged,
          loseInfluence: true
        };
        
        // Update game state - original action continues
        await updateDoc(gameRef, {
          players: updatedPlayers,
          pendingAction: pendingAction,
          pendingBlockBy: null,
          log: arrayUnion(logEntry, succeededLog, failedLog),
          lastUpdated: Timestamp.now()
        });
      }
      
      return true;
    }
  } catch (error) {
    console.error('Error performing block challenge:', error);
    throw error;
  }
};

// Lose influence (choose a card to eliminate)
export const performLoseInfluence = async (gameId: string, playerId: number, cardIndex: number) => {
  try {
    const gameRef = doc(gamesCollection, gameId);
    const gameDoc = await getDoc(gameRef);
    
    if (!gameDoc.exists()) {
      throw new Error('Game not found');
    }
    
    const gameData = gameDoc.data() as GameState;
    
    // Check if there's a pending action for losing influence
    const isCoupOrAssassinate = 
      gameData.pendingAction?.type === 'coup' || 
      gameData.pendingAction?.type === 'assassinate';
      
    const isLoseInfluence = 
      gameData.pendingAction?.type === 'loseInfluence' && 
      gameData.pendingAction?.loseInfluence;
    
    if (!isLoseInfluence && !isCoupOrAssassinate) {
      throw new Error('No lose influence action pending');
    }
    
    // Check if this is the player who needs to lose influence
    const isTargetOfAction = isCoupOrAssassinate && gameData.pendingAction?.target?.id === playerId;
    const isPlayerOfLoseInfluence = isLoseInfluence && gameData.pendingAction?.player?.id === playerId;
    
    if (!isTargetOfAction && !isPlayerOfLoseInfluence) {
      throw new Error('Not your turn to lose influence');
    }
    
    // Get the player
    const player = gameData.players.find(p => p.id === playerId);
    if (!player) {
      throw new Error('Player not found');
    }
    
    // Get live cards (not eliminated)
    const aliveCards = player.cards.filter(card => !card.eliminated);
    
    // Update players array
    const updatedPlayers = [...gameData.players];
    const playerIndex = updatedPlayers.findIndex(p => p.id === playerId);
    
    // If player has only one card left, immediately eliminate them
    if (aliveCards.length === 1) {
      // Get the last alive card to return to deck
      const lastCardIndex = player.cards.findIndex(card => !card.eliminated);
      const lastCard = player.cards[lastCardIndex];
      
      console.log(`Player ${playerId} has only one card. Automatically eliminating player.`);
      
      // Update all cards to be eliminated
      const updatedCards = player.cards.map(card => ({
        ...card,
        eliminated: true
      }));
      
      // Update the player's cards and mark as eliminated
      updatedPlayers[playerIndex] = {
        ...updatedPlayers[playerIndex],
        cards: updatedCards,
        eliminated: true
      };
      
      // Return the card to the deck
      const updatedDeck = [...gameData.deck, { ...lastCard, eliminated: false }];
      
      // Shuffle the deck
      for (let i = updatedDeck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [updatedDeck[i], updatedDeck[j]] = [updatedDeck[j], updatedDeck[i]];
      }
      
      // Replace original deck with updated deck
      gameData.deck = updatedDeck;
    } else {
      // Multiple cards - player selects which to lose
      let finalCardIndex = cardIndex;
      
      // Check if the card exists and is not already eliminated
      if (!player.cards[finalCardIndex] || player.cards[finalCardIndex].eliminated) {
        throw new Error('Invalid card selection');
      }
      
      // Create a deep copy of the player's cards
      const updatedCards = [...updatedPlayers[playerIndex].cards];
      updatedCards[finalCardIndex] = {
        ...updatedCards[finalCardIndex],
        eliminated: true
      };
      
      // Update the player with the new cards
      updatedPlayers[playerIndex] = {
        ...updatedPlayers[playerIndex],
        cards: updatedCards
      };
      
      // Check if the player is now eliminated (all cards eliminated)
      const isEliminated = updatedCards.every(card => card.eliminated);
      if (isEliminated) {
        updatedPlayers[playerIndex].eliminated = true;
      }
    }
    
    // Create log messages
    let logEntry;
    let updatedDeck;
    
    if (aliveCards.length === 1) {
      // Player was completely eliminated
      logEntry = `${player.name} was eliminated`;
      updatedDeck = gameData.deck; // Deck was already updated in the elimination logic
    } else {
      // Player lost one influence but still has cards
      const eliminatedCharacter = player.cards[cardIndex].character;
      
      // Return the eliminated card to the deck
      updatedDeck = [...gameData.deck];
      updatedDeck.push({ character: eliminatedCharacter, eliminated: false });
      
      // Shuffle the deck
      for (let i = updatedDeck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [updatedDeck[i], updatedDeck[j]] = [updatedDeck[j], updatedDeck[i]];
      }
      
      // Add log entry without revealing the card
      logEntry = `${player.name} lost influence`;
    }
    
    // Determine next player if the current action is complete
    const originalAction = gameData.pendingAction.type;
    let nextPlayerIndex = gameData.currentPlayerIndex;
    
    // For these actions, we move to the next player's turn
    if (originalAction === 'loseInfluence' || originalAction === 'coup' || originalAction === 'assassinate') {
      // These actions end the turn when completed
      nextPlayerIndex = findNextPlayerIndex(updatedPlayers, gameData.currentPlayerIndex);
    }
    
    // Check if game is over (only one player left)
    const alivePlayers = updatedPlayers.filter(p => !p.eliminated && p.cards.some(c => !c.eliminated));
    let gameStateValue: 'setup' | 'play' | 'gameover' = gameData.gameState;
    let winner = undefined;
    
    if (alivePlayers.length === 1) {
      gameStateValue = 'gameover';
      winner = alivePlayers[0];
      const winnerLog = `Game over! ${alivePlayers[0].name} wins!`;
      const newGameLog = 'Players may vote to start a new game with the same participants.';
      await updateDoc(gameRef, {
        log: arrayUnion(winnerLog, newGameLog),
        winner: alivePlayers[0],
        newGameVotes: []
      });
    }
    
    // Check if there's a next pending action (for double influence loss cases)
    const nextPendingAction = gameData.nextPendingAction as GameAction | undefined;
    
    // If there is a next pending action (e.g., for assassination after failed block challenge)
    if (nextPendingAction && nextPendingAction.type === 'loseInfluence' && nextPendingAction.player?.id === playerId) {
      // For special assassination case, immediately lose the second influence
      // Get the updated player after first influence loss
      const updatedPlayer = updatedPlayers.find(p => p.id === playerId);
      
      if (!updatedPlayer || updatedPlayer.eliminated) {
        // If player is already eliminated after first loss, just clear the nextPendingAction
        await updateDoc(gameRef, {
          players: updatedPlayers,
          pendingAction: null,
          nextPendingAction: null,
          currentPlayerIndex: nextPlayerIndex,
          gameState: gameStateValue,
          deck: updatedDeck,
          log: arrayUnion(logEntry),
          lastUpdated: Timestamp.now()
        });
      } else {
        // Player still has cards - automatically lose the second influence
        const remainingCards = updatedPlayer.cards.filter(card => !card.eliminated);
        
        if (remainingCards.length > 0) {
          // Find the index of the first non-eliminated card
          const secondCardIndex = updatedPlayer.cards.findIndex(card => !card.eliminated);
          
          // Update the player's second card to be eliminated
          updatedPlayer.cards[secondCardIndex].eliminated = true;
          
          // Get the character that was eliminated for the second card
          const secondEliminatedCharacter = updatedPlayer.cards[secondCardIndex].character;
          
          // Return the eliminated card to the deck
          updatedDeck.push({ character: secondEliminatedCharacter, eliminated: false });
          
          // Check if player is now eliminated
          if (updatedPlayer.cards.every(card => card.eliminated)) {
            updatedPlayer.eliminated = true;
          }
          
          // Add log entries
          const reason = nextPendingAction.reason ? ` due to ${nextPendingAction.reason}` : '';
          const secondLoseLog = `${player.name} automatically lost second influence${reason}`;
          const secondCardLog = `${player.name} lost influence`;
          
          // Recheck if game is over after second card loss
          const remainingPlayers = updatedPlayers.filter(p => !p.eliminated && p.cards.some(c => !c.eliminated));
          if (remainingPlayers.length === 1) {
            gameStateValue = 'gameover';
            winner = remainingPlayers[0];
            const winnerLog = `Game over! ${remainingPlayers[0].name} wins!`;
            const newGameLog = 'Players may vote to start a new game with the same participants.';
            
            await updateDoc(gameRef, {
              players: updatedPlayers,
              pendingAction: null,
              nextPendingAction: null,
              currentPlayerIndex: nextPlayerIndex,
              gameState: gameStateValue,
              deck: updatedDeck,
              log: arrayUnion(logEntry, secondLoseLog, secondCardLog, winnerLog, newGameLog),
              winner: remainingPlayers[0],
              newGameVotes: [],
              lastUpdated: Timestamp.now()
            });
          } else {
            // Game continues
            await updateDoc(gameRef, {
              players: updatedPlayers,
              pendingAction: null,
              nextPendingAction: null,
              currentPlayerIndex: nextPlayerIndex,
              gameState: gameStateValue,
              deck: updatedDeck,
              log: arrayUnion(logEntry, secondLoseLog, secondCardLog),
              lastUpdated: Timestamp.now()
            });
          }
        } else {
          // No remaining cards (shouldn't happen, but just in case)
          await updateDoc(gameRef, {
            players: updatedPlayers,
            pendingAction: null,
            nextPendingAction: null,
            currentPlayerIndex: nextPlayerIndex,
            gameState: gameStateValue,
            deck: updatedDeck,
            log: arrayUnion(logEntry),
            lastUpdated: Timestamp.now()
          });
        }
      }
    } else {
      // Normal case - action is complete
      await updateDoc(gameRef, {
        players: updatedPlayers,
        pendingAction: null,
        nextPendingAction: null, // Clear any next pending action
        currentPlayerIndex: nextPlayerIndex,
        gameState: gameStateValue,
        deck: updatedDeck,
        log: arrayUnion(logEntry),
        lastUpdated: Timestamp.now()
      });
    }
    
    return true;
  } catch (error) {
    console.error('Error performing lose influence:', error);
    throw error;
  }
};

// Exchange cards (for Ambassador action)
export const performExchangeCards = async (gameId: string, playerId: number, selectedCardIndices: number[]) => {
  try {
    const gameRef = doc(gamesCollection, gameId);
    const gameDoc = await getDoc(gameRef);
    
    if (!gameDoc.exists()) {
      throw new Error('Game not found');
    }
    
    const gameData = gameDoc.data() as GameState;
    
    // Check if there's a pending exchange action
    if (!gameData.pendingAction || gameData.pendingAction.type !== 'exchange') {
      throw new Error('No exchange action pending');
    }
    
    // Check if this is the player who needs to exchange cards
    if (gameData.pendingAction.player?.id !== playerId) {
      throw new Error('Not your turn to exchange cards');
    }
    
    // Get the player
    const player = gameData.players.find(p => p.id === playerId);
    if (!player) {
      throw new Error('Player not found');
    }
    
    // Check if pendingExchangeCards exists (should have been set when exchange was initiated)
    if (!gameData.pendingExchangeCards || gameData.pendingExchangeCards.length === 0) {
      // Draw 2 cards from the deck
      const drawnCards = [];
      const updatedDeck = [...gameData.deck];
      
      for (let i = 0; i < 2; i++) {
        if (updatedDeck.length > 0) {
          const card = updatedDeck.pop()!;
          drawnCards.push(card);
        }
      }
      
      // Update the exchange cards
      await updateDoc(gameRef, {
        deck: updatedDeck,
        pendingExchangeCards: drawnCards,
        lastUpdated: Timestamp.now()
      });
      
      // Re-fetch the game data with the drawn cards
      const updatedGameDoc = await getDoc(gameRef);
      if (!updatedGameDoc.exists()) {
        throw new Error('Game not found after drawing cards');
      }
      
      const updatedGameData = updatedGameDoc.data() as GameState;
      if (!updatedGameData.pendingExchangeCards || updatedGameData.pendingExchangeCards.length === 0) {
        throw new Error('Failed to draw cards for exchange');
      }
      
      // Return early - the UI will show the exchange panel
      return true;
    }
    
    // Validate the number of selected cards
    const playerInfluenceCount = player.cards.filter(card => !card.eliminated).length;
    if (selectedCardIndices.length !== playerInfluenceCount) {
      throw new Error(`You must select exactly ${playerInfluenceCount} cards`);
    }
    
    // Combine player's non-eliminated cards and drawn cards
    const playerAliveCards = player.cards.filter(card => !card.eliminated);
    const allCards = [...playerAliveCards, ...gameData.pendingExchangeCards];
    
    // Validate the selected indices
    if (selectedCardIndices.some(index => index < 0 || index >= allCards.length)) {
      throw new Error('Invalid card selection');
    }
    
    // Create the new set of cards for the player and the cards to return
    const newPlayerCards = selectedCardIndices.map(index => allCards[index]);
    const returnCards = allCards.filter((_, index) => !selectedCardIndices.includes(index));
    
    // Update the player's cards
    const updatedPlayers = [...gameData.players];
    const playerIndex = updatedPlayers.findIndex(p => p.id === playerId);
    
    // Create a new array of cards, preserving eliminated ones
    const updatedCards = [...updatedPlayers[playerIndex].cards];
    let newCardIndex = 0;
    
    for (let i = 0; i < updatedCards.length; i++) {
      if (!updatedCards[i].eliminated && newCardIndex < newPlayerCards.length) {
        updatedCards[i] = newPlayerCards[newCardIndex++];
      }
    }
    
    // Update the player with the new cards
    updatedPlayers[playerIndex] = {
      ...updatedPlayers[playerIndex],
      cards: updatedCards
    };
    
    // Add the return cards back to the deck
    const updatedDeck = [...gameData.deck, ...returnCards];
    
    // Shuffle the deck
    for (let i = updatedDeck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [updatedDeck[i], updatedDeck[j]] = [updatedDeck[j], updatedDeck[i]];
    }
    
    // Determine the next player
    const nextPlayerIndex = findNextPlayerIndex(updatedPlayers, playerIndex);
    
    // Add log entry
    const logEntry = `${player.name} exchanged cards`;
    
    // Update game state
    await updateDoc(gameRef, {
      players: updatedPlayers,
      deck: updatedDeck,
      pendingAction: null,
      pendingExchangeCards: [],
      currentPlayerIndex: nextPlayerIndex,
      log: arrayUnion(logEntry),
      lastUpdated: Timestamp.now()
    });
    
    return true;
  } catch (error) {
    console.error('Error performing exchange cards:', error);
    throw error;
  }
};

// Allow a pending action to proceed (no challenge/block)
export const allowActionToProceed = async (gameId: string, playerId: number) => {
  try {
    const gameRef = doc(gamesCollection, gameId);
    const gameDoc = await getDoc(gameRef);
    
    if (!gameDoc.exists()) {
      throw new Error('Game not found');
    }
    
    const gameData = gameDoc.data() as GameState;
    
    // Check if player is eliminated
    const actionPlayer = gameData.players.find(p => p.id === playerId);
    if (!actionPlayer) {
      throw new Error('Player not found');
    }
    
    if (actionPlayer.eliminated) {
      throw new Error('Eliminated players cannot participate in the game');
    }
    
    // Check if there's a pending block that needs to be accepted
    if (gameData.pendingBlockBy) {
      // Handle accepting a block - just clear the pending action and block
      const blockedPlayer = gameData.pendingAction?.player?.name || "Player";
      const blockingPlayer = gameData.pendingBlockBy.player.name;
      const blockingCharacter = gameData.pendingBlockBy.character;
      
      // Update game state - action is blocked, move to next player
      const currentPlayerIndex = gameData.currentPlayerIndex;
      const nextPlayerIndex = findNextPlayerIndex(gameData.players, currentPlayerIndex);
      
      const logEntry = `${blockedPlayer}'s action was blocked by ${blockingPlayer}'s ${blockingCharacter}`;
      
      await updateDoc(gameRef, {
        pendingAction: null,
        pendingBlockBy: null,
        actionResponders: [],
        currentPlayerIndex: nextPlayerIndex,
        log: arrayUnion(logEntry),
        lastUpdated: Timestamp.now()
      });
      
      return true;
    }
    
    // Regular action processing - no block involved
    
    // Check if there's a pending action
    if (!gameData.pendingAction) {
      throw new Error('No action pending');
    }
    
    // Add this player to the action responders list
    const actionResponders = gameData.actionResponders || [];
    if (!actionResponders.includes(playerId)) {
      actionResponders.push(playerId);
    }
    
    // Get the action type early so we can use it for special cases
    const actionType = gameData.pendingAction.type;
    
    // Check if all living non-initiating players have responded
    const nonInitiatingPlayers = gameData.players
      .filter(p => !p.eliminated && p.cards.some(c => !c.eliminated)) // Only living players
      .filter(p => p.id !== gameData.pendingAction?.player?.id); // Exclude the player who initiated the action
    
    // Consider eliminated players as having already responded
    const allResponded = nonInitiatingPlayers.every(p => actionResponders.includes(p.id));
    
    // If not all players have responded yet, just update the responders list and return
    if (!allResponded) {
      // Special handling for exchange - check if cards are already drawn
      if (actionType === 'exchange' && gameData.pendingExchangeCards && gameData.pendingExchangeCards.length > 0) {
        // Cards are already drawn, so this is just a player responding after the fact - just update their vote
        await updateDoc(gameRef, {
          actionResponders: actionResponders, // update this player's vote
          lastUpdated: Timestamp.now()
        });
      } else {
        // Normal case - update responders
        await updateDoc(gameRef, {
          actionResponders: actionResponders,
          lastUpdated: Timestamp.now()
        });
      }
      return true;
    }
    
    // If all players have responded, proceed with the action
    const player = gameData.pendingAction.player;
    
    if (!player) {
      throw new Error('Player not found');
    }
    
    // Handle different action types
    let updatedPlayers = [...gameData.players];
    let updatedDeck = [...gameData.deck];
    let updatedTreasury = gameData.treasury;
    let pendingAction: GameAction | null = null;
    let logEntries: string[] = [];
    
    switch (actionType) {
      case 'foreignAid':
        // Give player 2 coins
        const playerIndex = updatedPlayers.findIndex(p => p.id === player.id);
        updatedPlayers[playerIndex] = {
          ...updatedPlayers[playerIndex],
          coins: updatedPlayers[playerIndex].coins + 2
        };
        updatedTreasury -= 2;
        logEntries.push(`${player.name} took Foreign Aid (+2 coins)`);
        break;
        
      case 'tax':
        // Give player 3 coins
        const taxPlayerIndex = updatedPlayers.findIndex(p => p.id === player.id);
        updatedPlayers[taxPlayerIndex] = {
          ...updatedPlayers[taxPlayerIndex],
          coins: updatedPlayers[taxPlayerIndex].coins + 3
        };
        updatedTreasury -= 3;
        logEntries.push(`${player.name} collected Tax (+3 coins)`);
        break;
        
      case 'steal':
        // Steal up to 2 coins from target
        if (!gameData.pendingAction.target) {
          throw new Error('No target for steal action');
        }
        
        const stealPlayerIndex = updatedPlayers.findIndex(p => p.id === player.id);
        const stealTargetIndex = updatedPlayers.findIndex(p => p.id === gameData.pendingAction.target!.id);
        
        const stealAmount = Math.min(2, updatedPlayers[stealTargetIndex].coins);
        
        updatedPlayers[stealPlayerIndex] = {
          ...updatedPlayers[stealPlayerIndex],
          coins: updatedPlayers[stealPlayerIndex].coins + stealAmount
        };
        
        updatedPlayers[stealTargetIndex] = {
          ...updatedPlayers[stealTargetIndex],
          coins: updatedPlayers[stealTargetIndex].coins - stealAmount
        };
        
        logEntries.push(`${player.name} stole ${stealAmount} coins from ${updatedPlayers[stealTargetIndex].name}`);
        break;
        
      case 'assassinate':
        // Target loses influence (create a pending lose influence action)
        if (!gameData.pendingAction.target) {
          throw new Error('No target for assassinate action');
        }
        
        pendingAction = {
          type: 'loseInfluence',
          player: gameData.pendingAction.target,
          loseInfluence: true
        };
        
        logEntries.push(`${gameData.pendingAction.target.name} must lose influence`);
        break;
        
      case 'exchange':
        // Draw cards for exchange
        const drawnCards = [];
        const exchangeDeck = [...updatedDeck];
        
        // Draw 2 cards from the deck
        for (let i = 0; i < 2; i++) {
          if (exchangeDeck.length > 0) {
            const card = exchangeDeck.pop()!;
            drawnCards.push(card);
          }
        }
        
        // Add log entry
        logEntries.push(`${player.name} can now exchange cards`);
        
        // Update with the drawn cards and keep the same pending action and responders
        // DO NOT reset actionResponders here, as that causes players to need to vote again
        await updateDoc(gameRef, {
          deck: exchangeDeck,
          pendingExchangeCards: drawnCards,
          // Keep existing actionResponders so players don't need to vote again
          log: arrayUnion(`${player.name} is exchanging cards as Ambassador`),
          lastUpdated: Timestamp.now()
        });
        
        return true;
        
      case 'coup':
        // Target loses influence (create a pending lose influence action)
        if (!gameData.pendingAction.target) {
          throw new Error('No target for coup action');
        }
        
        pendingAction = {
          type: 'loseInfluence',
          player: gameData.pendingAction.target,
          loseInfluence: true
        };
        
        logEntries.push(`${gameData.pendingAction.target.name} must lose influence from the Coup`);
        break;
        
      default:
        throw new Error(`Unknown action type: ${actionType}`);
    }
    
    // Determine the next player (if the action is complete)
    let nextPlayerIndex = gameData.currentPlayerIndex;
    if (!pendingAction) {
      nextPlayerIndex = findNextPlayerIndex(updatedPlayers, gameData.currentPlayerIndex);
    }
    
    // Create update object and filter out any undefined values
    const updateObject: any = {
      players: updatedPlayers,
      deck: updatedDeck,
      treasury: updatedTreasury,
      pendingAction: pendingAction,
      pendingBlockBy: null, // Clear the pendingBlockBy when accepting a block
      actionResponders: [],  // Reset the action responders
      currentPlayerIndex: nextPlayerIndex,
      log: arrayUnion(...logEntries),
      lastUpdated: Timestamp.now()
    };
    
    // Remove any undefined values
    Object.keys(updateObject).forEach(key => {
      if (updateObject[key] === undefined) {
        delete updateObject[key];
      }
    });
    
    // Update game state
    await updateDoc(gameRef, updateObject);
    
    return true;
  } catch (error) {
    console.error('Error allowing action to proceed:', error);
    throw error;
  }
};
// - Coup
// - Game completion