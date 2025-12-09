import { cn } from '@/lib/utils';

interface WordDisplayProps {
  word: string | null;
  hint: string;
  isDrawer: boolean;
  phase: 'lobby' | 'wordSelection' | 'drawing' | 'revealing' | 'roundEnd' | 'gameEnd';
  currentDrawerName?: string;
  hasGuessedCorrectly?: boolean;
  timeRemaining?: number;
  drawTime?: number;
}

export const WordDisplay = ({ 
  word, 
  hint, 
  isDrawer, 
  phase,
  currentDrawerName,
  hasGuessedCorrectly = false,
  timeRemaining = 0,
  drawTime = 80
}: WordDisplayProps) => {
  // Lobby state
  if (phase === 'lobby') {
    return (
      <div className="text-center">
        <p className="text-xs sm:text-sm lg:text-lg text-muted-foreground">Waiting for the game to start...</p>
      </div>
    );
  }

  // Word selection phase
  if (phase === 'wordSelection') {
    return (
      <div className="text-center">
        <p className="text-xs sm:text-sm lg:text-lg text-muted-foreground">
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
        <p className="text-xs text-muted-foreground mb-0.5 sm:mb-1">The word was:</p>
        <p className="text-lg sm:text-2xl lg:text-3xl font-bold text-game-success">{word}</p>
      </div>
    );
  }

  // Game end
  if (phase === 'gameEnd') {
    return (
      <div className="text-center">
        <p className="text-lg sm:text-xl lg:text-2xl font-bold text-primary">Game Over!</p>
      </div>
    );
  }

  // Drawing phase - drawer sees word, others see blanks or revealed word if guessed
  // Parse hint to show revealed letters
  const hintChars = hint.split('');
  const wordLength = word?.length || hint.replace(/ /g, '').length;
  
  return (
    <div className="text-center px-2">
      <p className="text-[10px] sm:text-xs text-muted-foreground mb-0.5 sm:mb-1">
        {isDrawer ? (
          <span className="text-primary font-semibold">Your word:</span>
        ) : hasGuessedCorrectly ? (
          <span className="text-game-success font-semibold">You guessed it! ✓</span>
        ) : (
          <span>Guess the word:</span>
        )}
      </p>
      
      <div className="flex items-center justify-center gap-0.5 sm:gap-1 flex-wrap max-w-full">
        {isDrawer || hasGuessedCorrectly ? (
          // Show full word to drawer or correct guessers
          <span className={cn(
            "text-base sm:text-xl lg:text-2xl font-bold tracking-wide",
            hasGuessedCorrectly ? "text-game-success" : "text-primary"
          )}>
            {word}
          </span>
        ) : (
          // Show blanks with any revealed hints to guessers
          <div className="flex gap-[2px] sm:gap-1 flex-wrap justify-center">
            {hintChars.map((char, i) => {
              const isSpace = char === ' ';
              const isRevealed = char !== '_' && char !== ' ';
              
              return (
                <span
                  key={i}
                  className={cn(
                    "flex items-center justify-center font-bold rounded transition-all",
                    isSpace 
                      ? "w-1.5 sm:w-3 bg-transparent" 
                      : isRevealed
                      ? "w-4 h-5 sm:w-6 sm:h-8 lg:w-8 lg:h-10 bg-primary/20 text-primary text-sm sm:text-lg lg:text-xl"
                      : "w-4 h-5 sm:w-6 sm:h-8 lg:w-8 lg:h-10 bg-muted border-b-2 sm:border-b-3 border-primary"
                  )}
                >
                  {isRevealed ? char : ''}
                </span>
              );
            })}
          </div>
        )}
      </div>
      
      {/* Word length info for guessers */}
      {!isDrawer && !hasGuessedCorrectly && word && (
        <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1">
          {word.length} letters {word.includes(' ') ? `(${word.split(' ').map(w => w.length).join(', ')})` : ''}
        </p>
      )}
    </div>
  );
};
