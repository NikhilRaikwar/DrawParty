import { cn } from '@/lib/utils';

interface WordDisplayProps {
  word: string | null;
  hint: string;
  isDrawer: boolean;
  phase: 'lobby' | 'wordSelection' | 'drawing' | 'revealing' | 'roundEnd' | 'gameEnd';
}

export const WordDisplay = ({ word, hint, isDrawer, phase }: WordDisplayProps) => {
  if (phase === 'lobby') {
    return (
      <div className="text-center">
        <p className="text-lg text-muted-foreground">Waiting for the game to start...</p>
      </div>
    );
  }

  if (phase === 'wordSelection') {
    return (
      <div className="text-center">
        <p className="text-lg text-muted-foreground">
          {isDrawer ? 'Choose a word to draw!' : 'Waiting for drawer to pick a word...'}
        </p>
      </div>
    );
  }

  if (phase === 'revealing' || phase === 'roundEnd') {
    return (
      <div className="text-center animate-bounce-in">
        <p className="text-sm text-muted-foreground mb-1">The word was:</p>
        <p className="text-3xl font-bold text-game-success">{word}</p>
      </div>
    );
  }

  return (
    <div className="text-center">
      <p className="text-sm text-muted-foreground mb-2">
        {isDrawer ? 'Draw this word:' : 'Guess the word:'}
      </p>
      <div className="flex items-center justify-center gap-2">
        {isDrawer ? (
          <span className="text-3xl font-bold text-primary">{word}</span>
        ) : (
          <div className="flex gap-1">
            {hint.split('').map((char, i) => (
              <span
                key={i}
                className={cn(
                  "w-8 h-10 flex items-center justify-center text-2xl font-bold rounded-lg",
                  char === '_' ? "bg-muted border-b-4 border-primary" : "bg-primary/20 text-primary",
                  char === ' ' && "w-4 bg-transparent border-0"
                )}
              >
                {char === '_' ? '' : char}
              </span>
            ))}
          </div>
        )}
      </div>
      {!isDrawer && (
        <p className="text-xs text-muted-foreground mt-2">
          {word?.length} letters {word?.includes(' ') ? `(${word.split(' ').map(w => w.length).join(', ')})` : ''}
        </p>
      )}
    </div>
  );
};
