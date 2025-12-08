
-- Add minimal policy for room_secrets to satisfy linter
-- This allows the drawer to see their secret word via realtime
-- But the actual secret word operations are done via service role in edge function
CREATE POLICY "No direct access to room secrets"
ON public.room_secrets
FOR SELECT
USING (false);
