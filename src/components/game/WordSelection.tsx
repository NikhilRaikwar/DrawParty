import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface WordSelectionProps {
  words: string[];
  onSelect: (word: string) => void;
}

export const WordSelection = ({ words, onSelect }: WordSelectionProps) => {
  return (
    <div className="fixed inset-0 bg-foreground/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-card p-4 sm:p-8 rounded-2xl shadow-2xl max-w-lg w-full mx-4 animate-bounce-in">
        <h2 className="text-xl sm:text-2xl font-bold text-center mb-2">Choose a Word</h2>
        <p className="text-sm sm:text-base text-muted-foreground text-center mb-4 sm:mb-6">
          Pick a word to draw for others to guess
        </p>
        <div className="grid gap-2 sm:gap-3">
          {words.map((word, index) => (
            <Button
              key={word}
              variant="outline"
              size="lg"
              className={cn(
                "h-12 sm:h-16 text-lg sm:text-xl font-semibold hover:scale-105 transition-all",
                index === 0 && "border-game-success text-game-success hover:bg-game-success/10",
                index === 1 && "border-game-warning text-game-warning hover:bg-game-warning/10",
                index === 2 && "border-game-purple text-game-purple hover:bg-game-purple/10",
                index === 3 && "border-game-info text-game-info hover:bg-game-info/10",
                index === 4 && "border-primary text-primary hover:bg-primary/10"
              )}
              onClick={() => onSelect(word)}
            >
              {word}
            </Button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground text-center mt-3 sm:mt-4">
          Easier words are worth fewer points if guessed
        </p>
      </div>
    </div>
  );
};
