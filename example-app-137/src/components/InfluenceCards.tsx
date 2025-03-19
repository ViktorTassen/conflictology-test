import React from 'react';
import { Influence } from '../types';

interface InfluenceCardsProps {
  influence: Influence[];
}

export function InfluenceCards({ influence }: InfluenceCardsProps) {
  return (
    <div className="flex gap-1 transform -rotate-6">
      {influence.map((card, index) => (
        <div
          key={index}
          className={`w-[50px] h-[75px] rounded-lg overflow-hidden transform ${
            index === 1 ? 'rotate-12' : ''
          }`}
          style={{
            boxShadow: '0 0 20px rgba(0,0,0,0.3)',
          }}
        >
          <img
            src="https://images.unsplash.com/photo-1509460913899-515f1df34fea?w=200&q=80"
            alt={card.card}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent">
            <div className="absolute bottom-1 left-1 text-white font-bold text-[10px]">
              {card.card}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}