import { cn } from '@/lib/utils';
import { Player } from '@/types/game';

interface WordDisplayProps {
  word: string | null;
  hint: string;
  isDrawer: boolean;
  phase: 'lobby' | 'wordSelection' | 'drawing' | 'revealing' | 'roundEnd' | 'gameEnd';
  currentDrawerName?: string;
  hasGuessedCorrectly?: boolean;
}

export const WordDisplay = ({ 
  word, 
  hint, 
  isDrawer, 
  phase,
  currentDrawerName,
  hasGuessedCorrectly = false
}: WordDisplayProps) => {
  // Lobby state
  if (phase === 'lobby') {
    return (
      <div className="text-center">
        <p className="text-sm sm:text-lg text-muted-foreground">Waiting for the game to start...</p>
      </div>
    );
  }

  // Word selection phase
  if (phase === 'wordSelection') {
    return (
      <div className="text-center">
        <p className="text-sm sm:text-lg text-muted-foreground">
          {isDrawer ? (
            <span className="text-primary font-semibold animate-pulse">Choose a word to draw!</span>
          ) : (
            <span>{currentDrawerName || 'Drawer'} is picking a word...</span>
          )}
        </p>
      </div>
    );
  }

  // Revealing or round end - show the word to everyone
  if (phase === 'revealing' || phase === 'roundEnd') {
    return (
      <div className="text-center animate-bounce-in">
        <p className="text-xs sm:text-sm text-muted-foreground mb-1">The word was:</p>
        <p className="text-xl sm:text-3xl font-bold text-game-success">{word}</p>
      </div>
    );
  }

  // Game end
  if (phase === 'gameEnd') {
    return (
      <div className="text-center">
        <p className="text-xl sm:text-2xl font-bold text-primary">Game Over!</p>
      </div>
    );
  }

  // Drawing phase - drawer sees word, others see blanks or revealed word if guessed
  return (
    <div className="text-center">
      <p className="text-xs sm:text-sm text-muted-foreground mb-1 sm:mb-2">
        {isDrawer ? (
          <span className="text-primary font-semibold">Your word:</span>
        ) : hasGuessedCorrectly ? (
          <span className="text-game-success font-semibold">You guessed it! ✓</span>
        ) : (
          <span>Guess the word:</span>
        )}
      </p>
      
      <div className="flex items-center justify-center gap-1 sm:gap-2 flex-wrap max-w-full px-2">
        {isDrawer || hasGuessedCorrectly ? (
          // Show full word to drawer or correct guessers
          <span className={cn(
            "text-xl sm:text-3xl font-bold",
            hasGuessedCorrectly ? "text-game-success" : "text-primary"
          )}>
            {word}
          </span>
        ) : (
          // Show blanks to guessers
          <div className="flex gap-0.5 sm:gap-1 flex-wrap justify-center">
            {hint.split('').map((char, i) => (
              <span
                key={i}
                className={cn(
                  "flex items-center justify-center text-lg sm:text-2xl font-bold rounded-md sm:rounded-lg",
                  char === '_' 
                    ? "w-5 h-6 sm:w-8 sm:h-10 bg-muted border-b-2 sm:border-b-4 border-primary" 
                    : char === ' ' 
                    ? "w-2 sm:w-4 bg-transparent" 
                    : "w-5 h-6 sm:w-8 sm:h-10 bg-primary/20 text-primary"
                )}
              >
                {char === '_' ? '' : char === ' ' ? '' : char}
              </span>
            ))}
          </div>
        )}
      </div>
      
      {!isDrawer && !hasGuessedCorrectly && word && (
        <p className="text-xs text-muted-foreground mt-1 sm:mt-2">
          {word.length} letters {word.includes(' ') ? `(${word.split(' ').map(w => w.length).join(', ')})` : ''}
        </p>
      )}
    </div>
  );
};
