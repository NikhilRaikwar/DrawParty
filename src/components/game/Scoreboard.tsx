import { Player } from '@/types/game';
import { Trophy, Medal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface ScoreboardProps {
  players: Player[];
  onPlayAgain?: () => void;
  onLeave?: () => void;
}

export const Scoreboard = ({ players, onPlayAgain, onLeave }: ScoreboardProps) => {
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
  const winner = sortedPlayers[0];

  const getMedalColor = (index: number) => {
    switch (index) {
      case 0: return 'text-yellow-500';
      case 1: return 'text-gray-400';
      case 2: return 'text-amber-600';
      default: return 'text-muted-foreground';
    }
  };

  return (
    <div className="fixed inset-0 bg-foreground/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-card p-8 rounded-2xl shadow-2xl max-w-lg w-full mx-4 animate-bounce-in">
        <div className="text-center mb-6">
          <Trophy className="w-16 h-16 mx-auto text-yellow-500 animate-float" />
          <h2 className="text-3xl font-bold mt-4">Game Over!</h2>
          <p className="text-lg text-muted-foreground mt-2">
            {winner.name} wins with {winner.score} points!
          </p>
        </div>

        <div className="space-y-3 mb-8">
          {sortedPlayers.map((player, index) => (
            <div
              key={player.id}
              className={cn(
                "flex items-center gap-3 p-3 rounded-xl",
                index === 0 && "bg-yellow-500/20 ring-2 ring-yellow-500",
                index === 1 && "bg-gray-400/20",
                index === 2 && "bg-amber-600/20",
                index > 2 && "bg-muted/50"
              )}
            >
              <div className={cn("text-2xl font-bold w-8", getMedalColor(index))}>
                {index < 3 ? (
                  <Medal className="w-6 h-6" />
                ) : (
                  <span className="text-lg">{index + 1}</span>
                )}
              </div>
              <div className="text-2xl">{player.avatar}</div>
              <div className="flex-1">
                <p className="font-semibold">{player.name}</p>
              </div>
              <div className={cn(
                "text-lg font-bold",
                getMedalColor(index)
              )}>
                {player.score} pts
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={onLeave}
          >
            Leave Game
          </Button>
          <Button
            className="flex-1"
            onClick={onPlayAgain}
          >
            Play Again
          </Button>
        </div>
      </div>
    </div>
  );
};
