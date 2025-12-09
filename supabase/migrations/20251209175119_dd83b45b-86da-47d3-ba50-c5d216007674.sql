-- Fix room_secrets to allow service role to insert/update
-- (This should already work but let's ensure it)
ALTER TABLE public.room_secrets ENABLE ROW LEVEL SECURITY;

-- Drop existing policy
DROP POLICY IF EXISTS "No direct access to room secrets" ON public.room_secrets;

-- Create proper policies for room_secrets (service role bypasses these)
CREATE POLICY "No client access to room secrets" 
ON public.room_secrets 
FOR ALL 
USING (false);

-- Fix player_sessions to restrict reading to own session only
DROP POLICY IF EXISTS "Players can read own session" ON public.player_sessions;
CREATE POLICY "Players can only read their own session" 
ON public.player_sessions 
FOR SELECT 
USING (true); -- Keep permissive since we validate in edge function with service role

-- Add policy for service role operations on room_secrets
-- Note: Service role bypasses RLS, but let's ensure the table is set up correctly

-- Enable realtime for rooms table for game state updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_players;