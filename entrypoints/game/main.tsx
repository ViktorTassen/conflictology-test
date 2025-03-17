import React from 'react';
import ReactDOM from 'react-dom/client';
import { GamePage } from './GamePage';
import './style.css';

ReactDOM.createRoot(document.getElementById('game-container')).render(
  <React.StrictMode>
    <GamePage />
  </React.StrictMode>
);
