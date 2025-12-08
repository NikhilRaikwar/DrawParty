import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation schemas
const playerNameSchema = z.string().min(1).max(20).regex(/^[a-zA-Z0-9 _-]+$/);
const roomCodeSchema = z.string().length(6).regex(/^[A-Z0-9]+$/);
const messageSchema = z.string().min(1).max(500);
const avatarSchema = z.string().min(1).max(10);
const sessionTokenSchema = z.string().min(10).max(100);
const settingsSchema = z.object({
  maxPlayers: z.number().int().min(2).max(16),
  drawTime: z.number().int().min(30).max(180),
  totalRounds: z.number().int().min(1).max(10),
  isPublic: z.boolean(),
  hintLevel: z.number().int().min(0).max(5),
  gameMode: z.enum(['normal', 'hidden', 'combination']),
  language: z.enum(['english', 'spanish', 'french', 'german']),
  wordCount: z.number().int().min(2).max(5),
  showHints: z.boolean()
}).partial();

// Generate secure session token
function generateSessionToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// Validate session token
// deno-lint-ignore no-explicit-any
async function validateSession(
  supabase: any,
  roomId: string,
  playerId: string,
  sessionToken: string
): Promise<boolean> {
  const { data: session } = await supabase
    .from('player_sessions')
    .select('*')
    .eq('room_id', roomId)
    .eq('player_id', playerId)
    .eq('session_token', sessionToken)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();
  
  return !!session;
}

// Check if player is the host
// deno-lint-ignore no-explicit-any
async function isPlayerHost(
  supabase: any,
  roomId: string,
  playerId: string
): Promise<boolean> {
  const { data: room } = await supabase
    .from('rooms')
    .select('host_id')
    .eq('id', roomId)
    .single();
  
  return room?.host_id === playerId;
}

// Check if player is the current drawer
// deno-lint-ignore no-explicit-any
async function isPlayerDrawer(
  supabase: any,
  roomId: string,
  playerId: string
): Promise<boolean> {
  const { data: room } = await supabase
    .from('rooms')
    .select('game_state')
    .eq('id', roomId)
    .single();
  
  const gameState = room?.game_state as { currentDrawerId: string } | null;
  return gameState?.currentDrawerId === playerId;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action, ...params } = await req.json();
    console.log(`[Signaling] Action: ${action}`);

    switch (action) {
      case 'create-room': {
        // Validate input
        const hostName = playerNameSchema.parse(params.hostName);
        const hostAvatar = avatarSchema.parse(params.hostAvatar);
        const hostId = params.hostId as string;
        const settings = settingsSchema.parse(params.settings || {});
        
        // Generate unique room code
        const code = generateRoomCode();
        
        // Generate session token for host
        const sessionToken = generateSessionToken();
        
        // Create room
        const { data: room, error: roomError } = await supabase
          .from('rooms')
          .insert({
            code,
            host_id: hostId,
            settings: {
              maxPlayers: 8,
              drawTime: 80,
              totalRounds: 3,
              isPublic: true,
              hintLevel: 2,
              gameMode: 'normal',
              language: 'english',
              wordCount: 3,
              showHints: true,
              ...settings
            },
            game_state: {
              phase: 'lobby',
              currentRound: 0,
              totalRounds: settings.totalRounds || 3,
              currentDrawerId: null,
              currentWord: null,
              wordHint: '',
              timeRemaining: settings.drawTime || 80,
              drawTime: settings.drawTime || 80,
              correctGuessers: [],
              revealedForPlayers: []
            }
          })
          .select()
          .single();

        if (roomError) {
          console.error('[Signaling] Room creation error:', roomError);
          throw roomError;
        }

        // Create room secrets (for storing current word securely)
        await supabase
          .from('room_secrets')
          .insert({
            room_id: room.id,
            current_word: null,
            word_options: []
          });

        // Add host as player
        const { error: playerError } = await supabase
          .from('room_players')
          .insert({
            room_id: room.id,
            player_id: hostId,
            player_name: hostName,
            avatar: hostAvatar,
            is_host: true,
            is_ready: true
          });

        if (playerError) {
          console.error('[Signaling] Player creation error:', playerError);
          throw playerError;
        }

        // Create session for host
        await supabase
          .from('player_sessions')
          .insert({
            room_id: room.id,
            player_id: hostId,
            session_token: sessionToken
          });

        // Add system message
        await supabase.from('room_messages').insert({
          room_id: room.id,
          player_id: 'system',
          player_name: 'System',
          content: `${hostName} created the room`,
          is_system_message: true
        });

        console.log('[Signaling] Room created:', code);
        return new Response(JSON.stringify({ 
          success: true, 
          roomCode: code, 
          roomId: room.id,
          sessionToken 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'join-room': {
        // Validate input
        const code = roomCodeSchema.parse(params.code.toUpperCase());
        const playerName = playerNameSchema.parse(params.playerName);
        const playerAvatar = avatarSchema.parse(params.playerAvatar);
        const playerId = params.playerId as string;
        
        // Find room
        const { data: room, error: roomError } = await supabase
          .from('rooms')
          .select('*')
          .eq('code', code)
          .maybeSingle();

        if (roomError || !room) {
          console.error('[Signaling] Room not found:', code);
          return new Response(JSON.stringify({ success: false, error: 'Room not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Check if game already started
        const gameState = room.game_state as { phase: string };
        if (gameState.phase !== 'lobby') {
          return new Response(JSON.stringify({ success: false, error: 'Game already in progress' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Generate session token
        const sessionToken = generateSessionToken();

        // Check if player with same name already exists (prevent duplicate joins)
        const { data: existingPlayerByName } = await supabase
          .from('room_players')
          .select('*')
          .eq('room_id', room.id)
          .eq('player_name', playerName)
          .maybeSingle();

        if (existingPlayerByName) {
          // Reconnect existing player with same name
          await supabase
            .from('room_players')
            .update({ 
              is_connected: true,
              player_id: playerId
            })
            .eq('id', existingPlayerByName.id);
          
          // Update session
          await supabase
            .from('player_sessions')
            .upsert({
              room_id: room.id,
              player_id: playerId,
              session_token: sessionToken
            });
          
          console.log('[Signaling] Player reconnected:', playerName);
          return new Response(JSON.stringify({ 
            success: true, 
            roomId: room.id, 
            reconnected: true,
            sessionToken 
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Check if player_id already exists
        const { data: existingPlayer } = await supabase
          .from('room_players')
          .select('*')
          .eq('room_id', room.id)
          .eq('player_id', playerId)
          .maybeSingle();

        if (existingPlayer) {
          // Reconnect existing player
          await supabase
            .from('room_players')
            .update({ is_connected: true })
            .eq('id', existingPlayer.id);
          
          // Update session
          await supabase
            .from('player_sessions')
            .upsert({
              room_id: room.id,
              player_id: playerId,
              session_token: sessionToken
            });
            
          return new Response(JSON.stringify({ 
            success: true, 
            roomId: room.id, 
            reconnected: true,
            sessionToken 
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Check max players
        const { data: playerCount } = await supabase
          .from('room_players')
          .select('id', { count: 'exact' })
          .eq('room_id', room.id);
        
        const roomSettings = room.settings as { maxPlayers: number };
        if (playerCount && playerCount.length >= roomSettings.maxPlayers) {
          return new Response(JSON.stringify({ success: false, error: 'Room is full' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Add new player
        const { error: playerError } = await supabase
          .from('room_players')
          .insert({
            room_id: room.id,
            player_id: playerId,
            player_name: playerName,
            avatar: playerAvatar,
            is_host: false,
            is_ready: false
          });

        if (playerError) {
          console.error('[Signaling] Player join error:', playerError);
          throw playerError;
        }

        // Create session
        await supabase
          .from('player_sessions')
          .insert({
            room_id: room.id,
            player_id: playerId,
            session_token: sessionToken
          });

        // Add system message
        await supabase.from('room_messages').insert({
          room_id: room.id,
          player_id: 'system',
          player_name: 'System',
          content: `${playerName} joined the game!`,
          is_system_message: true
        });

        console.log('[Signaling] Player joined:', playerName, 'to room:', code);
        return new Response(JSON.stringify({ 
          success: true, 
          roomId: room.id,
          sessionToken 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'leave-room': {
        const { roomId, playerId, playerName, sessionToken } = params;
        
        // Validate session (optional for leave - allow if session expired)
        if (sessionToken) {
          await validateSession(supabase, roomId, playerId, sessionToken);
        }
        
        // Remove player
        await supabase
          .from('room_players')
          .delete()
          .eq('room_id', roomId)
          .eq('player_id', playerId);

        // Remove session
        await supabase
          .from('player_sessions')
          .delete()
          .eq('room_id', roomId)
          .eq('player_id', playerId);

        // Add system message
        await supabase.from('room_messages').insert({
          room_id: roomId,
          player_id: 'system',
          player_name: 'System',
          content: `${playerName} left the game`,
          is_system_message: true
        });

        // Check if room is empty
        const { data: remainingPlayers } = await supabase
          .from('room_players')
          .select('*')
          .eq('room_id', roomId);

        if (!remainingPlayers || remainingPlayers.length === 0) {
          // Delete empty room and its secrets
          await supabase.from('room_secrets').delete().eq('room_id', roomId);
          await supabase.from('rooms').delete().eq('id', roomId);
          console.log('[Signaling] Room deleted (empty)');
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'update-game-state': {
        const { roomId, playerId, sessionToken, gameState } = params;
        
        // Validate session
        if (!await validateSession(supabase, roomId, playerId, sessionToken)) {
          return new Response(JSON.stringify({ success: false, error: 'Invalid session' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // Only host can update game state
        if (!await isPlayerHost(supabase, roomId, playerId)) {
          return new Response(JSON.stringify({ success: false, error: 'Not authorized' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // Never expose currentWord in game state - it's stored in room_secrets
        const sanitizedState = { ...gameState };
        delete sanitizedState.currentWord;
        
        const { error } = await supabase
          .from('rooms')
          .update({ game_state: sanitizedState })
          .eq('id', roomId);

        if (error) {
          console.error('[Signaling] Update game state error:', error);
          throw error;
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'toggle-ready': {
        const { roomId, playerId, sessionToken, isReady } = params;
        
        // Validate session
        if (!await validateSession(supabase, roomId, playerId, sessionToken)) {
          return new Response(JSON.stringify({ success: false, error: 'Invalid session' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        await supabase
          .from('room_players')
          .update({ is_ready: isReady })
          .eq('room_id', roomId)
          .eq('player_id', playerId);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'toggle-mute': {
        const { roomId, playerId, sessionToken, isMuted } = params;
        
        // Validate session
        if (!await validateSession(supabase, roomId, playerId, sessionToken)) {
          return new Response(JSON.stringify({ success: false, error: 'Invalid session' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        await supabase
          .from('room_players')
          .update({ is_muted: isMuted })
          .eq('room_id', roomId)
          .eq('player_id', playerId);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'update-settings': {
        const { roomId, playerId, sessionToken, settings } = params;
        
        // Validate session
        if (!await validateSession(supabase, roomId, playerId, sessionToken)) {
          return new Response(JSON.stringify({ success: false, error: 'Invalid session' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // Only host can update settings
        if (!await isPlayerHost(supabase, roomId, playerId)) {
          return new Response(JSON.stringify({ success: false, error: 'Only host can update settings' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // Validate settings
        const validatedSettings = settingsSchema.parse(settings);
        
        await supabase
          .from('rooms')
          .update({ settings: validatedSettings })
          .eq('id', roomId);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'start-game': {
        const { roomId, playerId, sessionToken, drawingOrder, wordOptions } = params;
        
        // Validate session
        if (!await validateSession(supabase, roomId, playerId, sessionToken)) {
          return new Response(JSON.stringify({ success: false, error: 'Invalid session' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // Only host can start game
        if (!await isPlayerHost(supabase, roomId, playerId)) {
          return new Response(JSON.stringify({ success: false, error: 'Only host can start game' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // Get room settings
        const { data: room } = await supabase
          .from('rooms')
          .select('settings')
          .eq('id', roomId)
          .single();
        
        const settings = room?.settings as { drawTime: number; totalRounds: number };
        const firstDrawerId = drawingOrder[0];
        
        // Store word options in room_secrets (only drawer will get these)
        await supabase
          .from('room_secrets')
          .update({ 
            word_options: wordOptions,
            current_word: null 
          })
          .eq('room_id', roomId);
        
        // Update game state
        const newState = {
          phase: 'wordSelection',
          currentRound: 1,
          currentDrawerId: firstDrawerId,
          currentWord: null,
          wordHint: '',
          timeRemaining: settings.drawTime,
          drawTime: settings.drawTime,
          totalRounds: settings.totalRounds,
          correctGuessers: [],
          revealedForPlayers: []
        };
        
        await supabase
          .from('rooms')
          .update({ game_state: newState })
          .eq('id', roomId);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'get-word-options': {
        const { roomId, playerId, sessionToken } = params;
        
        // Validate session
        if (!await validateSession(supabase, roomId, playerId, sessionToken)) {
          return new Response(JSON.stringify({ success: false, error: 'Invalid session' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // Only current drawer can get word options
        if (!await isPlayerDrawer(supabase, roomId, playerId)) {
          return new Response(JSON.stringify({ success: false, error: 'Only drawer can get word options' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // Get word options from secrets
        const { data: secrets } = await supabase
          .from('room_secrets')
          .select('word_options')
          .eq('room_id', roomId)
          .single();

        return new Response(JSON.stringify({ 
          success: true, 
          wordOptions: secrets?.word_options || [] 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'select-word': {
        const { roomId, playerId, sessionToken, word } = params;
        
        // Validate session
        if (!await validateSession(supabase, roomId, playerId, sessionToken)) {
          return new Response(JSON.stringify({ success: false, error: 'Invalid session' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // Only current drawer can select word
        if (!await isPlayerDrawer(supabase, roomId, playerId)) {
          return new Response(JSON.stringify({ success: false, error: 'Only drawer can select word' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // Get room and secrets to validate word
        const { data: secrets } = await supabase
          .from('room_secrets')
          .select('word_options')
          .eq('room_id', roomId)
          .single();
        
        const wordOptions = secrets?.word_options || [];
        if (!wordOptions.includes(word)) {
          return new Response(JSON.stringify({ success: false, error: 'Invalid word selection' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // Store selected word in secrets
        await supabase
          .from('room_secrets')
          .update({ 
            current_word: word,
            word_options: []
          })
          .eq('room_id', roomId);
        
        // Generate word hint (blanks)
        const wordHint = word.split('').map((c: string) => c === ' ' ? ' ' : '_').join(' ');
        
        // Get room settings for draw time
        const { data: room } = await supabase
          .from('rooms')
          .select('settings, game_state')
          .eq('id', roomId)
          .single();
        
        const settings = room?.settings as { drawTime: number };
        const currentState = room?.game_state as Record<string, unknown>;
        
        // Update game state to drawing phase
        const newState = {
          ...currentState,
          phase: 'drawing',
          wordHint,
          timeRemaining: settings.drawTime,
          correctGuessers: [],
          revealedForPlayers: []
        };
        
        await supabase
          .from('rooms')
          .update({ game_state: newState })
          .eq('id', roomId);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'check-guess': {
        const { roomId, playerId, sessionToken, guess } = params;
        
        // Validate session
        if (!await validateSession(supabase, roomId, playerId, sessionToken)) {
          return new Response(JSON.stringify({ success: false, error: 'Invalid session' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // Get current word from secrets
        const { data: secrets } = await supabase
          .from('room_secrets')
          .select('current_word')
          .eq('room_id', roomId)
          .single();
        
        const currentWord = secrets?.current_word;
        if (!currentWord) {
          return new Response(JSON.stringify({ success: false, isCorrect: false }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // Check if guess is correct (case-insensitive)
        const isCorrect = guess.toLowerCase().trim() === currentWord.toLowerCase();
        
        return new Response(JSON.stringify({ 
          success: true, 
          isCorrect,
          word: isCorrect ? currentWord : null
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'send-message': {
        const { roomId, playerId, playerName, content, isCorrectGuess, isSystemMessage, sessionToken } = params;
        
        // System messages don't need session validation
        if (!isSystemMessage) {
          if (!await validateSession(supabase, roomId, playerId, sessionToken)) {
            return new Response(JSON.stringify({ success: false, error: 'Invalid session' }), {
              status: 401,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          
          // Validate message content
          messageSchema.parse(content);
        }
        
        await supabase.from('room_messages').insert({
          room_id: roomId,
          player_id: playerId,
          player_name: playerName,
          content,
          is_correct_guess: isCorrectGuess || false,
          is_system_message: isSystemMessage || false
        });

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'update-score': {
        const { roomId, playerId, sessionToken, targetPlayerId, score } = params;
        
        // Validate session
        if (!await validateSession(supabase, roomId, playerId, sessionToken)) {
          return new Response(JSON.stringify({ success: false, error: 'Invalid session' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // Only host can update scores
        if (!await isPlayerHost(supabase, roomId, playerId)) {
          return new Response(JSON.stringify({ success: false, error: 'Only host can update scores' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // Validate score is a reasonable number
        if (typeof score !== 'number' || score < 0 || score > 10000) {
          return new Response(JSON.stringify({ success: false, error: 'Invalid score' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        await supabase
          .from('room_players')
          .update({ score })
          .eq('room_id', roomId)
          .eq('player_id', targetPlayerId);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'add-bot': {
        const { roomId, playerId, sessionToken, botId, botName, botAvatar } = params;
        
        // Validate session
        if (!await validateSession(supabase, roomId, playerId, sessionToken)) {
          return new Response(JSON.stringify({ success: false, error: 'Invalid session' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // Only host can add bots
        if (!await isPlayerHost(supabase, roomId, playerId)) {
          return new Response(JSON.stringify({ success: false, error: 'Only host can add bots' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        await supabase.from('room_players').insert({
          room_id: roomId,
          player_id: botId,
          player_name: botName,
          avatar: botAvatar,
          is_host: false,
          is_ready: true
        });

        await supabase.from('room_messages').insert({
          room_id: roomId,
          player_id: 'system',
          player_name: 'System',
          content: `${botName} joined the game!`,
          is_system_message: true
        });

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'get-public-rooms': {
        // Get all public rooms in lobby phase
        const { data: rooms } = await supabase
          .from('rooms')
          .select('id, code, settings, game_state');
        
        const publicRooms = [];
        for (const room of rooms || []) {
          const settings = room.settings as { isPublic: boolean; maxPlayers: number; language: string };
          const gameState = room.game_state as { phase: string };
          
          if (settings.isPublic && gameState.phase === 'lobby') {
            const { data: players } = await supabase
              .from('room_players')
              .select('id')
              .eq('room_id', room.id);
            
            publicRooms.push({
              id: room.id,
              code: room.code,
              playerCount: players?.length || 0,
              maxPlayers: settings.maxPlayers,
              language: settings.language
            });
          }
        }

        return new Response(JSON.stringify({ success: true, rooms: publicRooms }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'get-ice-servers': {
        // Return free public STUN servers
        const iceServers = [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun3.l.google.com:19302' },
          { urls: 'stun:stun4.l.google.com:19302' }
        ];

        return new Response(JSON.stringify({ success: true, iceServers }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'next-turn': {
        const { roomId, playerId, sessionToken, nextDrawerId, wordOptions, isNewRound, newRound } = params;
        
        // Validate session
        if (!await validateSession(supabase, roomId, playerId, sessionToken)) {
          return new Response(JSON.stringify({ success: false, error: 'Invalid session' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // Only host can advance turns
        if (!await isPlayerHost(supabase, roomId, playerId)) {
          return new Response(JSON.stringify({ success: false, error: 'Only host can advance turns' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // Store new word options
        await supabase
          .from('room_secrets')
          .update({ 
            word_options: wordOptions,
            current_word: null 
          })
          .eq('room_id', roomId);
        
        // Get current room state
        const { data: room } = await supabase
          .from('rooms')
          .select('game_state, settings')
          .eq('id', roomId)
          .single();
        
        const settings = room?.settings as { drawTime: number };
        const currentState = room?.game_state as Record<string, unknown>;
        
        const newState = {
          ...currentState,
          phase: 'wordSelection',
          currentRound: isNewRound ? newRound : currentState.currentRound,
          currentDrawerId: nextDrawerId,
          currentWord: null,
          wordHint: '',
          timeRemaining: settings.drawTime,
          correctGuessers: [],
          revealedForPlayers: []
        };
        
        await supabase
          .from('rooms')
          .update({ game_state: newState })
          .eq('id', roomId);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'end-game': {
        const { roomId, playerId, sessionToken } = params;
        
        // Validate session
        if (!await validateSession(supabase, roomId, playerId, sessionToken)) {
          return new Response(JSON.stringify({ success: false, error: 'Invalid session' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // Only host can end game
        if (!await isPlayerHost(supabase, roomId, playerId)) {
          return new Response(JSON.stringify({ success: false, error: 'Only host can end game' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // Get current room state
        const { data: room } = await supabase
          .from('rooms')
          .select('game_state')
          .eq('id', roomId)
          .single();
        
        const currentState = room?.game_state as Record<string, unknown>;
        
        const newState = {
          ...currentState,
          phase: 'gameEnd',
          currentWord: null,
          wordHint: '',
          revealedForPlayers: []
        };
        
        // Clear secrets
        await supabase
          .from('room_secrets')
          .update({ 
            word_options: [],
            current_word: null 
          })
          .eq('room_id', roomId);
        
        await supabase
          .from('rooms')
          .update({ game_state: newState })
          .eq('id', roomId);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'reveal-word': {
        const { roomId, playerId, sessionToken } = params;
        
        // Validate session
        if (!await validateSession(supabase, roomId, playerId, sessionToken)) {
          return new Response(JSON.stringify({ success: false, error: 'Invalid session' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // Only host can reveal word
        if (!await isPlayerHost(supabase, roomId, playerId)) {
          return new Response(JSON.stringify({ success: false, error: 'Only host can reveal word' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // Get current word from secrets
        const { data: secrets } = await supabase
          .from('room_secrets')
          .select('current_word')
          .eq('room_id', roomId)
          .single();

        return new Response(JSON.stringify({ 
          success: true, 
          word: secrets?.current_word 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      default:
        return new Response(JSON.stringify({ success: false, error: 'Unknown action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
  } catch (error) {
    console.error('[Signaling] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

function generateRoomCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}