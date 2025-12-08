-- Enable realtime for room_messages table for instant chat updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_messages;