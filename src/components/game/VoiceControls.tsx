import { Button } from '@/components/ui/button';
import { Mic, MicOff, Phone, PhoneOff, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VoiceControlsProps {
  isVoiceEnabled: boolean;
  isMuted: boolean;
  isConnecting: boolean;
  onEnableVoice: () => void;
  onDisableVoice: () => void;
  onToggleMute: () => void;
}

export const VoiceControls = ({
  isVoiceEnabled,
  isMuted,
  isConnecting,
  onEnableVoice,
  onDisableVoice,
  onToggleMute
}: VoiceControlsProps) => {
  return (
    <div className="flex items-center gap-2">
      {!isVoiceEnabled ? (
        <Button
          variant="outline"
          size="sm"
          onClick={onEnableVoice}
          disabled={isConnecting}
          className="gap-2"
        >
          {isConnecting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Connecting...
            </>
          ) : (
            <>
              <Phone className="w-4 h-4" />
              Join Voice
            </>
          )}
        </Button>
      ) : (
        <>
          <Button
            variant={isMuted ? 'destructive' : 'outline'}
            size="icon"
            onClick={onToggleMute}
            className={cn(
              "relative transition-all",
              !isMuted && "ring-2 ring-game-success/50"
            )}
          >
            {isMuted ? (
              <MicOff className="w-5 h-5" />
            ) : (
              <Mic className="w-5 h-5" />
            )}
            {!isMuted && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-game-success rounded-full animate-pulse" />
            )}
          </Button>
          
          <Button
            variant="outline"
            size="icon"
            onClick={onDisableVoice}
            className="text-destructive hover:bg-destructive/10"
          >
            <PhoneOff className="w-5 h-5" />
          </Button>
        </>
      )}
      
      <div className="flex items-center gap-1 px-3 py-1.5 bg-muted rounded-full">
        <span className="text-xs text-muted-foreground">Voice Chat</span>
        <div className={cn(
          "w-2 h-2 rounded-full ml-1",
          isVoiceEnabled ? "bg-game-success" : "bg-muted-foreground"
        )} />
      </div>
    </div>
  );
};
