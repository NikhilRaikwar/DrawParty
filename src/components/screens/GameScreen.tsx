import { useState, useCallback, useEffect } from 'react';
import { GameState, Player, ChatMessage, DrawingData } from '@/types/game';
import { DrawingCanvas } from '@/components/game/DrawingCanvas';
import { ChatBox } from '@/components/game/ChatBox';
import { PlayerCard } from '@/components/game/PlayerCard';
import { GameHeader } from '@/components/game/GameHeader';
import { WordSelection } from '@/components/game/WordSelection';
import { Scoreboard } from '@/components/game/Scoreboard';
import { useDrawingSync } from '@/hooks/useDrawingSync';

interface GameScreenProps {
  roomId: string;
  gameState: GameState;
  players: Player[];
  messages: ChatMessage[];
  currentPlayer: Player | undefined;
  isDrawer: boolean;
  wordOptions: string[];
  isVoiceEnabled: boolean;
  isMuted: boolean;
  isConnecting: boolean;
  speakingPeers: Set<string>;
  onSelectWord: (word: string) => void;
  onSendMessage: (message: string) => void;
  onEnableVoice: () => void;
  onDisableVoice: () => void;
  onToggleMute: () => void;
  onLeave: () => void;
  onPlayAgain: () => void;
}

export const GameScreen = ({
  roomId,
  gameState,
  players,
  messages,
  currentPlayer,
  isDrawer,
  wordOptions,
  isVoiceEnabled,
  isMuted,
  isConnecting,
  speakingPeers,
  onSelectWord,
  onSendMessage,
  onEnableVoice,
  onDisableVoice,
  onToggleMute,
  onLeave,
  onPlayAgain
}: GameScreenProps) => {
  const chatDisabled = isDrawer || gameState.correctGuessers.includes(currentPlayer?.id || '');
  const [receivedDrawingData, setReceivedDrawingData] = useState<DrawingData | null>(null);

  // Drawing sync hook
  const { sendDrawingData } = useDrawingSync(
    roomId,
    isDrawer,
    useCallback((data: DrawingData) => {
      setReceivedDrawingData(data);
    }, [])
  );

  // Handle drawing data from canvas
  const handleDrawingData = useCallback((data: DrawingData) => {
    if (isDrawer) {
      sendDrawingData(data);
    }
  }, [isDrawer, sendDrawingData]);

  // Clear received data after processing
  useEffect(() => {
    if (receivedDrawingData) {
      const timer = setTimeout(() => setReceivedDrawingData(null), 50);
      return () => clearTimeout(timer);
    }
  }, [receivedDrawingData]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <GameHeader
        gameState={gameState}
        isDrawer={isDrawer}
        isVoiceEnabled={isVoiceEnabled}
        isMuted={isMuted}
        isConnecting={isConnecting}
        onEnableVoice={onEnableVoice}
        onDisableVoice={onDisableVoice}
        onToggleMute={onToggleMute}
        onLeave={onLeave}
      />

      {/* Main content */}
      <div className="flex-1 container mx-auto p-4 grid lg:grid-cols-[1fr_300px] gap-4">
        {/* Canvas area */}
        <div className="flex flex-col min-h-[500px]">
          <DrawingCanvas 
            isDrawer={isDrawer} 
            onDrawingData={handleDrawingData}
            receivedDrawingData={receivedDrawingData}
          />
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-4">
          {/* Players */}
          <div className="bg-card rounded-xl p-4">
            <h3 className="font-semibold mb-3">Players</h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {players.map((player) => (
                <PlayerCard
                  key={player.id}
                  player={{
                    ...player,
                    isSpeaking: speakingPeers.has(player.id)
                  }}
                  isCurrentPlayer={player.id === currentPlayer?.id}
                  isDrawing={player.id === gameState.currentDrawerId}
                  hasGuessed={gameState.correctGuessers.includes(player.id)}
                  compact
                />
              ))}
            </div>
          </div>

          {/* Chat */}
          <div className="flex-1 min-h-[300px]">
            <ChatBox
              messages={messages}
              onSendMessage={onSendMessage}
              disabled={chatDisabled}
              placeholder={
                isDrawer
                  ? "You're drawing!"
                  : gameState.correctGuessers.includes(currentPlayer?.id || '')
                  ? "You guessed correctly!"
                  : "Type your guess..."
              }
            />
          </div>
        </div>
      </div>

      {/* Word selection modal */}
      {gameState.phase === 'wordSelection' && isDrawer && wordOptions.length > 0 && (
        <WordSelection words={wordOptions} onSelect={onSelectWord} />
      )}

      {/* Game end scoreboard */}
      {gameState.phase === 'gameEnd' && (
        <Scoreboard
          players={players}
          onPlayAgain={onPlayAgain}
          onLeave={onLeave}
        />
      )}
    </div>
  );
};
