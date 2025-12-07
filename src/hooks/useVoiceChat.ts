import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PeerConnection {
  peerId: string;
  connection: RTCPeerConnection;
  audioStream?: MediaStream;
}

export const useVoiceChat = (roomId: string | null, playerId: string | null) => {
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [speakingPeers, setSpeakingPeers] = useState<Set<string>>(new Set());
  
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, PeerConnection>>(new Map());
  const audioContextRef = useRef<AudioContext | null>(null);
  const iceServersRef = useRef<RTCIceServer[]>([]);

  // Get ICE servers from signaling server
  const getIceServers = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('signaling', {
        body: { action: 'get-ice-servers' }
      });
      
      if (error) throw error;
      iceServersRef.current = data.iceServers || [];
      console.log('[VoiceChat] ICE servers loaded:', iceServersRef.current);
    } catch (err) {
      console.error('[VoiceChat] Failed to get ICE servers:', err);
      // Fallback to Google STUN servers
      iceServersRef.current = [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ];
    }
  };

  // Initialize local audio stream
  const initLocalStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      localStreamRef.current = stream;
      console.log('[VoiceChat] Local stream initialized');
      return stream;
    } catch (err) {
      console.error('[VoiceChat] Failed to get microphone:', err);
      toast.error('Failed to access microphone');
      throw err;
    }
  };

  // Create peer connection
  const createPeerConnection = (peerId: string): RTCPeerConnection => {
    const config: RTCConfiguration = {
      iceServers: iceServersRef.current.length > 0 
        ? iceServersRef.current 
        : [{ urls: 'stun:stun.l.google.com:19302' }]
    };

    const pc = new RTCPeerConnection(config);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('[VoiceChat] ICE candidate for peer:', peerId);
        // In a real implementation, send this to the signaling server
      }
    };

    pc.ontrack = (event) => {
      console.log('[VoiceChat] Received track from peer:', peerId);
      const audioElement = document.createElement('audio');
      audioElement.srcObject = event.streams[0];
      audioElement.autoplay = true;
      audioElement.id = `audio-${peerId}`;
      document.body.appendChild(audioElement);

      // Set up audio level detection
      setupAudioLevelDetection(event.streams[0], peerId);
    };

    pc.onconnectionstatechange = () => {
      console.log('[VoiceChat] Connection state:', pc.connectionState, 'for peer:', peerId);
    };

    return pc;
  };

  // Set up audio level detection for speaking indicator
  const setupAudioLevelDetection = (stream: MediaStream, peerId: string) => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }

    const audioContext = audioContextRef.current;
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;

    source.connect(analyser);

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    
    const checkLevel = () => {
      analyser.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
      
      if (average > 30) {
        setSpeakingPeers(prev => new Set([...prev, peerId]));
      } else {
        setSpeakingPeers(prev => {
          const next = new Set(prev);
          next.delete(peerId);
          return next;
        });
      }

      if (isVoiceEnabled) {
        requestAnimationFrame(checkLevel);
      }
    };

    checkLevel();
  };

  // Enable voice chat
  const enableVoice = useCallback(async () => {
    if (!roomId || !playerId) return;

    setIsConnecting(true);
    try {
      await getIceServers();
      await initLocalStream();
      setIsVoiceEnabled(true);
      toast.success('Voice chat enabled');
      console.log('[VoiceChat] Voice chat enabled');
    } catch (err) {
      console.error('[VoiceChat] Failed to enable voice:', err);
    } finally {
      setIsConnecting(false);
    }
  }, [roomId, playerId]);

  // Disable voice chat
  const disableVoice = useCallback(() => {
    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }

    // Close all peer connections
    peerConnectionsRef.current.forEach(({ connection }) => {
      connection.close();
    });
    peerConnectionsRef.current.clear();

    // Remove audio elements
    document.querySelectorAll('audio[id^="audio-"]').forEach(el => el.remove());

    // Close audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    setIsVoiceEnabled(false);
    setSpeakingPeers(new Set());
    console.log('[VoiceChat] Voice chat disabled');
  }, []);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = isMuted;
        setIsMuted(!isMuted);
        console.log('[VoiceChat] Mute toggled:', !isMuted);
      }
    }
  }, [isMuted]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disableVoice();
    };
  }, [disableVoice]);

  return {
    isVoiceEnabled,
    isMuted,
    isConnecting,
    speakingPeers,
    enableVoice,
    disableVoice,
    toggleMute
  };
};
