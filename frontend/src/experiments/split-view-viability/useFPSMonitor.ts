import { useEffect, useRef, useState } from 'react';

export const useFPSMonitor = (isActive: boolean = true) => {
  const [fps, setFps] = useState(0);
  const frameTimesRef = useRef<number[]>([]);
  const lastTimeRef = useRef(performance.now());

  useEffect(() => {
    if (!isActive) {
      setFps(0);
      return;
    }

    let animationId: number;

    const measureFPS = (currentTime: number) => {
      // Calculate time since last frame
      const deltaTime = currentTime - lastTimeRef.current;
      lastTimeRef.current = currentTime;

      // Store frame time
      frameTimesRef.current.push(deltaTime);

      // Keep only last 60 frames for rolling average
      if (frameTimesRef.current.length > 60) {
        frameTimesRef.current.shift();
      }

      // Calculate FPS every 30 frames
      if (frameTimesRef.current.length >= 30) {
        const averageFrameTime = frameTimesRef.current.reduce((a, b) => a + b) / frameTimesRef.current.length;
        const currentFps = Math.round(1000 / averageFrameTime);
        setFps(currentFps);
      }

      animationId = requestAnimationFrame(measureFPS);
    };

    // Reset and start
    frameTimesRef.current = [];
    lastTimeRef.current = performance.now();
    animationId = requestAnimationFrame(measureFPS);

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [isActive]);

  return fps;
};

// Alternative approach using Chrome's Frame Timing API if available
export const useAdvancedFPSMonitor = (isActive: boolean = true) => {
  const [fps, setFps] = useState(0);
  const observerRef = useRef<PerformanceObserver | null>(null);

  useEffect(() => {
    if (!isActive) {
      setFps(0);
      return;
    }

    // Check if PerformanceObserver is available
    if ('PerformanceObserver' in window) {
      try {
        const frameTimes: number[] = [];
        let lastTime = performance.now();

        observerRef.current = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry) => {
            if (entry.entryType === 'measure' || entry.entryType === 'paint') {
              const currentTime = entry.startTime;
              const deltaTime = currentTime - lastTime;
              lastTime = currentTime;

              frameTimes.push(deltaTime);
              if (frameTimes.length > 60) frameTimes.shift();

              if (frameTimes.length >= 30) {
                const avgFrameTime = frameTimes.reduce((a, b) => a + b) / frameTimes.length;
                setFps(Math.round(1000 / avgFrameTime));
              }
            }
          });
        });

        // Observe paint entries
        observerRef.current.observe({ entryTypes: ['paint', 'measure'] });
      } catch (e) {
        console.warn('PerformanceObserver not fully supported, falling back to rAF');
      }
    }

    // Fallback to requestAnimationFrame
    if (!observerRef.current) {
      let animationId: number;
      const frameTimes: number[] = [];
      let lastTime = performance.now();

      const measure = (currentTime: number) => {
        const deltaTime = currentTime - lastTime;
        lastTime = currentTime;

        frameTimes.push(deltaTime);
        if (frameTimes.length > 60) frameTimes.shift();

        if (frameTimes.length >= 30) {
          const avgFrameTime = frameTimes.reduce((a, b) => a + b) / frameTimes.length;
          setFps(Math.round(1000 / avgFrameTime));
        }

        animationId = requestAnimationFrame(measure);
      };

      animationId = requestAnimationFrame(measure);

      return () => cancelAnimationFrame(animationId);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
    };
  }, [isActive]);

  return fps;
};

// Simple stats.js-like approach
export const useFPSStats = () => {
  const [fps, setFps] = useState(0);
  const [isMonitoring, setIsMonitoring] = useState(false);
  
  useEffect(() => {
    if (!isMonitoring) return;

    let frames = 0;
    let lastTime = performance.now();
    let animationId: number;

    const tick = () => {
      frames++;
      const currentTime = performance.now();
      
      if (currentTime >= lastTime + 1000) {
        setFps(Math.round((frames * 1000) / (currentTime - lastTime)));
        frames = 0;
        lastTime = currentTime;
      }
      
      animationId = requestAnimationFrame(tick);
    };

    animationId = requestAnimationFrame(tick);

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [isMonitoring]);

  return { fps, startMonitoring: () => setIsMonitoring(true), stopMonitoring: () => setIsMonitoring(false) };
};