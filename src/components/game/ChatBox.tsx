import { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '@/types/game';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatBoxProps {
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
  hideMessages?: boolean;
}

export const ChatBox = ({
  messages,
  onSendMessage,
  disabled = false,
  placeholder = "Type your guess...",
  hideMessages = false
}: ChatBoxProps) => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !disabled) {
      onSendMessage(input.trim());
      setInput('');
    }
  };

  // Simplified version for mobile quick input
  if (hideMessages) {
    return (
      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="flex-1"
        />
        <Button type="submit" disabled={disabled || !input.trim()} size="icon">
          <Send className="w-4 h-4" />
        </Button>
      </form>
    );
  }

  return (
    <div className="flex flex-col h-full bg-card rounded-xl overflow-hidden">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            No messages yet
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "animate-slide-up",
                message.isSystemMessage && "text-center"
              )}
            >
              {message.isSystemMessage ? (
                <span className="inline-block px-3 py-1 bg-muted rounded-full text-xs sm:text-sm text-muted-foreground">
                  {message.content}
                </span>
              ) : (
                <div
                  className={cn(
                    "p-2 rounded-lg",
                    message.isCorrectGuess
                      ? "bg-game-success/20 animate-correct-guess"
                      : "bg-muted/50"
                  )}
                >
                  <span className={cn(
                    "font-semibold text-xs sm:text-sm",
                    message.isCorrectGuess && "text-game-success"
                  )}>
                    {message.playerName}:
                  </span>{' '}
                  <span className={cn(
                    "text-xs sm:text-sm",
                    message.isCorrectGuess && "text-game-success font-medium"
                  )}>
                    {message.content}
                  </span>
                </div>
              )}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-2 sm:p-3 border-t border-border">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            className="flex-1 text-sm"
          />
          <Button type="submit" disabled={disabled || !input.trim()} size="icon">
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </form>
    </div>
  );
};
