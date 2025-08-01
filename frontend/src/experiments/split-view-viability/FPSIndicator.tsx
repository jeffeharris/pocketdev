import React, { useEffect, useRef, useState } from 'react';

interface FPSIndicatorProps {
  onFPSUpdate?: (fps: number) => void;
  visible?: boolean;
}

export const FPSIndicator: React.FC<FPSIndicatorProps> = ({ onFPSUpdate, visible = true }) => {
  const [localFPS, setLocalFPS] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const frameTimesRef = useRef<number[]>([]);
  const lastTimeRef = useRef(performance.now());

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frameCount = 0;
    let lastFPSUpdate = performance.now();

    const draw = (currentTime: number) => {
      // Calculate frame time
      const deltaTime = currentTime - lastTimeRef.current;
      lastTimeRef.current = currentTime;
      frameCount++;

      // Store frame times for averaging
      frameTimesRef.current.push(deltaTime);
      if (frameTimesRef.current.length > 60) {
        frameTimesRef.current.shift();
      }

      // Update FPS every 500ms
      if (currentTime - lastFPSUpdate >= 500) {
        const avgFrameTime = frameTimesRef.current.reduce((a, b) => a + b, 0) / frameTimesRef.current.length;
        const fps = Math.round(1000 / avgFrameTime);
        setLocalFPS(fps);
        onFPSUpdate?.(fps);
        lastFPSUpdate = currentTime;
      }

      // Force a visual update to ensure we're actually rendering
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw FPS counter
      ctx.fillStyle = localFPS < 30 ? '#ff4444' : localFPS < 60 ? '#ffaa00' : '#44ff44';
      ctx.font = '14px monospace';
      ctx.fillText(`FPS: ${localFPS}`, 5, 20);

      // Draw a moving indicator to force repaints
      const x = (frameCount % 100) * (canvas.width / 100);
      ctx.fillStyle = '#3b82f6';
      ctx.fillRect(x, canvas.height - 5, 5, 5);

      animationRef.current = requestAnimationFrame(draw);
    };

    // Start the animation loop
    frameTimesRef.current = [];
    lastTimeRef.current = performance.now();
    animationRef.current = requestAnimationFrame(draw);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [onFPSUpdate]);

  if (!visible) return null;

  return (
    <canvas
      ref={canvasRef}
      width={100}
      height={30}
      style={{
        position: 'fixed',
        top: 10,
        right: 10,
        backgroundColor: '#1a1a1a',
        border: '1px solid #333',
        borderRadius: 4,
        zIndex: 9999,
      }}
    />
  );
};

// Alternative approach using stats.js style monitoring
export const usePerformanceMonitor = () => {
  const [stats, setStats] = useState({
    fps: 0,
    ms: 0,
    memory: 0,
  });

  useEffect(() => {
    let frameCount = 0;
    let lastTime = performance.now();
    let lastFPSUpdate = lastTime;
    let animationId: number;

    const beginTime = performance.now();
    const prevTime = beginTime;

    const update = () => {
      const currentTime = performance.now();
      const delta = currentTime - lastTime;
      lastTime = currentTime;
      frameCount++;

      // Update stats every second
      if (currentTime - lastFPSUpdate >= 1000) {
        const fps = Math.round((frameCount * 1000) / (currentTime - lastFPSUpdate));
        const ms = delta;
        
        let memory = 0;
        if ('memory' in performance) {
          memory = Math.round((performance as any).memory.usedJSHeapSize / 1048576);
        }

        setStats({ fps, ms, memory });
        
        frameCount = 0;
        lastFPSUpdate = currentTime;
      }

      animationId = requestAnimationFrame(update);
    };

    animationId = requestAnimationFrame(update);

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, []);

  return stats;
};