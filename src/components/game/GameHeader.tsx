import { GameTimer } from './GameTimer';
import { WordDisplay } from './WordDisplay';
import { VoiceControls } from './VoiceControls';
import { GameState } from '@/types/game';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';

interface GameHeaderProps {
  gameState: GameState;
  isDrawer: boolean;
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
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between gap-4">
          {/* Left - Round info */}
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={onLeave}>
              <LogOut className="w-5 h-5" />
            </Button>
            <div className="px-4 py-2 bg-muted rounded-full">
              <span className="font-semibold">
                Round {gameState.currentRound} / {gameState.totalRounds}
              </span>
            </div>
          </div>

          {/* Center - Word display */}
          <div className="flex-1 max-w-md">
            <WordDisplay
              word={gameState.currentWord}
              hint={gameState.wordHint}
              isDrawer={isDrawer}
              phase={gameState.phase}
            />
          </div>

          {/* Right - Timer and controls */}
          <div className="flex items-center gap-4">
            {showTimer && (
              <div className="w-48">
                <GameTimer
                  timeRemaining={gameState.timeRemaining}
                  totalTime={gameState.drawTime}
                />
              </div>
            )}
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
  );
};
