import { GameState, RoomSettings, Player, ChatMessage } from '@/types/game';
import { PlayerCard } from '@/components/game/PlayerCard';
import { ChatBox } from '@/components/game/ChatBox';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Copy, Check, UserPlus, Play, Settings, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface LobbyScreenProps {
  roomCode: string;
  players: Player[];
  messages: ChatMessage[];
  settings: RoomSettings;
  currentPlayer: Player | undefined;
  isHost: boolean;
  canStartGame: boolean;
  isLoading?: boolean;
  onSettingsChange: (settings: RoomSettings) => void;
  onToggleReady: () => void;
  onAddBot: () => void;
  onStartGame: () => void;
  onSendMessage: (message: string) => void;
  onLeave: () => void;
}

export const LobbyScreen = ({
  roomCode,
  players,
  messages,
  settings,
  currentPlayer,
  isHost,
  canStartGame,
  isLoading,
  onSettingsChange,
  onToggleReady,
  onAddBot,
  onStartGame,
  onSendMessage,
  onLeave
}: LobbyScreenProps) => {
  const [copied, setCopied] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const copyRoomCode = async () => {
    await navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/10 p-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Button variant="ghost" onClick={onLeave}>
            ← Leave
          </Button>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Room Code:</span>
            <button
              onClick={copyRoomCode}
              className="flex items-center gap-2 px-4 py-2 bg-card rounded-xl font-mono text-2xl font-bold tracking-widest hover:bg-card/80 transition-colors"
            >
              {roomCode}
              {copied ? (
                <Check className="w-5 h-5 text-game-success" />
              ) : (
                <Copy className="w-5 h-5 text-muted-foreground" />
              )}
            </button>
          </div>
          {isHost && (
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowSettings(!showSettings)}
            >
              <Settings className="w-5 h-5" />
            </Button>
          )}
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Players list */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">
                Players ({players.length}/8)
              </h2>
              {isHost && players.length < 8 && (
                <Button variant="outline" size="sm" onClick={onAddBot}>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Add Bot
                </Button>
              )}
            </div>

            <div className="grid gap-3">
              {players.length === 0 ? (
                <div className="bg-card rounded-xl p-8 text-center">
                  <Loader2 className="w-8 h-8 mx-auto animate-spin text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">Loading players...</p>
                </div>
              ) : (
                players.map((player) => (
                  <PlayerCard
                    key={player.id}
                    player={player}
                    isCurrentPlayer={player.id === currentPlayer?.id}
                    showScore={false}
                  />
                ))
              )}
            </div>

            <div className="flex gap-3 pt-4">
              {!isHost && (
                <Button
                  variant={currentPlayer?.isReady ? 'secondary' : 'default'}
                  className="flex-1"
                  onClick={onToggleReady}
                  disabled={isLoading}
                >
                  {currentPlayer?.isReady ? 'Not Ready' : 'Ready!'}
                </Button>
              )}
              {isHost && (
                <Button
                  className="flex-1"
                  disabled={!canStartGame || isLoading}
                  onClick={onStartGame}
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  ) : (
                    <Play className="w-5 h-5 mr-2" />
                  )}
                  Start Game
                </Button>
              )}
            </div>

            {!canStartGame && isHost && (
              <p className="text-sm text-muted-foreground text-center">
                {players.length < 2
                  ? 'Need at least 2 players to start'
                  : 'Waiting for all players to be ready'}
              </p>
            )}
          </div>

          {/* Right sidebar */}
          <div className="space-y-4">
            {/* Settings panel (host only) */}
            {isHost && showSettings && (
              <div className="bg-card p-6 rounded-xl space-y-6 animate-slide-up">
                <h3 className="font-bold text-lg">Game Settings</h3>

                <div className="space-y-4">
                  <div>
                    <Label>Draw Time: {settings.drawTime}s</Label>
                    <Slider
                      value={[settings.drawTime]}
                      onValueChange={([v]) =>
                        onSettingsChange({ ...settings, drawTime: v })
                      }
                      min={30}
                      max={180}
                      step={10}
                      className="mt-2"
                    />
                  </div>

                  <div>
                    <Label>Rounds: {settings.totalRounds}</Label>
                    <Slider
                      value={[settings.totalRounds]}
                      onValueChange={([v]) =>
                        onSettingsChange({ ...settings, totalRounds: v })
                      }
                      min={1}
                      max={10}
                      step={1}
                      className="mt-2"
                    />
                  </div>

                  <div>
                    <Label>Hints Level: {settings.hintLevel}</Label>
                    <Slider
                      value={[settings.hintLevel]}
                      onValueChange={([v]) =>
                        onSettingsChange({ ...settings, hintLevel: v })
                      }
                      min={0}
                      max={5}
                      step={1}
                      className="mt-2"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label>Public Room</Label>
                    <Switch
                      checked={settings.isPublic}
                      onCheckedChange={(v) =>
                        onSettingsChange({ ...settings, isPublic: v })
                      }
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Chat */}
            <div className="h-80">
              <ChatBox
                messages={messages}
                onSendMessage={onSendMessage}
                placeholder="Chat with players..."
              />
            </div>

            {/* Waiting animation */}
            {!showSettings && (
              <div className="flex flex-col items-center justify-center bg-card p-8 rounded-xl">
                <div className="text-6xl mb-4 animate-float">🎮</div>
                <p className="text-center text-muted-foreground">
                  Waiting for players to join...
                </p>
                <p className="text-sm text-center text-muted-foreground mt-2">
                  Share the room code with your friends!
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
