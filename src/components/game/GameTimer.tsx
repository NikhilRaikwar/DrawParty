import { cn } from '@/lib/utils';
import { Clock } from 'lucide-react';

interface GameTimerProps {
  timeRemaining: number;
  totalTime: number;
}

export const GameTimer = ({ timeRemaining, totalTime }: GameTimerProps) => {
  const percentage = (timeRemaining / totalTime) * 100;
  const isLow = timeRemaining <= 10;
  const isCritical = timeRemaining <= 5;

  return (
    <div className="flex items-center gap-3">
      <div
        className={cn(
          "flex items-center justify-center w-12 h-12 rounded-full font-bold text-lg",
          isCritical && "bg-destructive text-destructive-foreground animate-timer-pulse",
          isLow && !isCritical && "bg-game-warning text-game-warning-foreground",
          !isLow && "bg-primary text-primary-foreground"
        )}
      >
        {timeRemaining}
      </div>
      <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full transition-all duration-1000 ease-linear rounded-full",
            isCritical && "bg-destructive",
            isLow && !isCritical && "bg-game-warning",
            !isLow && "bg-primary"
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <Clock className={cn(
        "w-5 h-5",
        isCritical && "text-destructive animate-pulse",
        isLow && !isCritical && "text-game-warning",
        !isLow && "text-muted-foreground"
      )} />
    </div>
  );
};
