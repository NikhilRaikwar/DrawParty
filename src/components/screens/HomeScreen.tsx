import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AVATARS } from '@/types/game';
import { cn } from '@/lib/utils';
import { Palette, Users, Zap, Mic } from 'lucide-react';

interface HomeScreenProps {
  onCreateRoom: (name: string, avatar: string) => void;
  onJoinRoom: (code: string, name: string, avatar: string) => void;
}

export const HomeScreen = ({ onCreateRoom, onJoinRoom }: HomeScreenProps) => {
  const [mode, setMode] = useState<'home' | 'create' | 'join'>('home');
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [roomCode, setRoomCode] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (mode === 'create') {
      onCreateRoom(name.trim(), avatar);
    } else if (mode === 'join' && roomCode.trim()) {
      onJoinRoom(roomCode.trim().toUpperCase(), name.trim(), avatar);
    }
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

        <div className="flex flex-col sm:flex-row gap-4 mb-12 animate-slide-up" style={{ animationDelay: '0.1s' }}>
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
