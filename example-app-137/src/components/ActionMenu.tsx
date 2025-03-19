import React from 'react';
import { DollarSign, Sword, Crown, UserX, Users, Ship } from 'lucide-react';
import { GameAction } from '../types';

interface ActionMenuProps {
  onClose: () => void;
  onActionSelect: (action: GameAction) => void;
}

export function ActionMenu({ onClose, onActionSelect }: ActionMenuProps) {
  const actions: GameAction[] = [
    { icon: DollarSign, name: 'Income', description: 'Take 1 coin', type: 'income' },
    { icon: DollarSign, name: 'Foreign Aid', description: 'Take 2 coins', type: 'foreign-aid' },
    { icon: Crown, name: 'Duke', description: 'Take 3 coins', type: 'duke' },
    { icon: Users, name: 'Ambassador', description: 'Exchange cards with Court', type: 'ambassador' },
    { icon: Ship, name: 'Captain', description: 'Steal 2 coins', type: 'steal' },
    { icon: Sword, name: 'Assassin', description: 'Pay 3 coins to assassinate', type: 'assassinate', cost: 3 },
    { icon: UserX, name: 'Coup', description: 'Pay 7 coins to coup', type: 'coup', cost: 7 },
  ];

  return (
    <div 
      className="bg-[#1a1a1a] rounded-lg p-2 w-48 shadow-xl border border-slate-800/50 backdrop-blur-sm
                 animate-in fade-in slide-in-from-bottom-2 duration-200"
    >
      <div className="space-y-1">
        {actions.map((action, index) => (
          <button
            key={action.name}
            onClick={() => {
              onActionSelect(action);
              onClose();
            }}
            className="w-full flex items-center gap-2 p-1.5 rounded hover:bg-slate-800/50 transition-colors text-left group
                       animate-in fade-in slide-in-from-bottom-1"
            style={{
              animationDelay: `${index * 50}ms`,
              animationFill: 'forwards'
            }}
          >
            <action.icon className="w-4 h-4 text-slate-400 group-hover:text-slate-300 transition-colors" />
            <div>
              <div className="text-sm text-slate-300 group-hover:text-white transition-colors">{action.name}</div>
              <div className="text-xs text-slate-500 group-hover:text-slate-400 transition-colors">{action.description}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}