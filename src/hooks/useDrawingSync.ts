import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DrawingData } from '@/types/game';

interface DrawingPoint {
  x: number;
  y: number;
  color: string;
  brushSize: number;
  tool: 'brush' | 'eraser';
}

export const useDrawingSync = (
  roomId: string | null,
  isDrawer: boolean,
  onDrawingReceived: (data: DrawingData) => void
) => {
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Subscribe to drawing updates
  useEffect(() => {
    if (!roomId) return;

    console.log('[DrawingSync] Setting up channel for room:', roomId);

    const channel = supabase.channel(`drawing-${roomId}`, {
      config: { broadcast: { self: false } }
    });

    channel
      .on('broadcast', { event: 'draw' }, ({ payload }) => {
        if (!isDrawer && payload) {
          onDrawingReceived(payload as DrawingData);
        }
      })
      .subscribe((status) => {
        console.log('[DrawingSync] Channel status:', status);
      });

    channelRef.current = channel;

    return () => {
      console.log('[DrawingSync] Cleaning up channel');
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [roomId, isDrawer, onDrawingReceived]);

  // Send drawing data
  const sendDrawingData = useCallback((data: DrawingData) => {
    if (!channelRef.current || !isDrawer) return;

    channelRef.current.send({
      type: 'broadcast',
      event: 'draw',
      payload: data
    });
  }, [isDrawer]);

  return { sendDrawingData };
};
