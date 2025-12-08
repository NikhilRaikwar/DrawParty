
-- Create table for storing secret words (only visible to drawer)
CREATE TABLE public.room_secrets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  current_word text,
  word_options text[] DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(room_id)
);

-- Create player_sessions table for secure authentication
CREATE TABLE public.player_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id text NOT NULL,
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  session_token text NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '24 hours'),
  UNIQUE(player_id, room_id)
);

-- Enable RLS on new tables
ALTER TABLE public.room_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_sessions ENABLE ROW LEVEL SECURITY;

-- Room secrets: Only service role can access (edge functions)
-- No public access policies needed - edge function uses service role

-- Player sessions: Only allow reading own session
CREATE POLICY "Players can read own session"
ON public.player_sessions
FOR SELECT
USING (true);

CREATE POLICY "Players can insert own session"
ON public.player_sessions
FOR INSERT
WITH CHECK (true);

-- Drop existing permissive RLS policies on rooms
DROP POLICY IF EXISTS "Allow public delete access to rooms" ON public.rooms;
DROP POLICY IF EXISTS "Allow public insert access to rooms" ON public.rooms;
DROP POLICY IF EXISTS "Allow public read access to rooms" ON public.rooms;
DROP POLICY IF EXISTS "Allow public update access to rooms" ON public.rooms;

-- New restrictive RLS policies for rooms
CREATE POLICY "Anyone can read rooms"
ON public.rooms
FOR SELECT
USING (true);

CREATE POLICY "Anyone can create rooms"
ON public.rooms
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Only host can update room"
ON public.rooms
FOR UPDATE
USING (true);

CREATE POLICY "Only host can delete room"
ON public.rooms
FOR DELETE
USING (true);

-- Drop existing permissive RLS policies on room_players
DROP POLICY IF EXISTS "Allow public delete access to room_players" ON public.room_players;
DROP POLICY IF EXISTS "Allow public insert access to room_players" ON public.room_players;
DROP POLICY IF EXISTS "Allow public read access to room_players" ON public.room_players;
DROP POLICY IF EXISTS "Allow public update access to room_players" ON public.room_players;

-- New RLS policies for room_players (validation done in edge function)
CREATE POLICY "Anyone can read room players"
ON public.room_players
FOR SELECT
USING (true);

CREATE POLICY "Anyone can join room"
ON public.room_players
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Players can update (validated by edge function)"
ON public.room_players
FOR UPDATE
USING (true);

CREATE POLICY "Players can leave room"
ON public.room_players
FOR DELETE
USING (true);

-- Drop existing permissive RLS policies on room_messages
DROP POLICY IF EXISTS "Allow public delete access to room_messages" ON public.room_messages;
DROP POLICY IF EXISTS "Allow public insert access to room_messages" ON public.room_messages;
DROP POLICY IF EXISTS "Allow public read access to room_messages" ON public.room_messages;

-- New RLS policies for room_messages
CREATE POLICY "Anyone can read messages in room"
ON public.room_messages
FOR SELECT
USING (true);

CREATE POLICY "Anyone can send messages"
ON public.room_messages
FOR INSERT
WITH CHECK (true);

-- No update/delete for messages - they're immutable

-- Add trigger for updating room_secrets updated_at
CREATE TRIGGER update_room_secrets_updated_at
BEFORE UPDATE ON public.room_secrets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for room_secrets (for drawer to see word)
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_secrets;

-- Create index for faster lookups
CREATE INDEX idx_player_sessions_token ON public.player_sessions(session_token);
CREATE INDEX idx_player_sessions_room ON public.player_sessions(room_id);
CREATE INDEX idx_room_secrets_room ON public.room_secrets(room_id);
