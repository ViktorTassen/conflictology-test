import React from 'react';
import { UserPlus } from 'lucide-react';

export function EmptyPlayerCard() {
  return (
    <div className="relative">
      <div className="relative z-10 bg-[#2a2a2a]/40 backdrop-blur-sm rounded-lg border border-white/5">
        <div className="flex items-center p-1.5 gap-1.5 max-w-[160px]">
          <div className="relative shrink-0">
            <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center">
              <UserPlus className="w-3 h-3 text-white/40" />
            </div>
          </div>
          <div className="flex-1 min-w-0 flex flex-col gap-0.5">
            <div className="w-full">
              <span className="text-xs font-medium leading-none block text-white/40">
                Empty Seat
              </span>
            </div>
            <div className="flex items-center gap-1 bg-black/20 rounded-full px-1.5 py-0.5 w-fit">
              <span className="text-[10px] font-medium text-white/40">
                Waiting...
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Empty influence cards */}
      <div className="flex gap-0.5 -mt-2 justify-center">
        {[0, 1].map((index) => (
          <div
            key={index}
            className="w-5 h-8 rounded bg-[#2a2a2a]/40 border border-white/5"
            style={{
              transform: `translateY(${index * 2}px) rotate(${index * 5}deg)`,
            }}
          />
        ))}
      </div>
    </div>
  );
}