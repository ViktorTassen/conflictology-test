import React from 'react';
import ReactDOM from 'react-dom/client';
import { GamePage } from './GamePage';
import './style.css';

const container = document.getElementById('game-container');
if (container) {
  ReactDOM.createRoot(container).render(
    <React.StrictMode>
      <GamePage />
    </React.StrictMode>
  );
}
