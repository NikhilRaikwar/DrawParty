import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    console.log(`[Signaling] Action: ${action}`, params);

    switch (action) {
      case 'create-room': {
        const { hostId, hostName, hostAvatar, settings } = params;
        
        // Generate unique room code
        const code = generateRoomCode();
        
        // Create room
        const { data: room, error: roomError } = await supabase
          .from('rooms')
          .insert({
            code,
            host_id: hostId,
            settings,
            game_state: {
              phase: 'lobby',
              currentRound: 0,
              totalRounds: settings.totalRounds,
              currentDrawerId: null,
              currentWord: null,
              wordHint: '',
              timeRemaining: settings.drawTime,
              drawTime: settings.drawTime,
              correctGuessers: []
            }
          })
          .select()
          .single();

        if (roomError) {
          console.error('[Signaling] Room creation error:', roomError);
          throw roomError;
        }

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

        // Add system message
        await supabase.from('room_messages').insert({
          room_id: room.id,
          player_id: 'system',
          player_name: 'System',
          content: `${hostName} created the room`,
          is_system_message: true
        });

        console.log('[Signaling] Room created:', code);
        return new Response(JSON.stringify({ success: true, roomCode: code, roomId: room.id }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'join-room': {
        const { code, playerId, playerName, playerAvatar } = params;
        
        // Find room
        const { data: room, error: roomError } = await supabase
          .from('rooms')
          .select('*')
          .eq('code', code.toUpperCase())
          .maybeSingle();

        if (roomError || !room) {
          console.error('[Signaling] Room not found:', code);
          return new Response(JSON.stringify({ success: false, error: 'Room not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Check if player already exists
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
        } else {
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

          // Add system message
          await supabase.from('room_messages').insert({
            room_id: room.id,
            player_id: 'system',
            player_name: 'System',
            content: `${playerName} joined the game!`,
            is_system_message: true
          });
        }

        console.log('[Signaling] Player joined:', playerName, 'to room:', code);
        return new Response(JSON.stringify({ success: true, roomId: room.id }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'leave-room': {
        const { roomId, playerId, playerName } = params;
        
        // Remove player
        await supabase
          .from('room_players')
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
          // Delete empty room
          await supabase.from('rooms').delete().eq('id', roomId);
          console.log('[Signaling] Room deleted (empty)');
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'update-game-state': {
        const { roomId, gameState } = params;
        
        const { error } = await supabase
          .from('rooms')
          .update({ game_state: gameState })
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
        const { roomId, playerId, isReady } = params;
        
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
        const { roomId, playerId, isMuted } = params;
        
        await supabase
          .from('room_players')
          .update({ is_muted: isMuted })
          .eq('room_id', roomId)
          .eq('player_id', playerId);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'send-message': {
        const { roomId, playerId, playerName, content, isCorrectGuess } = params;
        
        await supabase.from('room_messages').insert({
          room_id: roomId,
          player_id: playerId,
          player_name: playerName,
          content,
          is_correct_guess: isCorrectGuess || false
        });

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'update-score': {
        const { roomId, playerId, score } = params;
        
        await supabase
          .from('room_players')
          .update({ score })
          .eq('room_id', roomId)
          .eq('player_id', playerId);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'add-bot': {
        const { roomId, botId, botName, botAvatar } = params;
        
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
