import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  GameState, 
  Player, 
  ChatMessage, 
  RoomSettings, 
  AVATARS,
  getRandomWords,
  generateWordHint
} from '@/types/game';
import { toast } from 'sonner';

const generateId = () => Math.random().toString(36).substr(2, 9);

const initialGameState: GameState = {
  phase: 'lobby',
  currentRound: 0,
  totalRounds: 3,
  currentDrawerId: null,
  currentWord: null,
  wordHint: '',
  timeRemaining: 80,
  drawTime: 80,
  correctGuessers: []
};

export const useMultiplayerGame = () => {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [gameState, setGameState] = useState<GameState>(initialGameState);
  const [settings, setSettings] = useState<RoomSettings>({
    maxPlayers: 8,
    drawTime: 80,
    totalRounds: 3,
    isPublic: true,
    hintLevel: 2,
    gameMode: 'normal'
  });
  const [wordOptions, setWordOptions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Call signaling server
  const callSignaling = async (action: string, params: Record<string, unknown>) => {
    try {
      const { data, error } = await supabase.functions.invoke('signaling', {
        body: { action, ...params }
      });
      
      if (error) throw error;
      return data;
    } catch (err) {
      console.error(`[Signaling] ${action} error:`, err);
      throw err;
    }
  };

  // Subscribe to realtime updates
  useEffect(() => {
    if (!roomId) return;

    console.log('[Multiplayer] Setting up realtime subscriptions for room:', roomId);

    // Subscribe to players changes
    const playersChannel = supabase
      .channel(`room-players-${roomId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'room_players',
          filter: `room_id=eq.${roomId}`
        },
        (payload) => {
          console.log('[Multiplayer] Players change:', payload);
          fetchPlayers();
        }
      )
      .subscribe();

    // Subscribe to messages changes
    const messagesChannel = supabase
      .channel(`room-messages-${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'room_messages',
          filter: `room_id=eq.${roomId}`
        },
        (payload) => {
          console.log('[Multiplayer] New message:', payload);
          const newMsg = payload.new as {
            id: string;
            player_id: string;
            player_name: string;
            content: string;
            is_correct_guess: boolean;
            is_system_message: boolean;
            created_at: string;
          };
          const message: ChatMessage = {
            id: newMsg.id,
            playerId: newMsg.player_id,
            playerName: newMsg.player_name,
            content: newMsg.content,
            timestamp: new Date(newMsg.created_at).getTime(),
            isCorrectGuess: newMsg.is_correct_guess,
            isSystemMessage: newMsg.is_system_message
          };
          setMessages(prev => [...prev, message]);
        }
      )
      .subscribe();

    // Subscribe to room/game state changes
    const roomChannel = supabase
      .channel(`room-state-${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rooms',
          filter: `id=eq.${roomId}`
        },
        (payload) => {
          console.log('[Multiplayer] Room state change:', payload);
          const newRoom = payload.new as { game_state: GameState; settings: RoomSettings };
          if (newRoom.game_state) {
            setGameState(newRoom.game_state);
          }
          if (newRoom.settings) {
            setSettings(newRoom.settings);
          }
        }
      )
      .subscribe();

    // Initial fetch
    fetchPlayers();
    fetchMessages();

    return () => {
      console.log('[Multiplayer] Cleaning up subscriptions');
      supabase.removeChannel(playersChannel);
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(roomChannel);
    };
  }, [roomId]);

  // Fetch players
  const fetchPlayers = async () => {
    if (!roomId) return;
    
    const { data, error } = await supabase
      .from('room_players')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at');

    if (error) {
      console.error('[Multiplayer] Fetch players error:', error);
      return;
    }

    const fetchedPlayers: Player[] = data.map(p => ({
      id: p.player_id,
      name: p.player_name,
      avatar: p.avatar,
      score: p.score,
      isHost: p.is_host,
      isReady: p.is_ready,
      isMuted: p.is_muted,
      isSpeaking: false,
      isConnected: p.is_connected
    }));

    setPlayers(fetchedPlayers);
  };

  // Fetch messages
  const fetchMessages = async () => {
    if (!roomId) return;
    
    const { data, error } = await supabase
      .from('room_messages')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at');

    if (error) {
      console.error('[Multiplayer] Fetch messages error:', error);
      return;
    }

    const fetchedMessages: ChatMessage[] = data.map(m => ({
      id: m.id,
      playerId: m.player_id,
      playerName: m.player_name,
      content: m.content,
      timestamp: new Date(m.created_at).getTime(),
      isCorrectGuess: m.is_correct_guess,
      isSystemMessage: m.is_system_message
    }));

    setMessages(fetchedMessages);
  };

  // Create room
  const createRoom = useCallback(async (playerName: string, avatar: string) => {
    setIsLoading(true);
    try {
      const newPlayerId = generateId();
      
      const result = await callSignaling('create-room', {
        hostId: newPlayerId,
        hostName: playerName,
        hostAvatar: avatar,
        settings
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to create room');
      }

      setRoomId(result.roomId);
      setRoomCode(result.roomCode);
      setPlayerId(newPlayerId);
      setGameState(prev => ({
        ...prev,
        drawTime: settings.drawTime,
        totalRounds: settings.totalRounds
      }));

      toast.success('Room created!', { description: `Code: ${result.roomCode}` });
      return result.roomCode;
    } catch (err) {
      console.error('[Multiplayer] Create room error:', err);
      toast.error('Failed to create room');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [settings]);

  // Join room
  const joinRoom = useCallback(async (code: string, playerName: string, avatar: string) => {
    setIsLoading(true);
    try {
      const newPlayerId = generateId();
      
      const result = await callSignaling('join-room', {
        code: code.toUpperCase(),
        playerId: newPlayerId,
        playerName,
        playerAvatar: avatar
      });

      if (!result.success) {
        toast.error(result.error || 'Failed to join room');
        return false;
      }

      setRoomId(result.roomId);
      setRoomCode(code.toUpperCase());
      setPlayerId(newPlayerId);

      // Fetch room data
      const { data: room } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', result.roomId)
        .single();

      if (room) {
        setGameState(room.game_state as unknown as GameState);
        setSettings(room.settings as unknown as RoomSettings);
      }

      toast.success('Joined room!');
      return true;
    } catch (err) {
      console.error('[Multiplayer] Join room error:', err);
      toast.error('Failed to join room');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Add bot player
  const addBotPlayer = useCallback(async () => {
    if (!roomId) return;

    const botNames = ['Bot Alex', 'Bot Sam', 'Bot Jordan', 'Bot Taylor', 'Bot Riley'];
    const availableNames = botNames.filter(name => 
      !players.some(p => p.name === name)
    );
    
    if (availableNames.length === 0) return;

    const botId = `bot_${generateId()}`;
    const botName = availableNames[0];
    const botAvatar = AVATARS[Math.floor(Math.random() * AVATARS.length)];

    await callSignaling('add-bot', {
      roomId,
      botId,
      botName,
      botAvatar
    });
  }, [roomId, players]);

  // Toggle ready
  const toggleReady = useCallback(async () => {
    if (!roomId || !playerId) return;

    const currentPlayer = players.find(p => p.id === playerId);
    if (!currentPlayer) return;

    await callSignaling('toggle-ready', {
      roomId,
      playerId,
      isReady: !currentPlayer.isReady
    });
  }, [roomId, playerId, players]);

  // Toggle mute
  const toggleMute = useCallback(async () => {
    if (!roomId || !playerId) return;

    const currentPlayer = players.find(p => p.id === playerId);
    if (!currentPlayer) return;

    await callSignaling('toggle-mute', {
      roomId,
      playerId,
      isMuted: !currentPlayer.isMuted
    });
  }, [roomId, playerId, players]);

  // Update game state on server
  const updateGameState = useCallback(async (newState: GameState) => {
    if (!roomId) return;

    await callSignaling('update-game-state', {
      roomId,
      gameState: newState
    });
  }, [roomId]);

  // Start game
  const startGame = useCallback(async () => {
    if (players.length < 2 || !roomId) return;
    
    const words = getRandomWords(3);
    setWordOptions(words);
    
    const newState: GameState = {
      ...gameState,
      phase: 'wordSelection',
      currentRound: 1,
      currentDrawerId: players[0].id,
      timeRemaining: gameState.drawTime,
      correctGuessers: []
    };

    setGameState(newState);
    await updateGameState(newState);
  }, [players, roomId, gameState, updateGameState]);

  // Select word
  const selectWord = useCallback(async (word: string) => {
    const newState: GameState = {
      ...gameState,
      phase: 'drawing',
      currentWord: word,
      wordHint: generateWordHint(word, 0)
    };
    
    setGameState(newState);
    setWordOptions([]);
    await updateGameState(newState);
  }, [gameState, updateGameState]);

  // Send message
  const sendMessage = useCallback(async (content: string) => {
    if (!roomId || !playerId) return;
    
    const player = players.find(p => p.id === playerId);
    if (!player) return;

    const isCorrectGuess = gameState.phase === 'drawing' && 
      gameState.currentDrawerId !== playerId &&
      !gameState.correctGuessers.includes(playerId) &&
      content.toLowerCase().trim() === gameState.currentWord?.toLowerCase();

    if (isCorrectGuess) {
      const timeBonus = Math.floor(gameState.timeRemaining / 10);
      const basePoints = 100;
      const points = basePoints + timeBonus * 10;

      // Update player score
      await callSignaling('update-score', {
        roomId,
        playerId,
        score: player.score + points
      });

      // Update drawer score
      const drawer = players.find(p => p.id === gameState.currentDrawerId);
      if (drawer) {
        await callSignaling('update-score', {
          roomId,
          playerId: drawer.id,
          score: drawer.score + 25
        });
      }

      // Update game state
      const newState: GameState = {
        ...gameState,
        correctGuessers: [...gameState.correctGuessers, playerId]
      };
      setGameState(newState);
      await updateGameState(newState);

      // Send correct guess message
      await callSignaling('send-message', {
        roomId,
        playerId,
        playerName: player.name,
        content: '🎉 Guessed correctly!',
        isCorrectGuess: true
      });

      // System message
      await callSignaling('send-message', {
        roomId,
        playerId: 'system',
        playerName: 'System',
        content: `${player.name} guessed the word! (+${points} points)`,
        isSystemMessage: true
      });
    } else {
      await callSignaling('send-message', {
        roomId,
        playerId,
        playerName: player.name,
        content
      });
    }
  }, [roomId, playerId, players, gameState, updateGameState]);

  // Next turn
  const nextTurn = useCallback(async () => {
    const currentIndex = players.findIndex(p => p.id === gameState.currentDrawerId);
    const nextIndex = (currentIndex + 1) % players.length;
    const isNewRound = nextIndex === 0;
    const newRound = isNewRound ? gameState.currentRound + 1 : gameState.currentRound;

    if (newRound > gameState.totalRounds) {
      const newState: GameState = {
        ...gameState,
        phase: 'gameEnd',
        currentWord: null,
        wordHint: ''
      };
      setGameState(newState);
      await updateGameState(newState);
      return;
    }

    const words = getRandomWords(3);
    setWordOptions(words);

    const newState: GameState = {
      ...gameState,
      phase: 'wordSelection',
      currentRound: newRound,
      currentDrawerId: players[nextIndex].id,
      currentWord: null,
      wordHint: '',
      timeRemaining: gameState.drawTime,
      correctGuessers: []
    };

    setGameState(newState);
    await updateGameState(newState);
  }, [players, gameState, updateGameState]);

  // End round
  const endRound = useCallback(async () => {
    const newState: GameState = {
      ...gameState,
      phase: 'revealing'
    };
    setGameState(newState);
    await updateGameState(newState);

    if (gameState.currentWord) {
      await callSignaling('send-message', {
        roomId,
        playerId: 'system',
        playerName: 'System',
        content: `The word was: ${gameState.currentWord}`,
        isSystemMessage: true
      });
    }

    setTimeout(() => {
      nextTurn();
    }, 3000);
  }, [gameState, roomId, updateGameState, nextTurn]);

  // Reset game
  const resetGame = useCallback(async () => {
    if (!roomId) return;

    // Reset all player scores
    for (const player of players) {
      await callSignaling('update-score', {
        roomId,
        playerId: player.id,
        score: 0
      });
    }

    const newState: GameState = {
      ...initialGameState,
      drawTime: settings.drawTime,
      totalRounds: settings.totalRounds
    };

    setGameState(newState);
    await updateGameState(newState);
  }, [roomId, players, settings, updateGameState]);

  // Leave room
  const leaveRoom = useCallback(async () => {
    if (roomId && playerId) {
      const player = players.find(p => p.id === playerId);
      await callSignaling('leave-room', {
        roomId,
        playerId,
        playerName: player?.name || 'Unknown'
      });
    }

    setRoomId(null);
    setRoomCode(null);
    setPlayerId(null);
    setPlayers([]);
    setMessages([]);
    setGameState(initialGameState);
    setWordOptions([]);
  }, [roomId, playerId, players]);

  // Timer effect
  useEffect(() => {
    if (gameState.phase !== 'drawing') {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    const currentPlayer = players.find(p => p.id === playerId);
    const isHost = currentPlayer?.isHost;

    // Only the host manages the timer
    if (!isHost) return;

    timerRef.current = setInterval(async () => {
      setGameState(prev => {
        if (prev.timeRemaining <= 0) return prev;

        const newTime = prev.timeRemaining - 1;
        
        // Auto reveal hints
        let newHint = prev.wordHint;
        if (prev.currentWord && (newTime === Math.floor(prev.drawTime * 0.6) || 
            newTime === Math.floor(prev.drawTime * 0.3))) {
          const currentRevealedCount = prev.wordHint.split('').filter(c => c !== '_' && c !== ' ').length;
          newHint = generateWordHint(prev.currentWord, currentRevealedCount + 1);
        }

        const newState = {
          ...prev,
          timeRemaining: newTime,
          wordHint: newHint
        };

        // Update server
        updateGameState(newState);

        return newState;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [gameState.phase, playerId, players, updateGameState]);

  // End round when time runs out or everyone guessed
  useEffect(() => {
    if (gameState.phase !== 'drawing') return;

    const currentPlayer = players.find(p => p.id === playerId);
    const isHost = currentPlayer?.isHost;
    if (!isHost) return;

    const nonDrawerCount = players.filter(p => p.id !== gameState.currentDrawerId).length;
    const allGuessed = gameState.correctGuessers.length >= nonDrawerCount;

    if (gameState.timeRemaining <= 0 || allGuessed) {
      endRound();
    }
  }, [gameState.timeRemaining, gameState.correctGuessers, gameState.phase, players, gameState.currentDrawerId, endRound, playerId]);

  const currentPlayer = players.find(p => p.id === playerId);
  const isHost = currentPlayer?.isHost ?? false;
  const isDrawer = playerId === gameState.currentDrawerId;
  const canStartGame = isHost && players.length >= 2 && 
    players.every(p => p.isReady);

  return {
    roomId,
    roomCode,
    playerId,
    players,
    messages,
    gameState,
    settings,
    setSettings,
    wordOptions,
    currentPlayer,
    isHost,
    isDrawer,
    canStartGame,
    isLoading,
    createRoom,
    joinRoom,
    addBotPlayer,
    toggleReady,
    toggleMute,
    startGame,
    selectWord,
    sendMessage,
    nextTurn,
    resetGame,
    leaveRoom
  };
};
