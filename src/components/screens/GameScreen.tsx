import { useState, useCallback, useEffect } from 'react';
import { GameState, Player, ChatMessage, DrawingData } from '@/types/game';
import { DrawingCanvas } from '@/components/game/DrawingCanvas';
import { ChatBox } from '@/components/game/ChatBox';
import { PlayerCard } from '@/components/game/PlayerCard';
import { GameHeader } from '@/components/game/GameHeader';
import { WordSelection } from '@/components/game/WordSelection';
import { Scoreboard } from '@/components/game/Scoreboard';
import { VoiceControls } from '@/components/game/VoiceControls';
import { useDrawingSync } from '@/hooks/useDrawingSync';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { MessageSquare, Users, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  const hasGuessedCorrectly = gameState.correctGuessers.includes(currentPlayer?.id || '');
  const chatDisabled = isDrawer || hasGuessedCorrectly;
  const [receivedDrawingData, setReceivedDrawingData] = useState<DrawingData | null>(null);
  const [showMobileChat, setShowMobileChat] = useState(false);
  const [showMobilePlayers, setShowMobilePlayers] = useState(false);

  // Get current drawer's name
  const currentDrawer = players.find(p => p.id === gameState.currentDrawerId);
  const currentDrawerName = currentDrawer?.name;

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

  // Get drawing status message for non-drawers
  const getDrawingStatus = () => {
    if (isDrawer) {
      if (gameState.phase === 'wordSelection') {
        return 'Pick a word to draw!';
      }
      return 'Your turn to draw!';
    }
    
    if (gameState.phase === 'wordSelection') {
      return `${currentDrawerName} is picking a word...`;
    }
    
    if (hasGuessedCorrectly) {
      return 'You guessed correctly! 🎉';
    }
    
    return `${currentDrawerName} is drawing...`;
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <GameHeader
        gameState={gameState}
        isDrawer={isDrawer}
        currentDrawerName={currentDrawerName}
        hasGuessedCorrectly={hasGuessedCorrectly}
        isVoiceEnabled={isVoiceEnabled}
        isMuted={isMuted}
        isConnecting={isConnecting}
        onEnableVoice={onEnableVoice}
        onDisableVoice={onDisableVoice}
        onToggleMute={onToggleMute}
        onLeave={onLeave}
      />

      {/* Main content */}
      <div className="flex-1 container mx-auto p-2 sm:p-4 flex flex-col lg:grid lg:grid-cols-[1fr_300px] gap-2 sm:gap-4 overflow-hidden">
        {/* Canvas area */}
        <div className="flex flex-col flex-1 min-h-0">
          {/* Status message for mobile */}
          <div className="lg:hidden text-center py-2 px-4 bg-card rounded-lg mb-2">
            <p className={cn(
              "text-sm font-medium",
              isDrawer ? "text-primary" : hasGuessedCorrectly ? "text-game-success" : "text-muted-foreground"
            )}>
              {getDrawingStatus()}
            </p>
          </div>
          
          <div className="flex-1 min-h-[300px] sm:min-h-[400px] lg:min-h-[500px]">
            <DrawingCanvas 
              isDrawer={isDrawer} 
              onDrawingData={handleDrawingData}
              receivedDrawingData={receivedDrawingData}
            />
          </div>
          
          {/* Mobile quick guess input */}
          <div className="lg:hidden mt-2">
            <ChatBox
              messages={[]}
              onSendMessage={onSendMessage}
              disabled={chatDisabled}
              placeholder={
                isDrawer
                  ? "You're drawing!"
                  : hasGuessedCorrectly
                  ? "You guessed correctly!"
                  : "Type your guess..."
              }
              hideMessages
            />
          </div>
        </div>

        {/* Desktop Sidebar */}
        <div className="hidden lg:flex flex-col gap-4">
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
                  : hasGuessedCorrectly
                  ? "You guessed correctly!"
                  : "Type your guess..."
              }
            />
          </div>
        </div>
      </div>

      {/* Mobile bottom bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border p-2 flex items-center justify-around gap-2 z-40">
        {/* Players sheet */}
        <Sheet open={showMobilePlayers} onOpenChange={setShowMobilePlayers}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="sm" className="flex-1 gap-2">
              <Users className="w-4 h-4" />
              <span className="text-xs">Players ({players.length})</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[50vh]">
            <h3 className="font-semibold mb-4">Players</h3>
            <div className="space-y-2 overflow-y-auto max-h-[calc(50vh-80px)]">
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
                />
              ))}
            </div>
          </SheetContent>
        </Sheet>

        {/* Voice controls */}
        <VoiceControls
          isVoiceEnabled={isVoiceEnabled}
          isMuted={isMuted}
          isConnecting={isConnecting}
          onEnableVoice={onEnableVoice}
          onDisableVoice={onDisableVoice}
          onToggleMute={onToggleMute}
        />

        {/* Chat sheet */}
        <Sheet open={showMobileChat} onOpenChange={setShowMobileChat}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="sm" className="flex-1 gap-2">
              <MessageSquare className="w-4 h-4" />
              <span className="text-xs">Chat</span>
              {messages.length > 0 && (
                <span className="bg-primary text-primary-foreground text-xs rounded-full px-1.5">
                  {messages.length}
                </span>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[60vh]">
            <div className="h-full">
              <ChatBox
                messages={messages}
                onSendMessage={(msg) => {
                  onSendMessage(msg);
                }}
                disabled={chatDisabled}
                placeholder={
                  isDrawer
                    ? "You're drawing!"
                    : hasGuessedCorrectly
                    ? "You guessed correctly!"
                    : "Type your guess..."
                }
              />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Word selection modal - only shown to drawer during word selection phase */}
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
