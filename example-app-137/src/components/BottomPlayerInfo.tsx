import React from 'react';
import { DollarSign } from 'lucide-react';
import { Player } from '../types';

interface BottomPlayerInfoProps {
  player: Player;
}

export function BottomPlayerInfo({ player }: BottomPlayerInfoProps) {
  return (
    <div className="relative">
      {/* Player info card */}
      <div className="relative z-10 bg-[#2a2a2a]/90 backdrop-blur-sm rounded-lg">
        <div className="flex items-center p-1.5 gap-1.5 max-w-[160px]">
          {/* Avatar */}
          <div className="relative shrink-0">
            <div className="w-8 h-8 rounded-full overflow-hidden">
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
                className="text-sm font-medium leading-none block truncate" 
                style={{ color: player.color }}
                title={player.name}
              >
                {player.name}
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
    </div>
  );
}