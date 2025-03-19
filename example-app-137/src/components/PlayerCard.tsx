import React from 'react';
import { DollarSign } from 'lucide-react';
import { Player } from '../types';

interface PlayerCardProps {
  player: Player;
  isActive: boolean;
  isTargetable?: boolean;
  isTargeted?: boolean;
  onTargetSelect?: () => void;
}

export function PlayerCard({ 
  player, 
  isActive, 
  isTargetable = false,
  isTargeted = false,
  onTargetSelect 
}: PlayerCardProps) {
  const truncateName = (name: string) => {
    return name.length > 13 ? `${name.slice(0, 12)}...` : name;
  };

  return (
    <div 
      className={`
        relative 
        ${isTargetable ? 'cursor-pointer' : ''}
        ${isTargetable ? 'hover:scale-105' : ''}
        transition-transform duration-200
      `}
      onClick={isTargetable ? onTargetSelect : undefined}
    >
      {/* Target selection glow effect */}
      {(isTargetable || isTargeted) && (
        <div className={`
          absolute -inset-2 rounded-xl
          ${isTargeted ? 'bg-red-500/30 animate-pulse' : 'bg-red-500/0'}
          transition-colors duration-300
          group-hover:bg-red-500/20
          blur-lg
        `} />
      )}

      {/* Player info card */}
      <div className={`
        relative z-10 
        bg-[#2a2a2a]/90 backdrop-blur-sm rounded-lg
        ${isActive ? 'ring-1 ring-yellow-500/50' : ''}
        ${isTargeted ? 'ring-2 ring-red-500/50' : ''}
        ${isTargetable ? 'hover:ring-2 hover:ring-red-500/30' : ''}
        transition-all duration-200
      `}>
        <div className="flex items-center p-1.5 gap-1.5 max-w-[160px]">
          {/* Avatar with active indicator */}
          <div className="relative shrink-0">
            <div className={`
              w-6 h-6 rounded-full overflow-hidden
              ${isActive ? 'ring-2 ring-yellow-500/50 shadow-[0_0_15px_rgba(255,255,255,0.2)]' : ''}
              ${isTargeted ? 'ring-2 ring-red-500/50' : ''}
            `}>
              <img
                src={player.avatar}
                alt={player.name}
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          {/* Name and coins container */}
          <div className="flex-1 min-w-0 flex flex-col gap-0.5">
            {/* Player name */}
            <div className="w-full">
              <span 
                className="text-xs font-medium leading-none block truncate" 
                style={{ color: player.color }}
                title={player.name}
              >
                {truncateName(player.name)}
              </span>
            </div>

            {/* Coins */}
            <div className="flex items-center gap-1 bg-black/20 rounded-full px-1.5 py-0.5 w-fit">
              <DollarSign className="w-3 h-3 text-yellow-500" />
              <span className="text-[10px] font-bold text-yellow-500">
                {player.coins}.0M
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Influence cards */}
      <div className="flex gap-0.5 -mt-2 justify-center">
        {player.influence.map((_, index) => (
          <div
            key={index}
            className={`
              w-5 h-8 rounded 
              bg-gradient-to-b from-[#3a3a3a] to-[#2a2a2a] 
              border border-white/5 shadow-sm
              ${isTargeted ? 'border-red-500/30' : ''}
              transition-colors duration-200
            `}
            style={{
              transform: `translateY(${index * 2}px) rotate(${index * 5}deg)`,
            }}
          />
        ))}
      </div>

      {/* Active player indicator */}
      {isActive && (
        <div className="absolute -inset-px rounded-lg bg-yellow-500/10 blur-sm -z-10" />
      )}
    </div>
  );
}