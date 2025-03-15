import React from 'react';
import ReactDOM from 'react-dom/client';
import { GamePage } from './GamePage';
import './style.css';

// Mount the React app to the root element
ReactDOM.createRoot(document.getElementById('game-container')!).render(
  <React.StrictMode>
    <GamePage />
  </React.StrictMode>
);