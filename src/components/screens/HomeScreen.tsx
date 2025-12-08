import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { AVATARS, PublicRoom } from '@/types/game';
import { cn } from '@/lib/utils';
import { Palette, Users, Zap, Mic, Globe, Lock, Copy, Check, RefreshCw, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface HomeScreenProps {
  onCreateRoom: (name: string, avatar: string, isPublic: boolean) => void;
  onJoinRoom: (code: string, name: string, avatar: string) => void;
}

export const HomeScreen = ({ onCreateRoom, onJoinRoom }: HomeScreenProps) => {
  const [mode, setMode] = useState<'home' | 'create' | 'join' | 'browse'>('home');
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [roomCode, setRoomCode] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [publicRooms, setPublicRooms] = useState<PublicRoom[]>([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Check for room code in URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const codeFromUrl = params.get('room');
    if (codeFromUrl && codeFromUrl.length === 6) {
      setRoomCode(codeFromUrl.toUpperCase());
      setMode('join');
    }
  }, []);

  // Fetch public rooms
  const fetchPublicRooms = async () => {
    setIsLoadingRooms(true);
    try {
      const { data, error } = await supabase.functions.invoke('signaling', {
        body: { action: 'get-public-rooms' }
      });

      if (error) throw error;
      if (data?.rooms) {
        setPublicRooms(data.rooms);
      }
    } catch (error) {
      console.error('Failed to fetch public rooms:', error);
      toast.error('Failed to load public rooms');
    } finally {
      setIsLoadingRooms(false);
    }
  };

  useEffect(() => {
    if (mode === 'browse') {
      fetchPublicRooms();
    }
  }, [mode]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (mode === 'create') {
      onCreateRoom(name.trim(), avatar, isPublic);
    } else if (mode === 'join' && roomCode.trim()) {
      onJoinRoom(roomCode.trim().toUpperCase(), name.trim(), avatar);
    }
  };

  const handleJoinPublicRoom = (code: string) => {
    if (!name.trim()) {
      toast.error('Please enter your name first');
      return;
    }
    onJoinRoom(code, name.trim(), avatar);
  };

  const getShareableLink = (code: string) => {
    return `${window.location.origin}?room=${code}`;
  };

  const copyShareLink = async (code: string) => {
    const link = getShareableLink(code);
    await navigator.clipboard.writeText(link);
    setCopiedLink(true);
    toast.success('Link copied to clipboard!');
    setTimeout(() => setCopiedLink(false), 2000);
  };

  if (mode === 'home') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-background via-background to-primary/10">
        <div className="text-center mb-12 animate-slide-up">
          <div className="text-8xl mb-4 animate-float">🎨</div>
          <h1 className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-primary via-game-purple to-game-info bg-clip-text text-transparent">
            DrawParty
          </h1>
          <p className="text-xl text-muted-foreground mt-4 max-w-md mx-auto">
            Draw, guess, and have fun with friends in real-time!
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 mb-8 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <Button
            size="lg"
            className="h-16 px-8 text-lg gap-3 animate-pulse-glow"
            onClick={() => setMode('create')}
          >
            <Palette className="w-6 h-6" />
            Create Room
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="h-16 px-8 text-lg gap-3"
            onClick={() => setMode('join')}
          >
            <Users className="w-6 h-6" />
            Join Room
          </Button>
        </div>

        <Button
          variant="secondary"
          size="lg"
          className="mb-12 gap-2 animate-slide-up"
          style={{ animationDelay: '0.15s' }}
          onClick={() => setMode('browse')}
        >
          <Globe className="w-5 h-5" />
          Browse Public Rooms
        </Button>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-2xl animate-slide-up" style={{ animationDelay: '0.2s' }}>
          {[
            { icon: Palette, title: 'Draw', desc: 'Express your creativity' },
            { icon: Zap, title: 'Fast', desc: 'Real-time gameplay' },
            { icon: Users, title: 'Multiplayer', desc: 'Play with friends' },
            { icon: Mic, title: 'Voice Chat', desc: 'Talk while you play' }
          ].map((feature, i) => (
            <div key={i} className="text-center p-4 bg-card rounded-xl">
              <feature.icon className="w-8 h-8 mx-auto mb-2 text-primary" />
              <h3 className="font-semibold">{feature.title}</h3>
              <p className="text-sm text-muted-foreground">{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (mode === 'browse') {
    return (
      <div className="min-h-screen flex flex-col items-center p-4 bg-gradient-to-br from-background via-background to-primary/10">
        <div className="w-full max-w-2xl">
          <button
            onClick={() => setMode('home')}
            className="text-muted-foreground hover:text-foreground mb-6 text-sm"
          >
            ← Back
          </button>

          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">Public Rooms</h2>
            <Button variant="outline" size="sm" onClick={fetchPublicRooms} disabled={isLoadingRooms}>
              <RefreshCw className={cn("w-4 h-4 mr-2", isLoadingRooms && "animate-spin")} />
              Refresh
            </Button>
          </div>

          {/* Name/Avatar selection for joining */}
          <div className="bg-card p-4 rounded-xl mb-6">
            <Label className="mb-2 block text-sm">Your name & avatar</Label>
            <div className="flex gap-4 items-center">
              <div className="flex gap-2">
                {AVATARS.slice(0, 6).map((a) => (
                  <button
                    key={a}
                    type="button"
                    className={cn(
                      "w-10 h-10 text-xl rounded-lg flex items-center justify-center transition-all",
                      avatar === a
                        ? "bg-primary/20 ring-2 ring-primary scale-110"
                        : "bg-muted hover:bg-muted/80"
                    )}
                    onClick={() => setAvatar(a)}
                  >
                    {a}
                  </button>
                ))}
              </div>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                maxLength={20}
                className="flex-1"
              />
            </div>
          </div>

          {/* Room list */}
          {isLoadingRooms ? (
            <div className="text-center py-12">
              <Loader2 className="w-8 h-8 mx-auto animate-spin text-muted-foreground" />
              <p className="text-muted-foreground mt-2">Loading rooms...</p>
            </div>
          ) : publicRooms.length === 0 ? (
            <div className="text-center py-12 bg-card rounded-xl">
              <Globe className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No public rooms available</p>
              <p className="text-sm text-muted-foreground mt-2">Create one to get started!</p>
              <Button className="mt-4" onClick={() => setMode('create')}>
                Create Room
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {publicRooms.map((room) => (
                <div
                  key={room.id}
                  className="bg-card p-4 rounded-xl flex items-center justify-between hover:bg-card/80 transition-colors"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-lg">{room.code}</span>
                      <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">
                        {room.language}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {room.playerCount}/{room.maxPlayers} players
                    </p>
                  </div>
                  <Button
                    onClick={() => handleJoinPublicRoom(room.code)}
                    disabled={room.playerCount >= room.maxPlayers || !name.trim()}
                  >
                    Join
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-primary/10">
      <div className="w-full max-w-md bg-card p-8 rounded-2xl shadow-xl animate-bounce-in">
        <button
          onClick={() => setMode('home')}
          className="text-muted-foreground hover:text-foreground mb-4 text-sm"
        >
          ← Back
        </button>

        <h2 className="text-2xl font-bold mb-6">
          {mode === 'create' ? 'Create a Room' : 'Join a Room'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Avatar selection */}
          <div>
            <Label className="mb-3 block">Choose your avatar</Label>
            <div className="grid grid-cols-6 gap-2">
              {AVATARS.slice(0, 18).map((a) => (
                <button
                  key={a}
                  type="button"
                  className={cn(
                    "w-12 h-12 text-2xl rounded-xl flex items-center justify-center transition-all hover:scale-110",
                    avatar === a
                      ? "bg-primary/20 ring-2 ring-primary scale-110"
                      : "bg-muted hover:bg-muted/80"
                  )}
                  onClick={() => setAvatar(a)}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>

          {/* Name input */}
          <div>
            <Label htmlFor="name">Your name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              maxLength={20}
              className="mt-2"
            />
          </div>

          {/* Room code (join only) */}
          {mode === 'join' && (
            <div>
              <Label htmlFor="code">Room code</Label>
              <Input
                id="code"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="Enter 6-digit code"
                maxLength={6}
                className="mt-2 text-center text-2xl tracking-widest font-mono"
              />
            </div>
          )}

          {/* Public/Private toggle (create only) */}
          {mode === 'create' && (
            <div className="flex items-center justify-between p-4 bg-muted rounded-xl">
              <div className="flex items-center gap-3">
                {isPublic ? (
                  <Globe className="w-5 h-5 text-primary" />
                ) : (
                  <Lock className="w-5 h-5 text-muted-foreground" />
                )}
                <div>
                  <Label className="text-sm font-medium">
                    {isPublic ? 'Public Room' : 'Private Room'}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {isPublic
                      ? 'Anyone can find and join'
                      : 'Only people with the code can join'}
                  </p>
                </div>
              </div>
              <Switch
                checked={isPublic}
                onCheckedChange={setIsPublic}
              />
            </div>
          )}

          <Button
            type="submit"
            className="w-full h-12 text-lg"
            disabled={!name.trim() || (mode === 'join' && roomCode.length !== 6)}
          >
            {mode === 'create' ? 'Create Room' : 'Join Room'}
          </Button>
        </form>
      </div>
    </div>
  );
};
