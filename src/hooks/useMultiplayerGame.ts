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
  correctGuessers: [],
  revealedForPlayers: []
};

const defaultSettings: RoomSettings = {
  maxPlayers: 8,
  drawTime: 80,
  totalRounds: 3,
  isPublic: true,
  hintLevel: 2,
  gameMode: 'normal',
  language: 'english',
  wordCount: 3,
  showHints: true
};

// Shuffle array using Fisher-Yates
const shuffleArray = <T,>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

// Storage key for session persistence
const SESSION_STORAGE_KEY = 'drawparty_session';

interface StoredSession {
  roomId: string;
  roomCode: string;
  playerId: string;
  sessionToken: string;
  playerName: string;
  playerAvatar: string;
}

const saveSession = (session: StoredSession) => {
  try {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch (e) {
    console.error('[Session] Failed to save session:', e);
  }
};

const loadSession = (): StoredSession | null => {
  try {
    const stored = localStorage.getItem(SESSION_STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch (e) {
    console.error('[Session] Failed to load session:', e);
    return null;
  }
};

const clearSession = () => {
  try {
    localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch (e) {
    console.error('[Session] Failed to clear session:', e);
  }
};

export const useMultiplayerGame = () => {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState<string>('');
  const [playerAvatar, setPlayerAvatar] = useState<string>('');
  const [players, setPlayers] = useState<Player[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [gameState, setGameState] = useState<GameState>(initialGameState);
  const [settings, setSettings] = useState<RoomSettings>(defaultSettings);
  const [wordOptions, setWordOptions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStartingGame, setIsStartingGame] = useState(false);
  const [isTogglingReady, setIsTogglingReady] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [drawingOrder, setDrawingOrder] = useState<string[]>([]);
  const [currentTurnIndex, setCurrentTurnIndex] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const joiningRef = useRef(false);
  const hasAttemptedRejoin = useRef(false);
  const lastActionTime = useRef<Record<string, number>>({});

  // Debounce helper - prevents rapid repeated calls
  const shouldDebounce = (action: string, debounceMs: number = 500): boolean => {
    const now = Date.now();
    const lastTime = lastActionTime.current[action] || 0;
    if (now - lastTime < debounceMs) {
      console.log(`[Signaling] Debouncing ${action}`);
      return true;
    }
    lastActionTime.current[action] = now;
    return false;
  };

  // Call signaling server with session token
  const callSignaling = async (action: string, params: Record<string, unknown>) => {
    try {
      console.log(`[Signaling] Calling ${action}`, { hasToken: !!sessionToken });
      const { data, error } = await supabase.functions.invoke('signaling', {
        body: { 
          action, 
          ...params,
          sessionToken: params.sessionToken || sessionToken 
        }
      });
      
      if (error) {
        console.error(`[Signaling] ${action} error:`, error);
        throw error;
      }
      
      if (data && !data.success && data.error) {
        console.error(`[Signaling] ${action} failed:`, data.error);
        toast.error(data.error);
        return data;
      }
      
      return data;
    } catch (err) {
      console.error(`[Signaling] ${action} error:`, err);
      toast.error(`Action failed: ${action}`);
      throw err;
    }
  };

  // Subscribe to realtime updates
  useEffect(() => {
    if (!roomId) return;

    console.log('[Multiplayer] Setting up realtime subscriptions for room:', roomId);

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
        () => {
          fetchPlayers();
        }
      )
      .subscribe();

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
        async (payload) => {
          const newRoom = payload.new as { game_state: GameState; settings: RoomSettings };
          if (newRoom.game_state) {
            // Ensure revealedForPlayers exists
            const state = {
              ...newRoom.game_state,
              revealedForPlayers: newRoom.game_state.revealedForPlayers || []
            };
            setGameState(state);
            
            // If this player is the drawer and we're in wordSelection phase, fetch word options
            if (state.phase === 'wordSelection' && 
                state.currentDrawerId === playerId && 
                wordOptions.length === 0 &&
                sessionToken) {
              try {
                const result = await callSignaling('get-word-options', {
                  roomId,
                  playerId
                });
                if (result.success && result.wordOptions) {
                  setWordOptions(result.wordOptions);
                }
              } catch (err) {
                console.error('[Multiplayer] Failed to fetch word options:', err);
              }
            }
          }
          if (newRoom.settings) {
            setSettings({ ...defaultSettings, ...newRoom.settings });
          }
        }
      )
      .subscribe();

    fetchPlayers();
    fetchMessages();

    return () => {
      supabase.removeChannel(playersChannel);
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(roomChannel);
    };
  }, [roomId, playerId, sessionToken]);

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
  const createRoom = useCallback(async (name: string, avatar: string) => {
    setIsLoading(true);
    try {
      const newPlayerId = generateId();
      
      // Use current settings state directly
      const roomSettings = { ...settings };
      console.log('[Multiplayer] Creating room with settings:', roomSettings);
      
      const result = await callSignaling('create-room', {
        hostId: newPlayerId,
        hostName: name,
        hostAvatar: avatar,
        settings: roomSettings,
        sessionToken: null // No token yet
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to create room');
      }

      setRoomId(result.roomId);
      setRoomCode(result.roomCode);
      setPlayerId(newPlayerId);
      setSessionToken(result.sessionToken);
      setPlayerName(name);
      setPlayerAvatar(avatar);
      
      // Use settings from response if available, otherwise use what we sent
      const finalSettings = result.settings || roomSettings;
      setSettings(finalSettings);
      
      setGameState(prev => ({
        ...prev,
        drawTime: finalSettings.drawTime,
        totalRounds: finalSettings.totalRounds,
        revealedForPlayers: []
      }));

      // Save session for persistence
      saveSession({
        roomId: result.roomId,
        roomCode: result.roomCode,
        playerId: newPlayerId,
        sessionToken: result.sessionToken,
        playerName: name,
        playerAvatar: avatar
      });

      // Update URL with room code
      window.history.replaceState({}, '', `?room=${result.roomCode}`);

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

  // Join room - with duplicate prevention
  const joinRoom = useCallback(async (code: string, name: string, avatar: string) => {
    // Prevent double-clicking
    if (joiningRef.current) {
      console.log('[Multiplayer] Join already in progress');
      return false;
    }
    
    joiningRef.current = true;
    setIsLoading(true);
    
    try {
      const newPlayerId = generateId();
      
      const result = await callSignaling('join-room', {
        code: code.toUpperCase(),
        playerId: newPlayerId,
        playerName: name,
        playerAvatar: avatar,
        sessionToken: null // No token yet
      });

      if (!result.success) {
        toast.error(result.error || 'Failed to join room');
        return false;
      }

      setRoomId(result.roomId);
      setRoomCode(code.toUpperCase());
      setPlayerId(newPlayerId);
      setSessionToken(result.sessionToken);
      setPlayerName(name);
      setPlayerAvatar(avatar);

      const { data: room } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', result.roomId)
        .single();

      if (room) {
        const roomGameState = room.game_state as unknown as GameState;
        setGameState({
          ...roomGameState,
          revealedForPlayers: roomGameState.revealedForPlayers || []
        });
        setSettings({ ...defaultSettings, ...(room.settings as unknown as RoomSettings) });
      }

      // Save session for persistence
      saveSession({
        roomId: result.roomId,
        roomCode: code.toUpperCase(),
        playerId: newPlayerId,
        sessionToken: result.sessionToken,
        playerName: name,
        playerAvatar: avatar
      });

      // Update URL with room code
      window.history.replaceState({}, '', `?room=${code.toUpperCase()}`);

      toast.success('Joined room!');
      return true;
    } catch (err) {
      console.error('[Multiplayer] Join room error:', err);
      toast.error('Failed to join room');
      return false;
    } finally {
      setIsLoading(false);
      // Reset after a short delay to prevent rapid re-clicks
      setTimeout(() => {
        joiningRef.current = false;
      }, 1000);
    }
  }, []);

  // Try to rejoin from stored session on mount
  useEffect(() => {
    if (hasAttemptedRejoin.current) return;
    hasAttemptedRejoin.current = true;

    const storedSession = loadSession();
    if (!storedSession) return;

    // Check if URL has a room code that matches
    const params = new URLSearchParams(window.location.search);
    const urlRoomCode = params.get('room');
    
    // Only auto-rejoin if URL room code matches stored session
    if (urlRoomCode && urlRoomCode.toUpperCase() === storedSession.roomCode) {
      console.log('[Multiplayer] Attempting to rejoin session...');
      
      // Rejoin using stored credentials
      (async () => {
        setIsLoading(true);
        try {
          const result = await callSignaling('join-room', {
            code: storedSession.roomCode,
            playerId: storedSession.playerId,
            playerName: storedSession.playerName,
            playerAvatar: storedSession.playerAvatar,
            sessionToken: null
          });

          if (!result.success) {
            console.log('[Multiplayer] Failed to rejoin, clearing session');
            clearSession();
            window.history.replaceState({}, '', window.location.pathname);
            return;
          }

          setRoomId(result.roomId);
          setRoomCode(storedSession.roomCode);
          setPlayerId(storedSession.playerId);
          setSessionToken(result.sessionToken);
          setPlayerName(storedSession.playerName);
          setPlayerAvatar(storedSession.playerAvatar);

          // Update stored session with new token
          saveSession({
            ...storedSession,
            roomId: result.roomId,
            sessionToken: result.sessionToken
          });

          const { data: room } = await supabase
            .from('rooms')
            .select('*')
            .eq('id', result.roomId)
            .single();

          if (room) {
            const roomGameState = room.game_state as unknown as GameState;
            setGameState({
              ...roomGameState,
              revealedForPlayers: roomGameState.revealedForPlayers || []
            });
            setSettings({ ...defaultSettings, ...(room.settings as unknown as RoomSettings) });
          }

          toast.success('Reconnected to room!');
        } catch (err) {
          console.error('[Multiplayer] Rejoin error:', err);
          clearSession();
          window.history.replaceState({}, '', window.location.pathname);
        } finally {
          setIsLoading(false);
        }
      })();
    } else if (!urlRoomCode) {
      // No room in URL, clear any stale session
      clearSession();
    }
  }, []);

  // Add bot player
  const addBotPlayer = useCallback(async () => {
    if (!roomId || !playerId || !sessionToken) return;

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
      playerId,
      botId,
      botName,
      botAvatar
    });
  }, [roomId, playerId, sessionToken, players]);

  // Toggle ready - with debounce and loading state
  const toggleReady = useCallback(async () => {
    if (!roomId || !playerId || !sessionToken) {
      console.log('[Multiplayer] toggleReady: missing required data', { roomId, playerId, hasToken: !!sessionToken });
      return;
    }

    if (isTogglingReady || shouldDebounce('toggle-ready', 1000)) return;

    const currentPlayer = players.find(p => p.id === playerId);
    if (!currentPlayer) {
      console.log('[Multiplayer] toggleReady: player not found');
      return;
    }

    setIsTogglingReady(true);
    try {
      const result = await callSignaling('toggle-ready', {
        roomId,
        playerId,
        isReady: !currentPlayer.isReady
      });
      
      if (result?.success) {
        // Optimistic update
        setPlayers(prev => prev.map(p => 
          p.id === playerId ? { ...p, isReady: !p.isReady } : p
        ));
      }
    } catch (err) {
      console.error('[Multiplayer] toggleReady error:', err);
    } finally {
      setIsTogglingReady(false);
    }
  }, [roomId, playerId, sessionToken, players, isTogglingReady]);

  // Toggle mute
  const toggleMute = useCallback(async () => {
    if (!roomId || !playerId || !sessionToken) return;

    const currentPlayer = players.find(p => p.id === playerId);
    if (!currentPlayer) return;

    await callSignaling('toggle-mute', {
      roomId,
      playerId,
      isMuted: !currentPlayer.isMuted
    });
  }, [roomId, playerId, sessionToken, players]);

  // Update game state on server
  const updateGameState = useCallback(async (newState: GameState) => {
    if (!roomId || !playerId || !sessionToken) return;

    await callSignaling('update-game-state', {
      roomId,
      playerId,
      gameState: {
        ...newState,
        revealedForPlayers: newState.revealedForPlayers || []
      }
    });
  }, [roomId, playerId, sessionToken]);

  // Update settings
  const updateSettings = useCallback(async (newSettings: RoomSettings) => {
    setSettings(newSettings);
    if (roomId && playerId && sessionToken) {
      await callSignaling('update-settings', {
        roomId,
        playerId,
        settings: newSettings
      });
    }
  }, [roomId, playerId, sessionToken]);

  // Start game - with random drawing order and debounce
  const startGame = useCallback(async () => {
    if (players.length < 2 || !roomId || !playerId || !sessionToken) {
      console.log('[Multiplayer] startGame: missing required data');
      return;
    }
    
    if (isStartingGame || shouldDebounce('start-game', 2000)) {
      console.log('[Multiplayer] startGame: already starting or debounced');
      return;
    }
    
    setIsStartingGame(true);
    
    try {
      // Shuffle players for random drawing order
      const shuffledPlayerIds = shuffleArray(players.map(p => p.id));
      setDrawingOrder(shuffledPlayerIds);
      setCurrentTurnIndex(0);
      
      const wordCount = settings.wordCount || 3;
      const words = getRandomWords(wordCount);
      
      const firstDrawerId = shuffledPlayerIds[0];
      
      // Start game via edge function
      const result = await callSignaling('start-game', {
        roomId,
        playerId,
        drawingOrder: shuffledPlayerIds,
        wordOptions: words
      });
      
      if (!result?.success) {
        console.error('[Multiplayer] startGame failed:', result?.error);
        return;
      }
      
      // If I'm the first drawer, set word options locally
      if (firstDrawerId === playerId) {
        setWordOptions(words);
      }
      
      // Send system message
      const drawerName = players.find(p => p.id === firstDrawerId)?.name || 'Unknown';
      await callSignaling('send-message', {
        roomId,
        playerId: 'system',
        playerName: 'System',
        content: `Round 1 started! ${drawerName} is drawing first.`,
        isSystemMessage: true
      });
      
      toast.success('Game started!');
    } catch (err) {
      console.error('[Multiplayer] startGame error:', err);
    } finally {
      setIsStartingGame(false);
    }
  }, [players, roomId, playerId, sessionToken, settings, isStartingGame]);

  // Select word - CRITICAL: This must transition from wordSelection to drawing
  const selectWord = useCallback(async (word: string) => {
    if (!roomId || !playerId || !sessionToken || gameState.phase !== 'wordSelection') return;
    
    // Select word via edge function (validates and stores securely)
    const result = await callSignaling('select-word', {
      roomId,
      playerId,
      word
    });
    
    if (!result.success) {
      toast.error(result.error || 'Failed to select word');
      return;
    }
    
    setWordOptions([]);
    
    // System message
    await callSignaling('send-message', {
      roomId,
      playerId: 'system',
      playerName: 'System',
      content: `${players.find(p => p.id === gameState.currentDrawerId)?.name || 'Drawer'} is now drawing!`,
      isSystemMessage: true
    });
  }, [gameState, roomId, playerId, sessionToken, players]);

  // Send message with improved scoring - with debounce for rapid messages
  const sendMessage = useCallback(async (content: string) => {
    if (!roomId || !playerId || !sessionToken) {
      console.log('[Multiplayer] sendMessage: missing required data');
      return;
    }
    
    if (isSendingMessage) {
      console.log('[Multiplayer] sendMessage: already sending');
      return;
    }
    
    const player = players.find(p => p.id === playerId);
    if (!player) {
      console.log('[Multiplayer] sendMessage: player not found');
      return;
    }

    setIsSendingMessage(true);
    
    try {
      // Check if this might be a correct guess
      if (gameState.phase === 'drawing' && 
          gameState.currentDrawerId !== playerId &&
          !gameState.correctGuessers.includes(playerId)) {
        
        // Check guess via edge function (secure word comparison)
        const guessResult = await callSignaling('check-guess', {
          roomId,
          playerId,
          guess: content
        });
        
        if (guessResult?.isCorrect) {
          // Timer-based scoring: faster guess = more points
          const timePercentage = gameState.timeRemaining / gameState.drawTime;
          const basePoints = 50;
          const timeBonus = Math.floor(timePercentage * 100);
          const orderBonus = Math.max(0, (players.length - gameState.correctGuessers.length - 1)) * 10;
          const points = basePoints + timeBonus + orderBonus;

          // Update guesser score (host updates scores)
          const currentPlayerData = players.find(p => p.id === playerId);
          const isHostPlayer = currentPlayerData?.isHost;
          
          if (isHostPlayer) {
            await callSignaling('update-score', {
              roomId,
              playerId,
              targetPlayerId: playerId,
              score: player.score + points
            });

            // Update drawer score
            const drawer = players.find(p => p.id === gameState.currentDrawerId);
            if (drawer) {
              const drawerBonus = 10 + Math.floor(timePercentage * 15);
              await callSignaling('update-score', {
                roomId,
                playerId,
                targetPlayerId: drawer.id,
                score: drawer.score + drawerBonus
              });
            }
          }

          // Update game state - add player to correctGuessers
          const newState: GameState = {
            ...gameState,
            correctGuessers: [...gameState.correctGuessers, playerId],
            revealedForPlayers: [...(gameState.revealedForPlayers || []), playerId]
          };
          setGameState(newState);
          
          if (isHostPlayer) {
            await updateGameState(newState);
          }

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
          
          return;
        }
      }
      
      // Regular message
      const result = await callSignaling('send-message', {
        roomId,
        playerId,
        playerName: player.name,
        content
      });
      
      console.log('[Multiplayer] Message sent:', result?.success);
    } catch (err) {
      console.error('[Multiplayer] sendMessage error:', err);
    } finally {
      setIsSendingMessage(false);
    }
  }, [roomId, playerId, sessionToken, players, gameState, updateGameState, isSendingMessage]);

  // Next turn - random order per round
  const nextTurn = useCallback(async () => {
    if (!roomId || !playerId || !sessionToken) return;
    
    const nextIndex = currentTurnIndex + 1;
    const isRoundComplete = nextIndex >= drawingOrder.length;
    
    if (isRoundComplete) {
      // All players have drawn this round
      const newRound = gameState.currentRound + 1;
      
      if (newRound > gameState.totalRounds) {
        // Game over
        await callSignaling('end-game', {
          roomId,
          playerId
        });
        return;
      }
      
      // Start new round with reshuffled order
      const newOrder = shuffleArray(players.map(p => p.id));
      setDrawingOrder(newOrder);
      setCurrentTurnIndex(0);
      
      const wordCount = settings.wordCount || 3;
      const words = getRandomWords(wordCount);
      
      // If I'm the next drawer, set word options locally
      if (newOrder[0] === playerId) {
        setWordOptions(words);
      }
      
      await callSignaling('next-turn', {
        roomId,
        playerId,
        nextDrawerId: newOrder[0],
        wordOptions: words,
        isNewRound: true,
        newRound
      });
      
      const drawerName = players.find(p => p.id === newOrder[0])?.name || 'Unknown';
      await callSignaling('send-message', {
        roomId,
        playerId: 'system',
        playerName: 'System',
        content: `Round ${newRound} started! ${drawerName} is drawing.`,
        isSystemMessage: true
      });
    } else {
      // Next player in current round
      setCurrentTurnIndex(nextIndex);
      
      const wordCount = settings.wordCount || 3;
      const words = getRandomWords(wordCount);
      
      // If I'm the next drawer, set word options locally
      if (drawingOrder[nextIndex] === playerId) {
        setWordOptions(words);
      }

      const drawerName = players.find(p => p.id === drawingOrder[nextIndex])?.name || 'Unknown';
      
      await callSignaling('next-turn', {
        roomId,
        playerId,
        nextDrawerId: drawingOrder[nextIndex],
        wordOptions: words,
        isNewRound: false
      });
      
      await callSignaling('send-message', {
        roomId,
        playerId: 'system',
        playerName: 'System',
        content: `${drawerName}'s turn to draw!`,
        isSystemMessage: true
      });
    }
  }, [currentTurnIndex, drawingOrder, players, gameState, settings, roomId, playerId, sessionToken]);

  // End round
  const endRound = useCallback(async () => {
    if (!roomId || !playerId || !sessionToken) return;
    
    // Get the actual word from edge function
    const revealResult = await callSignaling('reveal-word', {
      roomId,
      playerId
    });
    
    const newState: GameState = {
      ...gameState,
      phase: 'revealing',
      revealedForPlayers: players.map(p => p.id)
    };
    setGameState(newState);
    await updateGameState(newState);

    if (revealResult.word) {
      await callSignaling('send-message', {
        roomId,
        playerId: 'system',
        playerName: 'System',
        content: `The word was: ${revealResult.word}`,
        isSystemMessage: true
      });
    }

    setTimeout(() => {
      nextTurn();
    }, 3000);
  }, [gameState, roomId, playerId, sessionToken, players, updateGameState, nextTurn]);

  // Reset game
  const resetGame = useCallback(async () => {
    if (!roomId || !playerId || !sessionToken) return;

    // Reset scores (only host can do this)
    for (const player of players) {
      await callSignaling('update-score', {
        roomId,
        playerId,
        targetPlayerId: player.id,
        score: 0
      });
    }

    const newState: GameState = {
      ...initialGameState,
      drawTime: settings.drawTime,
      totalRounds: settings.totalRounds
    };

    setDrawingOrder([]);
    setCurrentTurnIndex(0);
    setGameState(newState);
    await updateGameState(newState);
  }, [roomId, playerId, sessionToken, players, settings, updateGameState]);

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

    // Clear stored session and URL
    clearSession();
    window.history.replaceState({}, '', window.location.pathname);

    setRoomId(null);
    setRoomCode(null);
    setPlayerId(null);
    setSessionToken(null);
    setPlayerName('');
    setPlayerAvatar('');
    setPlayers([]);
    setMessages([]);
    setGameState(initialGameState);
    setWordOptions([]);
    setDrawingOrder([]);
    setCurrentTurnIndex(0);
  }, [roomId, playerId, players, sessionToken]);

  // Timer effect - only host runs the timer
  useEffect(() => {
    if (gameState.phase !== 'drawing') {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    const currentPlayerData = players.find(p => p.id === playerId);
    const isHost = currentPlayerData?.isHost;

    // Only the host manages the timer
    if (!isHost) return;

    timerRef.current = setInterval(async () => {
      setGameState(prev => {
        if (prev.timeRemaining <= 0) return prev;

        const newTime = prev.timeRemaining - 1;
        
        const newState = {
          ...prev,
          timeRemaining: newTime
        };

        // Update game state on server
        updateGameState(newState);
        
        // Reveal hints at specific time thresholds (60%, 40%, 20%)
        const timePercentage = newTime / prev.drawTime;
        if (settings.showHints && 
            (Math.abs(timePercentage - 0.6) < 0.02 || 
             Math.abs(timePercentage - 0.4) < 0.02 || 
             Math.abs(timePercentage - 0.2) < 0.02)) {
          callSignaling('reveal-hint', {
            roomId,
            playerId,
            timeRemaining: newTime,
            drawTime: prev.drawTime
          });
        }

        return newState;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [gameState.phase, playerId, players, settings.showHints, updateGameState]);

  // End round when time runs out or everyone guessed
  useEffect(() => {
    if (gameState.phase !== 'drawing') return;

    const currentPlayerData = players.find(p => p.id === playerId);
    const isHost = currentPlayerData?.isHost;
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
  const canStartGame = isHost && players.length >= 2 && players.every(p => p.isReady || p.isHost);

  return {
    roomId,
    roomCode,
    playerId,
    players,
    messages,
    gameState,
    settings,
    setSettings: updateSettings,
    wordOptions,
    currentPlayer,
    isHost,
    isDrawer,
    canStartGame,
    isLoading,
    isStartingGame,
    isTogglingReady,
    createRoom,
    joinRoom,
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