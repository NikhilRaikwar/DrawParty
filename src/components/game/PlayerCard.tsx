import { Player } from '@/types/game';
import { cn } from '@/lib/utils';
import { Mic, MicOff, Crown, Check, Pencil } from 'lucide-react';

interface PlayerCardProps {
  player: Player;
  isCurrentPlayer?: boolean;
  isDrawing?: boolean;
  hasGuessed?: boolean;
  showScore?: boolean;
  compact?: boolean;
}

export const PlayerCard = ({
  player,
  isCurrentPlayer = false,
  isDrawing = false,
  hasGuessed = false,
  showScore = true,
  compact = false
}: PlayerCardProps) => {
  return (
    <div
      className={cn(
        "relative flex items-center gap-3 p-3 rounded-xl transition-all",
        isCurrentPlayer && "ring-2 ring-primary",
        isDrawing && "bg-game-warning/20 ring-2 ring-game-warning",
        hasGuessed && "bg-game-success/20",
        !isDrawing && !hasGuessed && "bg-card",
        compact ? "p-2 gap-2" : "p-3 gap-3"
      )}
    >
      {/* Avatar */}
      <div className="relative">
        <div
          className={cn(
            "flex items-center justify-center rounded-full bg-muted text-2xl",
            compact ? "w-10 h-10" : "w-12 h-12",
            player.isSpeaking && "animate-pulse-glow ring-2 ring-game-success"
          )}
        >
          {player.avatar}
        </div>
        
        {/* Voice indicator */}
        {player.isSpeaking && (
          <div className="absolute -bottom-1 -right-1 flex gap-0.5">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="w-1 bg-game-success rounded-full animate-speaking"
                style={{
                  height: 6 + i * 2,
                  animationDelay: `${i * 0.1}s`
                }}
              />
            ))}
          </div>
        )}

        {/* Status badges */}
        {player.isHost && (
          <div className="absolute -top-1 -left-1 w-5 h-5 bg-game-warning rounded-full flex items-center justify-center">
            <Crown className="w-3 h-3 text-game-warning-foreground" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn(
            "font-semibold truncate",
            compact ? "text-sm" : "text-base"
          )}>
            {player.name}
          </span>
          {isDrawing && (
            <Pencil className="w-4 h-4 text-game-warning flex-shrink-0" />
          )}
          {hasGuessed && (
            <Check className="w-4 h-4 text-game-success flex-shrink-0" />
          )}
        </div>
        {showScore && (
          <span className={cn(
            "text-muted-foreground",
            compact ? "text-xs" : "text-sm"
          )}>
            {player.score} pts
          </span>
        )}
      </div>

      {/* Mute indicator */}
      <div className={cn(
        "flex-shrink-0 p-1.5 rounded-full",
        player.isMuted ? "bg-destructive/10 text-destructive" : "bg-game-success/10 text-game-success"
      )}>
        {player.isMuted ? (
          <MicOff className="w-4 h-4" />
        ) : (
          <Mic className="w-4 h-4" />
        )}
      </div>

      {/* Ready indicator (lobby) */}
      {!showScore && (
        <div className={cn(
          "px-2 py-1 rounded-full text-xs font-medium",
          player.isReady 
            ? "bg-game-success/20 text-game-success" 
            : "bg-muted text-muted-foreground"
        )}>
          {player.isReady ? 'Ready' : 'Not Ready'}
        </div>
      )}
    </div>
  );
};
