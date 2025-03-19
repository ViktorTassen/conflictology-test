import React, { useState, useRef, useEffect } from 'react';
import { Menu, ArrowLeft, Info, Plus, Users } from 'lucide-react';
import { Player, GameLogEntry, View, GameAction } from './types';
import { GameLog } from './components/GameLog';
import { PlayerCard } from './components/PlayerCard';
import { ActionMenu } from './components/ActionMenu';
import { BottomPlayerInfo } from './components/BottomPlayerInfo';
import { InfluenceCards } from './components/InfluenceCards';
import { ResponseButtons } from './components/ResponseButtons';

function App() {
  const [view, setView] = useState<View>('game');
  const [showActions, setShowActions] = useState(false);
  const [selectedAction, setSelectedAction] = useState<GameAction | null>(null);
  const [targetedPlayerId, setTargetedPlayerId] = useState<number | null>(null);
  const actionButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (actionButtonRef.current?.contains(event.target as Node)) {
        return;
      }
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowActions(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  const currentPlayer: Player = {
    id: 6,
    name: "Karinka",
    coins: 7,
    color: "#E67E22",
    avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80",
    influence: [
      { card: "Duke" },
      { card: "Captain" }
    ]
  };
  
  const players: (Player | null)[] = [
    { id: 1, name: "Mister", coins: 2, color: "#E74C3C", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330", influence: [
      { card: "Duke" },
      { card: "Assassin" }
    ]},
    { id: 2, name: "ViktorTasiev", coins: 3, color: "#2ECC71", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d", influence: [
      { card: "Ambassador" },
      { card: "Captain" }
    ]},
    { id: 3, name: "Eugene", coins: 5, color: "#95A5A6", avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e", influence: [
      { card: "Ambassador" },
      { card: "Assassin" }
    ]},
    { id: 4, name: "Christopher", coins: 1, color: "#F1C40F", avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80", influence: [
      { card: "Contessa" },
      { card: "Duke" }
    ]},
    null
  ];

  const logs: GameLogEntry[] = [
    { 
      type: 'steal',
      player: "Ivan",
      playerColor: "#F1C40F",
      target: "Mister G",
      targetColor: "#E74C3C",
      coins: 2,
      card: "Captain"
    },
    { 
      type: 'block',
      player: "Mister G",
      playerColor: "#E74C3C",
      target: "Ivan",
      targetColor: "#F1C40F",
      card: "Captain",
      targetCard: "Captain"
    },
    { 
      type: 'challenge',
      player: "Ivan",
      playerColor: "#F1C40F",
      target: "Mister G",
      targetColor: "#E74C3C"
    }
  ];

  const handleActionSelect = (action: GameAction) => {
    setSelectedAction(action);
    if (['steal', 'assassinate', 'coup'].includes(action.type)) {
      setShowActions(false);
    } else {
      console.log(`Executing action: ${action.name}`);
      setSelectedAction(null);
    }
  };

  const handlePlayerTarget = (playerId: number) => {
    if (selectedAction && ['steal', 'assassinate', 'coup'].includes(selectedAction.type)) {
      setTargetedPlayerId(playerId);
      console.log(`Executing ${selectedAction.name} on player ${playerId}`);
      setSelectedAction(null);
      setTargetedPlayerId(null);
    }
  };

  const isPlayerTargetable = (playerId: number) => {
    return selectedAction && 
           ['steal', 'assassinate', 'coup'].includes(selectedAction.type) && 
           playerId !== currentPlayer.id;
  };

  const renderLobby = () => (
    <div className="relative h-full flex flex-col items-center justify-center px-8">
      <div className="w-full space-y-4">
        <button
          onClick={() => console.log('Create game')}
          className="w-full bg-gradient-to-r from-yellow-600 to-yellow-500 hover:from-yellow-500 hover:to-yellow-400 text-white rounded-xl p-4 flex items-center justify-between group transition-all duration-200 shadow-lg shadow-yellow-500/20"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-yellow-400/20 flex items-center justify-center">
              <Plus className="w-6 h-6" />
            </div>
            <div className="text-left">
              <div className="font-semibold text-lg">Create Game</div>
              <div className="text-sm text-yellow-200/80">Start a new game room</div>
            </div>
          </div>
          <div className="w-8 h-8 rounded-full bg-yellow-400/20 flex items-center justify-center">
            <ArrowLeft className="w-5 h-5 rotate-180 transform group-hover:translate-x-1 transition-transform" />
          </div>
        </button>

        <button
          onClick={() => console.log('Join game')}
          className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white rounded-xl p-4 flex items-center justify-between group transition-all duration-200 shadow-lg shadow-blue-500/20"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-400/20 flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
            <div className="text-left">
              <div className="font-semibold text-lg">Join Game</div>
              <div className="text-sm text-blue-200/80">Enter an existing room</div>
            </div>
          </div>
          <div className="w-8 h-8 rounded-full bg-blue-400/20 flex items-center justify-center">
            <ArrowLeft className="w-5 h-5 rotate-180 transform group-hover:translate-x-1 transition-transform" />
          </div>
        </button>
      </div>
    </div>
  );

  const renderGame = () => (
    <div className="relative h-full">
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between z-10">
        <button 
          className="w-10 h-10 bg-[#2a2a2a]/90 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-[#333333] transition-colors"
          onClick={() => setView('lobby')}
        >
          <ArrowLeft className="w-5 h-5 text-white/80" />
        </button>
        <button 
          className="w-10 h-10 bg-[#2a2a2a]/90 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-[#333333] transition-colors"
          onClick={() => console.log('Show info')}
        >
          <Info className="w-5 h-5 text-white/80" />
        </button>
      </div>

      <div className="h-full">
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10">
          {players[0] && (
            <PlayerCard 
              player={players[0]} 
              isActive={false}
              isTargetable={isPlayerTargetable(players[0].id)}
              isTargeted={targetedPlayerId === players[0].id}
              onTargetSelect={() => handlePlayerTarget(players[0].id)}
            />
          )}
        </div>

        <div className="absolute top-24 left-4 z-10">
          {players[1] && (
            <PlayerCard 
              player={players[1]} 
              isActive={true}
              isTargetable={isPlayerTargetable(players[1].id)}
              isTargeted={targetedPlayerId === players[1].id}
              onTargetSelect={() => handlePlayerTarget(players[1].id)}
            />
          )}
        </div>

        <div className="absolute top-24 right-4 z-10">
          {players[2] && (
            <PlayerCard 
              player={players[2]} 
              isActive={false}
              isTargetable={isPlayerTargetable(players[2].id)}
              isTargeted={targetedPlayerId === players[2].id}
              onTargetSelect={() => handlePlayerTarget(players[2].id)}
            />
          )}
        </div>

        <div className="absolute top-52 left-4 z-10">
          {players[3] && (
            <PlayerCard 
              player={players[3]} 
              isActive={false}
              isTargetable={isPlayerTargetable(players[3].id)}
              isTargeted={targetedPlayerId === players[3].id}
              onTargetSelect={() => handlePlayerTarget(players[3].id)}
            />
          )}
        </div>

        <div className="absolute top-52 right-4 z-10">
          <div className="relative">
            <div className="relative z-10 bg-[#2a2a2a]/40 backdrop-blur-sm rounded-lg border border-white/5">
              <div className="flex items-center p-1.5 gap-1.5 max-w-[160px]">
                <div className="relative shrink-0">
                  <div className="w-6 h-6 rounded-full bg-white/5" />
                </div>
                <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                  <div className="w-full">
                    <span className="text-xs font-medium leading-none block text-white/10">
                      &nbsp;
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="absolute top-[320px] left-0 right-0 px-4 z-10">
          <GameLog 
            logs={logs} 
            currentPlayer={currentPlayer.name}
            currentPlayerColor={currentPlayer.color}
            gameState={selectedAction ? 'waiting_for_target' : 'waiting_for_action'}
            selectedAction={selectedAction?.name}
          />
          <ResponseButtons 
            onBlock={() => console.log('Block')}
            onChallenge={() => console.log('Challenge')}
            onAllow={() => console.log('Allow')}
          />
        </div>

        <div className="absolute bottom-0 left-0 right-0">
          <div className="absolute inset-0 h-32 bg-gradient-to-t from-black/80 via-black/50 to-transparent backdrop-blur-sm" />
          
          <div className="relative h-32 px-6">
            <div className="absolute bottom-6 left-6 right-6">
              <div className="flex justify-between items-end">
                <div className="z-20">
                  <BottomPlayerInfo player={currentPlayer} />
                </div>

                <div className="absolute left-1/2 bottom-0 transform -translate-x-1/2 z-10">
                  <InfluenceCards influence={currentPlayer.influence} />
                </div>

                <div className="z-20 relative">
                  <button
                    ref={actionButtonRef}
                    onClick={() => setShowActions(!showActions)}
                    className="relative group"
                  >
                    <div className={`
                      absolute -inset-2
                      rounded-full
                      bg-gradient-to-r from-slate-700 via-slate-500 to-slate-700
                      ${showActions ? 'pulse-ring opacity-100' : 'opacity-0'}
                      group-hover:opacity-100
                      transition-opacity duration-300
                    `} />
                    
                    <div className={`
                      relative
                      w-14 h-14
                      rounded-full
                      bg-gradient-to-br from-[#2a2a2a] to-[#1a1a1a]
                      flex items-center justify-center
                      shadow-[inset_0_1px_1px_rgba(255,255,255,0.1),0_0_20px_rgba(0,0,0,0.5)]
                      border border-slate-700/50
                      overflow-hidden
                      transition-all duration-300
                      ${showActions ? 'ring-2 ring-slate-400/30' : ''}
                    `}>
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-slate-300/10 to-transparent transform -rotate-45 gem-shine" />
                      
                      <div className="absolute inset-0 bg-gradient-to-tl from-slate-700/20 to-transparent" />
                      <div className="absolute inset-0 bg-gradient-to-br from-slate-600/10 to-transparent" />
                      
                      <div className={`
                        absolute -inset-1
                        bg-slate-400/20
                        blur-lg
                        transition-opacity duration-300
                        ${showActions ? 'opacity-100' : 'opacity-0'}
                      `} />

                      <Menu className={`
                        relative
                        w-6 h-6
                        transition-all duration-300
                        ${showActions ? 'text-slate-300' : 'text-slate-400'}
                        group-hover:text-slate-300
                        transform group-hover:scale-110
                      `} />
                    </div>
                  </button>

                  {showActions && (
                    <div 
                      ref={menuRef}
                      className="absolute bottom-full right-0 mb-2"
                      style={{
                        filter: 'drop-shadow(0 20px 30px rgba(0, 0, 0, 0.3))',
                      }}
                    >
                      <ActionMenu 
                        onClose={() => setShowActions(false)}
                        onActionSelect={handleActionSelect}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="w-[345px] h-[700px] bg-[#1a1a1a] relative overflow-hidden">
      <div className="absolute inset-0">
        <div 
          className="absolute top-1/2 left-1/2 w-[200%] h-[200%] lamp-light origin-center"
          style={{
            background: `
              radial-gradient(
                circle at center,
                rgba(255,255,255,0.15) 0%,
                rgba(255,255,255,0.1) 5%,
                rgba(255,255,255,0.05) 10%,
                transparent 20%
              ),
              radial-gradient(
                circle at center,
                rgba(255,220,150,0.2) 0%,
                rgba(255,220,150,0.15) 5%,
                rgba(255,220,150,0.05) 15%,
                transparent 25%
              ),
              radial-gradient(
                circle at center,
                transparent 20%,
                rgba(0,0,0,0.6) 40%,
                rgba(0,0,0,0.8) 60%,
                rgba(0,0,0,0.95) 70%,
                rgb(0,0,0) 100%
              )
            `,
            transform: 'translate(-50%, -50%)',
          }}
        />

        <div 
          className="absolute inset-0 opacity-60" 
          style={{
            background: `
              radial-gradient(
                circle at 50% 40%,
                rgba(255,220,150,0.1) 0%,
                transparent 40%
              )
            `
          }}
        />
      </div>

      {view === 'lobby' ? renderLobby() : renderGame()}
    </div>
  );
}

export default App;