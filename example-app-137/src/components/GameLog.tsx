import React from 'react';
import { GameLogEntry, LogType, GameState } from '../types';
import { DollarSign, Swords, ShieldAlert, Check, RefreshCcw, Skull, Clock } from 'lucide-react';

interface GameLogProps {
  logs: GameLogEntry[];
  currentPlayer: string;
  currentPlayerColor: string;
  gameState?: GameState;
  selectedAction?: string;
}

const LogIcon = ({ type }: { type: LogType }) => {
  const className = "w-3 h-3";
  
  switch (type) {
    case 'income':
    case 'foreign-aid':
    case 'tax':
    case 'steal':
      return <DollarSign className={className} />;
    case 'assassinate':
    case 'coup':
      return <Skull className={className} />;
    case 'exchange':
    case 'exchange-complete':
      return <RefreshCcw className={className} />;
    case 'block':
      return <ShieldAlert className={className} />;
    case 'challenge':
    case 'challenge-success':
    case 'challenge-fail':
      return <Swords className={className} />;
    case 'allow':
      return <Check className={className} />;
    default:
      return null;
  }
};

const getLogMessage = (log: GameLogEntry): string => {
  switch (log.type) {
    case 'income':
      return 'takes income';
    case 'foreign-aid':
      return 'takes foreign aid';
    case 'tax':
      return 'takes tax as Duke';
    case 'steal':
      return `steals ${log.coins}M from`;
    case 'assassinate':
      return 'assassinates';
    case 'coup':
      return 'launches coup against';
    case 'exchange':
      return 'exchanges cards with the court';
    case 'exchange-complete':
      return 'completes exchange';
    case 'block':
      return `blocks ${log.target}'s ${log.targetCard} with ${log.card}`;
    case 'challenge':
      return 'challenges';
    case 'challenge-success':
      return 'wins challenge against';
    case 'challenge-fail':
      return 'loses challenge against';
    case 'lose-influence':
      return 'loses influence';
    case 'allow':
      return 'allows action';
    default:
      return '';
  }
};

const getLogColor = (type: LogType): string => {
  switch (type) {
    case 'income':
    case 'foreign-aid':
    case 'tax':
    case 'steal':
      return 'text-yellow-500';
    case 'assassinate':
    case 'coup':
    case 'lose-influence':
      return 'text-red-500';
    case 'exchange':
    case 'exchange-complete':
      return 'text-blue-500';
    case 'block':
      return 'text-purple-500';
    case 'challenge':
    case 'challenge-success':
    case 'challenge-fail':
      return 'text-orange-500';
    case 'allow':
      return 'text-green-500';
    default:
      return 'text-gray-400';
  }
};

const getStateMessage = (state: GameState, selectedAction?: string): string => {
  switch (state) {
    case 'waiting_for_action':
      return 'Choose your action';
    case 'waiting_for_target':
      return `Select target for ${selectedAction}`;
    case 'waiting_for_response':
      return 'Waiting for responses';
    case 'waiting_for_exchange':
      return 'Choose cards to exchange';
    default:
      return '';
  }
};

export function GameLog({ logs, currentPlayer, currentPlayerColor, gameState, selectedAction }: GameLogProps) {
  // Reverse logs array to show most recent first
  const lastThreeLogs = [...logs].reverse().slice(0, 3);

  const truncateName = (name: string) => {
    return name.length > 13 ? `${name.slice(0, 12)}...` : name;
  };

  return (
    <div className="backdrop-blur-sm rounded-lg shadow-lg w-full overflow-hidden">
      {/* Current turn indicator */}
      <div className="bg-[#333333] border-b border-white/5 p-2">
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span 
              className="text-sm font-medium"
              style={{ color: currentPlayerColor }}
            >
              {truncateName(currentPlayer)}'s Turn
            </span>
          </div>
          {gameState && (
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Clock className="w-3 h-3" />
              <span>{getStateMessage(gameState, selectedAction)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Game log entries */}
      <div className="p-3 bg-gradient-to-b from-[#2a2a2a]/80 to-transparent">
        <div className="space-y-2">
          {lastThreeLogs.map((log, index) => (
            <div
              key={index}
              className="flex items-center gap-2 text-xs leading-relaxed animate-fade-in"
              style={{ opacity: 1 - index * 0.45 }}
            >
              <div className={`${getLogColor(log.type)}`}>
                <LogIcon type={log.type} />
              </div>
              <div className="flex-1">
                <span 
                  className="font-medium" 
                  style={{ color: log.playerColor }}
                  title={log.player}
                >
                  {truncateName(log.player)}
                </span>
                <span className="text-gray-300 font-medium"> {getLogMessage(log)} </span>
                {log.target && log.type !== 'block' && (
                  <span 
                    className="font-medium" 
                    style={{ color: log.targetColor }}
                    title={log.target}
                  >
                    {truncateName(log.target)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}