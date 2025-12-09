-- Remove overly permissive RLS policies and tighten security
-- Keep SELECT policies for real-time subscriptions, remove direct write access

-- 1. player_sessions: Remove SELECT policy (validation happens server-side only)
DROP POLICY IF EXISTS "Players can only read their own session" ON player_sessions;

-- 2. room_players: Remove UPDATE and DELETE policies (must go through edge function)
DROP POLICY IF EXISTS "Players can update (validated by edge function)" ON room_players;
DROP POLICY IF EXISTS "Players can leave room" ON room_players;

-- 3. room_messages: Remove INSERT policy (messages must go through edge function)
DROP POLICY IF EXISTS "Anyone can send messages" ON room_messages;

-- 4. rooms: Remove UPDATE and DELETE policies (must go through edge function)
DROP POLICY IF EXISTS "Only host can update room" ON rooms;
DROP POLICY IF EXISTS "Only host can delete room" ON rooms;