import { useRef, useEffect, useState, useCallback } from 'react';
import { DrawingData, DRAWING_COLORS, BRUSH_SIZES } from '@/types/game';
import { Button } from '@/components/ui/button';
import { Paintbrush, Eraser, Undo2, Redo2, Trash2, PaintBucket } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DrawingCanvasProps {
  isDrawer: boolean;
  onDrawingData?: (data: DrawingData) => void;
}

const MAX_HISTORY = 20; // Limit history to prevent memory issues

export const DrawingCanvas = ({ isDrawer, onDrawingData }: DrawingCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(5);
  const [tool, setTool] = useState<'brush' | 'eraser' | 'fill'>('brush');
  const [historyStack, setHistoryStack] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const isInitializedRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  // Save canvas state as data URL (more memory efficient than ImageData)
  const saveToHistory = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const dataUrl = canvas.toDataURL('image/png');
    
    setHistoryStack(prev => {
      const newHistory = [...prev.slice(0, historyIndex + 1), dataUrl];
      // Limit history size
      if (newHistory.length > MAX_HISTORY) {
        newHistory.shift();
        return newHistory;
      }
      return newHistory;
    });
    setHistoryIndex(prev => Math.min(prev + 1, MAX_HISTORY - 1));
  }, [historyIndex]);

  // Initialize canvas - only runs once
  useEffect(() => {
    if (isInitializedRef.current) return;
    
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    canvas.width = rect.width || 800;
    canvas.height = rect.height || 600;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Save initial state
    const dataUrl = canvas.toDataURL('image/png');
    setHistoryStack([dataUrl]);
    setHistoryIndex(0);
    
    isInitializedRef.current = true;
  }, []);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Save current drawing
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tempCtx = tempCanvas.getContext('2d');
      tempCtx?.drawImage(canvas, 0, 0);

      // Resize
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width || 800;
      canvas.height = rect.height || 600;

      // Restore drawing
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(tempCanvas, 0, 0);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ('touches' in e) {
      const touch = e.touches[0];
      if (!touch) return { x: 0, y: 0 };
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY
      };
    }

    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawer) return;
    e.preventDefault();
    
    const { x, y } = getCoordinates(e);
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;

    if (tool === 'fill') {
      // Use optimized flood fill
      optimizedFloodFill(Math.floor(x), Math.floor(y), color);
      saveToHistory();
      return;
    }

    setIsDrawing(true);
    lastPointRef.current = { x, y };
    
    // Draw a single point for click without drag
    ctx.beginPath();
    ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
    ctx.fillStyle = tool === 'eraser' ? '#FFFFFF' : color;
    ctx.fill();

    onDrawingData?.({
      type: 'start',
      x,
      y,
      color: tool === 'eraser' ? '#FFFFFF' : color,
      brushSize,
      timestamp: Date.now()
    });
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !isDrawer) return;
    e.preventDefault();

    const { x, y } = getCoordinates(e);
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !lastPointRef.current) return;

    ctx.beginPath();
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    ctx.lineTo(x, y);
    ctx.strokeStyle = tool === 'eraser' ? '#FFFFFF' : color;
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    lastPointRef.current = { x, y };

    onDrawingData?.({
      type: 'draw',
      x,
      y,
      timestamp: Date.now()
    });
  };

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
      lastPointRef.current = null;
      saveToHistory();
      onDrawingData?.({
        type: 'end',
        timestamp: Date.now()
      });
    }
  };

  // Optimized flood fill using scanline algorithm
  const optimizedFloodFill = (startX: number, startY: number, fillColor: string) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const width = canvas.width;
    const height = canvas.height;

    const hexToRgb = (hex: string) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16),
        255
      ] : [0, 0, 0, 255];
    };

    const getPixel = (x: number, y: number) => {
      const i = (y * width + x) * 4;
      return [data[i], data[i + 1], data[i + 2], data[i + 3]];
    };

    const setPixel = (x: number, y: number, color: number[]) => {
      const i = (y * width + x) * 4;
      data[i] = color[0];
      data[i + 1] = color[1];
      data[i + 2] = color[2];
      data[i + 3] = color[3];
    };

    const colorsMatch = (a: number[], b: number[], tolerance = 32) => {
      return Math.abs(a[0] - b[0]) <= tolerance &&
             Math.abs(a[1] - b[1]) <= tolerance &&
             Math.abs(a[2] - b[2]) <= tolerance;
    };

    const targetColor = getPixel(startX, startY);
    const fillRgb = hexToRgb(fillColor);

    if (colorsMatch(targetColor, fillRgb, 5)) return;

    const stack: [number, number][] = [[startX, startY]];
    const visited = new Uint8Array(width * height);

    while (stack.length > 0) {
      const [x, y] = stack.pop()!;
      
      if (x < 0 || x >= width || y < 0 || y >= height) continue;
      
      const idx = y * width + x;
      if (visited[idx]) continue;
      
      const currentColor = getPixel(x, y);
      if (!colorsMatch(currentColor, targetColor)) continue;

      visited[idx] = 1;
      setPixel(x, y, fillRgb);

      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }

    ctx.putImageData(imageData, 0, 0);
  };

  const undo = () => {
    if (historyIndex <= 0) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;

    const newIndex = historyIndex - 1;
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      setHistoryIndex(newIndex);
    };
    img.src = historyStack[newIndex];

    onDrawingData?.({ type: 'undo', timestamp: Date.now() });
  };

  const redo = () => {
    if (historyIndex >= historyStack.length - 1) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;

    const newIndex = historyIndex + 1;
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      setHistoryIndex(newIndex);
    };
    img.src = historyStack[newIndex];

    onDrawingData?.({ type: 'redo', timestamp: Date.now() });
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    saveToHistory();

    onDrawingData?.({ type: 'clear', timestamp: Date.now() });
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      <div 
        ref={containerRef}
        className="relative flex-1 bg-canvas-bg rounded-xl border-4 border-canvas-border shadow-lg overflow-hidden min-h-[400px]"
      >
        <canvas
          ref={canvasRef}
          className={cn(
            "absolute inset-0 w-full h-full touch-none",
            isDrawer ? "cursor-crosshair" : "cursor-not-allowed"
          )}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
        {!isDrawer && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-foreground/10 backdrop-blur-sm px-6 py-3 rounded-full">
              <p className="text-foreground/60 font-medium">Waiting for the drawing...</p>
            </div>
          </div>
        )}
      </div>

      {isDrawer && (
        <div className="flex flex-wrap items-center gap-4 p-4 bg-card rounded-xl shadow-md">
          {/* Tools */}
          <div className="flex gap-2">
            <Button
              variant={tool === 'brush' ? 'default' : 'outline'}
              size="icon"
              onClick={() => setTool('brush')}
            >
              <Paintbrush className="w-5 h-5" />
            </Button>
            <Button
              variant={tool === 'eraser' ? 'default' : 'outline'}
              size="icon"
              onClick={() => setTool('eraser')}
            >
              <Eraser className="w-5 h-5" />
            </Button>
            <Button
              variant={tool === 'fill' ? 'default' : 'outline'}
              size="icon"
              onClick={() => setTool('fill')}
            >
              <PaintBucket className="w-5 h-5" />
            </Button>
          </div>

          <div className="w-px h-8 bg-border" />

          {/* Colors */}
          <div className="flex flex-wrap gap-1.5">
            {DRAWING_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={cn(
                  "w-7 h-7 rounded-full border-2 transition-transform hover:scale-110",
                  color === c ? "border-primary ring-2 ring-primary/50 scale-110" : "border-muted"
                )}
                style={{ backgroundColor: c }}
                onClick={() => setColor(c)}
              />
            ))}
          </div>

          <div className="w-px h-8 bg-border" />

          {/* Brush sizes */}
          <div className="flex items-center gap-2">
            {BRUSH_SIZES.map((size) => (
              <button
                key={size}
                type="button"
                className={cn(
                  "flex items-center justify-center w-10 h-10 rounded-lg border-2 transition-all hover:scale-105",
                  brushSize === size ? "border-primary bg-primary/10" : "border-muted bg-background"
                )}
                onClick={() => setBrushSize(size)}
              >
                <div
                  className="rounded-full bg-foreground"
                  style={{ width: size, height: size }}
                />
              </button>
            ))}
          </div>

          <div className="w-px h-8 bg-border" />

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={undo}
              disabled={historyIndex <= 0}
            >
              <Undo2 className="w-5 h-5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={redo}
              disabled={historyIndex >= historyStack.length - 1}
            >
              <Redo2 className="w-5 h-5" />
            </Button>
            <Button
              variant="destructive"
              size="icon"
              onClick={clearCanvas}
            >
              <Trash2 className="w-5 h-5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
