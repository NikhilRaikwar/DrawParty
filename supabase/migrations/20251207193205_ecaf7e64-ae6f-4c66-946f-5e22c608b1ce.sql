-- Create table for game rooms
CREATE TABLE public.rooms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  host_id TEXT NOT NULL,
  settings JSONB NOT NULL DEFAULT '{"maxPlayers": 8, "drawTime": 80, "totalRounds": 3, "isPublic": true, "hintLevel": 2, "gameMode": "normal"}'::jsonb,
  game_state JSONB NOT NULL DEFAULT '{"phase": "lobby", "currentRound": 0, "totalRounds": 3, "currentDrawerId": null, "currentWord": null, "wordHint": "", "timeRemaining": 80, "drawTime": 80, "players": [], "messages": [], "correctGuessers": []}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for players in rooms
CREATE TABLE public.room_players (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL,
  player_name TEXT NOT NULL,
  avatar TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  is_host BOOLEAN NOT NULL DEFAULT false,
  is_ready BOOLEAN NOT NULL DEFAULT false,
  is_muted BOOLEAN NOT NULL DEFAULT false,
  is_connected BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(room_id, player_id)
);

-- Create table for chat messages
CREATE TABLE public.room_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL,
  player_name TEXT NOT NULL,
  content TEXT NOT NULL,
  is_correct_guess BOOLEAN NOT NULL DEFAULT false,
  is_system_message BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security (public game - no auth required)
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_messages ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (game doesn't require authentication)
CREATE POLICY "Allow public read access to rooms" ON public.rooms FOR SELECT USING (true);
CREATE POLICY "Allow public insert access to rooms" ON public.rooms FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access to rooms" ON public.rooms FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access to rooms" ON public.rooms FOR DELETE USING (true);

CREATE POLICY "Allow public read access to room_players" ON public.room_players FOR SELECT USING (true);
CREATE POLICY "Allow public insert access to room_players" ON public.room_players FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access to room_players" ON public.room_players FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access to room_players" ON public.room_players FOR DELETE USING (true);

CREATE POLICY "Allow public read access to room_messages" ON public.room_messages FOR SELECT USING (true);
CREATE POLICY "Allow public insert access to room_messages" ON public.room_messages FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public delete access to room_messages" ON public.room_messages FOR DELETE USING (true);

-- Enable realtime for all tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_players;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_messages;

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_rooms_updated_at
  BEFORE UPDATE ON public.rooms
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to clean up old rooms (older than 24 hours)
CREATE OR REPLACE FUNCTION public.cleanup_old_rooms()
RETURNS void AS $$
BEGIN
  DELETE FROM public.rooms WHERE updated_at < now() - interval '24 hours';
END;
$$ LANGUAGE plpgsql SET search_path = public;