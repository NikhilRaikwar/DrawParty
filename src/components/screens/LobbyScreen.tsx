import { GameState, RoomSettings, Player, ChatMessage } from '@/types/game';
import { PlayerCard } from '@/components/game/PlayerCard';
import { ChatBox } from '@/components/game/ChatBox';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Copy, Check, Play, Settings, Loader2, X, Share2, Globe, Lock } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { toast } from 'sonner';

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
  onStartGame,
  onSendMessage,
  onLeave
}: LobbyScreenProps) => {
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const copyRoomCode = async () => {
    await navigator.clipboard.writeText(roomCode);
    setCopied(true);
    toast.success('Room code copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const copyShareLink = async () => {
    const link = `${window.location.origin}?room=${roomCode}`;
    await navigator.clipboard.writeText(link);
    setCopiedLink(true);
    toast.success('Invite link copied!');
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Settings panel content (shared between desktop and mobile)
  const SettingsPanel = () => (
    <div className="space-y-5">
      {/* Max Players */}
      <div>
        <Label className="text-sm">Max Players: {settings.maxPlayers}</Label>
        <Slider
          value={[settings.maxPlayers]}
          onValueChange={([v]) => onSettingsChange({ ...settings, maxPlayers: v })}
          min={2}
          max={12}
          step={1}
          className="mt-2"
        />
      </div>

      {/* Draw Time */}
      <div>
        <Label className="text-sm">Draw Time: {settings.drawTime}s</Label>
        <Slider
          value={[settings.drawTime]}
          onValueChange={([v]) => onSettingsChange({ ...settings, drawTime: v })}
          min={30}
          max={240}
          step={10}
          className="mt-2"
        />
      </div>

      {/* Rounds */}
      <div>
        <Label className="text-sm">Rounds: {settings.totalRounds}</Label>
        <Slider
          value={[settings.totalRounds]}
          onValueChange={([v]) => onSettingsChange({ ...settings, totalRounds: v })}
          min={1}
          max={10}
          step={1}
          className="mt-2"
        />
      </div>

      {/* Word Count */}
      <div>
        <Label className="text-sm">Word Choices: {settings.wordCount}</Label>
        <Slider
          value={[settings.wordCount]}
          onValueChange={([v]) => onSettingsChange({ ...settings, wordCount: v })}
          min={2}
          max={5}
          step={1}
          className="mt-2"
        />
      </div>

      {/* Language */}
      <div>
        <Label className="text-sm">Language</Label>
        <Select
          value={settings.language}
          onValueChange={(v: 'english' | 'spanish' | 'french' | 'german') => 
            onSettingsChange({ ...settings, language: v })
          }
        >
          <SelectTrigger className="mt-2">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="english">English</SelectItem>
            <SelectItem value="spanish">Spanish</SelectItem>
            <SelectItem value="french">French</SelectItem>
            <SelectItem value="german">German</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Game Mode */}
      <div>
        <Label className="text-sm">Game Mode</Label>
        <Select
          value={settings.gameMode}
          onValueChange={(v: 'normal' | 'hidden' | 'combination') => 
            onSettingsChange({ ...settings, gameMode: v })
          }
        >
          <SelectTrigger className="mt-2">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="normal">Normal</SelectItem>
            <SelectItem value="hidden">Hidden (Coming Soon)</SelectItem>
            <SelectItem value="combination">Combination (Coming Soon)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Hints Level */}
      <div>
        <Label className="text-sm">Hints Level: {settings.hintLevel}</Label>
        <Slider
          value={[settings.hintLevel]}
          onValueChange={([v]) => onSettingsChange({ ...settings, hintLevel: v })}
          min={0}
          max={5}
          step={1}
          className="mt-2"
          disabled={!settings.showHints}
        />
      </div>

      {/* Show Hints Toggle */}
      <div className="flex items-center justify-between">
        <Label className="text-sm">Show Hints</Label>
        <Switch
          checked={settings.showHints}
          onCheckedChange={(v) => onSettingsChange({ ...settings, showHints: v })}
        />
      </div>

      {/* Public Room Toggle */}
      <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
        <div className="flex items-center gap-2">
          {settings.isPublic ? (
            <Globe className="w-4 h-4 text-primary" />
          ) : (
            <Lock className="w-4 h-4 text-muted-foreground" />
          )}
          <div>
            <Label className="text-sm">{settings.isPublic ? 'Public Room' : 'Private Room'}</Label>
            <p className="text-xs text-muted-foreground">
              {settings.isPublic ? 'Visible in browser' : 'Invite only'}
            </p>
          </div>
        </div>
        <Switch
          checked={settings.isPublic}
          onCheckedChange={(v) => onSettingsChange({ ...settings, isPublic: v })}
        />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/10 p-2 sm:p-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-4 sm:mb-8">
          <Button variant="ghost" onClick={onLeave} className="self-start sm:self-auto">
            ← Leave
          </Button>
          
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="text-xs sm:text-sm text-muted-foreground">Room Code:</span>
            <button
              onClick={copyRoomCode}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-card rounded-xl font-mono text-xl sm:text-2xl font-bold tracking-widest hover:bg-card/80 transition-colors"
            >
              {roomCode}
              {copied ? (
                <Check className="w-4 h-4 sm:w-5 sm:h-5 text-game-success" />
              ) : (
                <Copy className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
              )}
            </button>
            <Button
              variant="outline"
              size="icon"
              onClick={copyShareLink}
              title="Copy invite link"
            >
              {copiedLink ? (
                <Check className="w-4 h-4 text-game-success" />
              ) : (
                <Share2 className="w-4 h-4" />
              )}
            </Button>
          </div>
          
          {/* Settings button - mobile uses sheet, desktop uses inline */}
          {isHost && (
            <>
              {/* Mobile settings sheet */}
              <Sheet open={showSettings} onOpenChange={setShowSettings}>
                <SheetTrigger asChild className="sm:hidden">
                  <Button variant="outline" size="icon">
                    <Settings className="w-5 h-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[300px] overflow-y-auto">
                  <SheetHeader>
                    <SheetTitle>Game Settings</SheetTitle>
                  </SheetHeader>
                  <div className="mt-6">
                    <SettingsPanel />
                  </div>
                </SheetContent>
              </Sheet>
              
              {/* Desktop settings toggle */}
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowSettings(!showSettings)}
                className="hidden sm:flex"
              >
                <Settings className="w-5 h-5" />
              </Button>
            </>
          )}
        </div>

        {/* Room visibility indicator */}
        <div className="flex justify-center mb-4">
          <div className={cn(
            "flex items-center gap-2 px-3 py-1 rounded-full text-sm",
            settings.isPublic ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
          )}>
            {settings.isPublic ? (
              <>
                <Globe className="w-4 h-4" />
                Public Room
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                Private Room
              </>
            )}
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-4 sm:gap-8">
          {/* Players list */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg sm:text-xl font-bold">
                Players ({players.length}/{settings.maxPlayers})
              </h2>
            </div>

            <div className="grid gap-2 sm:gap-3">
              {players.length === 0 ? (
                <div className="bg-card rounded-xl p-6 sm:p-8 text-center">
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

            <div className="flex gap-3 pt-2 sm:pt-4">
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
              <p className="text-xs sm:text-sm text-muted-foreground text-center">
                {players.length < 2
                  ? 'Need at least 2 players to start'
                  : 'Waiting for all players to be ready'}
              </p>
            )}
          </div>

          {/* Right sidebar */}
          <div className="space-y-4">
            {/* Settings panel (desktop only - host only) */}
            {isHost && showSettings && (
              <div className="hidden sm:block bg-card p-4 sm:p-6 rounded-xl animate-slide-up">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-lg">Game Settings</h3>
                  <Button variant="ghost" size="icon" onClick={() => setShowSettings(false)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <SettingsPanel />
              </div>
            )}

            {/* Chat */}
            <div className="h-64 sm:h-80">
              <ChatBox
                messages={messages}
                onSendMessage={onSendMessage}
                placeholder="Chat with players..."
              />
            </div>

            {/* Invite section */}
            <div className="bg-card p-4 sm:p-6 rounded-xl">
              <h3 className="font-semibold mb-3">Invite Friends</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Share this link with friends to invite them:
              </p>
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={copyShareLink}
              >
                {copiedLink ? (
                  <>
                    <Check className="w-4 h-4" />
                    Link Copied!
                  </>
                ) : (
                  <>
                    <Share2 className="w-4 h-4" />
                    Copy Invite Link
                  </>
                )}
              </Button>
            </div>

            {/* Waiting animation */}
            {(!showSettings || !isHost) && (
              <div className="flex flex-col items-center justify-center bg-card p-6 sm:p-8 rounded-xl">
                <div className="text-5xl sm:text-6xl mb-4 animate-float">🎮</div>
                <p className="text-center text-muted-foreground text-sm sm:text-base">
                  Waiting for players to join...
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
