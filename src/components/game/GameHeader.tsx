import { GameTimer } from './GameTimer';
import { WordDisplay } from './WordDisplay';
import { VoiceControls } from './VoiceControls';
import { GameState, Player } from '@/types/game';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';

interface GameHeaderProps {
  gameState: GameState;
  isDrawer: boolean;
  currentDrawerName?: string;
  hasGuessedCorrectly: boolean;
  isVoiceEnabled: boolean;
  isMuted: boolean;
  isConnecting: boolean;
  onEnableVoice: () => void;
  onDisableVoice: () => void;
  onToggleMute: () => void;
  onLeave: () => void;
}

export const GameHeader = ({
  gameState,
  isDrawer,
  currentDrawerName,
  hasGuessedCorrectly,
  isVoiceEnabled,
  isMuted,
  isConnecting,
  onEnableVoice,
  onDisableVoice,
  onToggleMute,
  onLeave
}: GameHeaderProps) => {
  const showTimer = gameState.phase === 'drawing';

  return (
    <div className="bg-card border-b border-border">
      <div className="container mx-auto px-2 sm:px-4 py-2 sm:py-4">
        <div className="flex items-center justify-between gap-2 sm:gap-4">
          {/* Left - Leave & Round info */}
          <div className="flex items-center gap-1 sm:gap-4 flex-shrink-0">
            <Button variant="ghost" size="icon" onClick={onLeave} className="h-8 w-8 sm:h-10 sm:w-10">
              <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
            </Button>
            <div className="px-2 sm:px-4 py-1 sm:py-2 bg-muted rounded-full">
              <span className="font-semibold text-xs sm:text-base whitespace-nowrap">
                Round {gameState.currentRound} / {gameState.totalRounds}
              </span>
            </div>
          </div>

          {/* Center - Word display (hidden on very small screens when timer shown) */}
          <div className="flex-1 max-w-xs sm:max-w-md min-w-0">
            <WordDisplay
              word={gameState.currentWord}
              hint={gameState.wordHint}
              isDrawer={isDrawer}
              phase={gameState.phase}
              currentDrawerName={currentDrawerName}
              hasGuessedCorrectly={hasGuessedCorrectly}
            />
          </div>

          {/* Right - Timer and voice controls */}
          <div className="flex items-center gap-1 sm:gap-4 flex-shrink-0">
            {showTimer && (
              <div className="w-20 sm:w-48">
                <GameTimer
                  timeRemaining={gameState.timeRemaining}
                  totalTime={gameState.drawTime}
                />
              </div>
            )}
            <div className="hidden sm:block">
              <VoiceControls
                isVoiceEnabled={isVoiceEnabled}
                isMuted={isMuted}
                isConnecting={isConnecting}
                onEnableVoice={onEnableVoice}
                onDisableVoice={onDisableVoice}
                onToggleMute={onToggleMute}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
