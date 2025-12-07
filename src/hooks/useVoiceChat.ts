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
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const iceServersRef = useRef<RTCIceServer[]>([
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ]);

  // Get ICE servers from signaling server
  const getIceServers = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('signaling', {
        body: { action: 'get-ice-servers' }
      });
      
      if (error) throw error;
      if (data.iceServers) {
        iceServersRef.current = data.iceServers;
      }
      console.log('[VoiceChat] ICE servers loaded:', iceServersRef.current);
    } catch (err) {
      console.error('[VoiceChat] Failed to get ICE servers, using defaults:', err);
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
      toast.error('Failed to access microphone. Please allow microphone access.');
      throw err;
    }
  };

  // Create peer connection for a specific peer
  const createPeerConnection = useCallback((peerId: string): RTCPeerConnection => {
    const config: RTCConfiguration = {
      iceServers: iceServersRef.current
    };

    const pc = new RTCPeerConnection(config);

    // Add local tracks to connection
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && channelRef.current) {
        console.log('[VoiceChat] Sending ICE candidate to:', peerId);
        channelRef.current.send({
          type: 'broadcast',
          event: 'ice-candidate',
          payload: {
            from: playerId,
            to: peerId,
            candidate: event.candidate
          }
        });
      }
    };

    // Handle incoming tracks
    pc.ontrack = (event) => {
      console.log('[VoiceChat] Received track from peer:', peerId);
      
      // Create audio element for playback
      const existingAudio = document.getElementById(`audio-${peerId}`) as HTMLAudioElement;
      if (existingAudio) {
        existingAudio.srcObject = event.streams[0];
      } else {
        const audioElement = document.createElement('audio');
        audioElement.srcObject = event.streams[0];
        audioElement.autoplay = true;
        audioElement.id = `audio-${peerId}`;
        document.body.appendChild(audioElement);
      }

      // Set up speaking detection
      setupSpeakingDetection(event.streams[0], peerId);
    };

    pc.onconnectionstatechange = () => {
      console.log('[VoiceChat] Connection state:', pc.connectionState, 'for peer:', peerId);
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        // Clean up failed connection
        removePeerConnection(peerId);
      }
    };

    peerConnectionsRef.current.set(peerId, { peerId, connection: pc });
    return pc;
  }, [playerId]);

  // Set up speaking detection
  const setupSpeakingDetection = (stream: MediaStream, peerId: string) => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }

      const audioContext = audioContextRef.current;
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;

      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      let animationId: number;
      
      const checkLevel = () => {
        if (!isVoiceEnabled) {
          cancelAnimationFrame(animationId);
          return;
        }
        
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        
        setSpeakingPeers(prev => {
          const next = new Set(prev);
          if (average > 25) {
            next.add(peerId);
          } else {
            next.delete(peerId);
          }
          return next;
        });

        animationId = requestAnimationFrame(checkLevel);
      };

      checkLevel();
    } catch (err) {
      console.error('[VoiceChat] Failed to setup speaking detection:', err);
    }
  };

  // Remove peer connection
  const removePeerConnection = (peerId: string) => {
    const peer = peerConnectionsRef.current.get(peerId);
    if (peer) {
      peer.connection.close();
      peerConnectionsRef.current.delete(peerId);
    }
    
    // Remove audio element
    const audioEl = document.getElementById(`audio-${peerId}`);
    if (audioEl) audioEl.remove();
    
    setSpeakingPeers(prev => {
      const next = new Set(prev);
      next.delete(peerId);
      return next;
    });
  };

  // Handle incoming signaling messages
  const handleSignalingMessage = useCallback(async (event: string, payload: any) => {
    if (!playerId) return;
    
    // Ignore messages not meant for us
    if (payload.to && payload.to !== playerId) return;
    
    const fromPeer = payload.from;
    if (fromPeer === playerId) return;

    console.log('[VoiceChat] Received signaling:', event, 'from:', fromPeer);

    switch (event) {
      case 'voice-join': {
        // Someone joined voice, send them an offer
        if (isVoiceEnabled && fromPeer !== playerId) {
          const pc = createPeerConnection(fromPeer);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          
          channelRef.current?.send({
            type: 'broadcast',
            event: 'offer',
            payload: { from: playerId, to: fromPeer, offer }
          });
        }
        break;
      }

      case 'offer': {
        let peer = peerConnectionsRef.current.get(fromPeer);
        if (!peer) {
          createPeerConnection(fromPeer);
          peer = peerConnectionsRef.current.get(fromPeer);
        }
        
        if (peer) {
          await peer.connection.setRemoteDescription(payload.offer);
          const answer = await peer.connection.createAnswer();
          await peer.connection.setLocalDescription(answer);
          
          channelRef.current?.send({
            type: 'broadcast',
            event: 'answer',
            payload: { from: playerId, to: fromPeer, answer }
          });
        }
        break;
      }

      case 'answer': {
        const peer = peerConnectionsRef.current.get(fromPeer);
        if (peer && peer.connection.signalingState === 'have-local-offer') {
          await peer.connection.setRemoteDescription(payload.answer);
        }
        break;
      }

      case 'ice-candidate': {
        const peer = peerConnectionsRef.current.get(fromPeer);
        if (peer && payload.candidate) {
          try {
            await peer.connection.addIceCandidate(payload.candidate);
          } catch (err) {
            console.error('[VoiceChat] Failed to add ICE candidate:', err);
          }
        }
        break;
      }

      case 'voice-leave': {
        removePeerConnection(fromPeer);
        break;
      }
    }
  }, [playerId, isVoiceEnabled, createPeerConnection]);

  // Set up signaling channel
  useEffect(() => {
    if (!roomId || !playerId || !isVoiceEnabled) return;

    console.log('[VoiceChat] Setting up signaling channel');

    const channel = supabase.channel(`voice-${roomId}`, {
      config: { broadcast: { self: false } }
    });

    channel
      .on('broadcast', { event: 'voice-join' }, ({ payload }) => handleSignalingMessage('voice-join', payload))
      .on('broadcast', { event: 'offer' }, ({ payload }) => handleSignalingMessage('offer', payload))
      .on('broadcast', { event: 'answer' }, ({ payload }) => handleSignalingMessage('answer', payload))
      .on('broadcast', { event: 'ice-candidate' }, ({ payload }) => handleSignalingMessage('ice-candidate', payload))
      .on('broadcast', { event: 'voice-leave' }, ({ payload }) => handleSignalingMessage('voice-leave', payload))
      .subscribe((status) => {
        console.log('[VoiceChat] Signaling channel status:', status);
        if (status === 'SUBSCRIBED') {
          // Announce we joined voice
          channel.send({
            type: 'broadcast',
            event: 'voice-join',
            payload: { from: playerId }
          });
        }
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'voice-leave',
          payload: { from: playerId }
        });
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [roomId, playerId, isVoiceEnabled, handleSignalingMessage]);

  // Enable voice chat
  const enableVoice = useCallback(async () => {
    if (!roomId || !playerId) {
      toast.error('Not connected to a room');
      return;
    }

    setIsConnecting(true);
    try {
      await getIceServers();
      await initLocalStream();
      setIsVoiceEnabled(true);
      toast.success('Voice chat enabled');
      console.log('[VoiceChat] Voice chat enabled');
    } catch (err) {
      console.error('[VoiceChat] Failed to enable voice:', err);
      setIsVoiceEnabled(false);
    } finally {
      setIsConnecting(false);
    }
  }, [roomId, playerId]);

  // Disable voice chat
  const disableVoice = useCallback(() => {
    // Announce leaving
    if (channelRef.current && playerId) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'voice-leave',
        payload: { from: playerId }
      });
    }

    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }

    // Close all peer connections
    peerConnectionsRef.current.forEach(({ connection, peerId }) => {
      connection.close();
      const audioEl = document.getElementById(`audio-${peerId}`);
      if (audioEl) audioEl.remove();
    });
    peerConnectionsRef.current.clear();

    // Close audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    setIsVoiceEnabled(false);
    setSpeakingPeers(new Set());
    setIsMuted(false);
    toast.info('Voice chat disabled');
    console.log('[VoiceChat] Voice chat disabled');
  }, [playerId]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = isMuted;
        setIsMuted(!isMuted);
        toast.info(isMuted ? 'Microphone unmuted' : 'Microphone muted');
        console.log('[VoiceChat] Mute toggled:', !isMuted);
      }
    }
  }, [isMuted]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isVoiceEnabled) {
        disableVoice();
      }
    };
  }, []);

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
