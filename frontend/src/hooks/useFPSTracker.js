import { useState, useEffect, useRef } from 'preact/hooks';

export function useFPSTracker() {
    const [fps, setFps] = useState(0);
    const [averageFps, setAverageFps] = useState(0);
    const frameRef = useRef(0);
    const lastTimeRef = useRef(performance.now());
    const fpsHistoryRef = useRef([]);
    const maxHistoryLength = 60; // Keep 60 samples for averaging

    useEffect(() => {
        let animationId;

        const updateFPS = (currentTime) => {
            const deltaTime = currentTime - lastTimeRef.current;
            
            if (deltaTime >= 1000) { // Update every second
                const currentFps = Math.round((frameRef.current * 1000) / deltaTime);
                
                // Update current FPS
                setFps(currentFps);
                
                // Update FPS history for averaging
                fpsHistoryRef.current.push(currentFps);
                if (fpsHistoryRef.current.length > maxHistoryLength) {
                    fpsHistoryRef.current.shift();
                }
                
                // Calculate average FPS
                const sum = fpsHistoryRef.current.reduce((a, b) => a + b, 0);
                const avg = Math.round(sum / fpsHistoryRef.current.length);
                setAverageFps(avg);
                
                // Reset counters
                frameRef.current = 0;
                lastTimeRef.current = currentTime;
            }
            
            frameRef.current++;
            animationId = requestAnimationFrame(updateFPS);
        };

        animationId = requestAnimationFrame(updateFPS);

        return () => {
            if (animationId) {
                cancelAnimationFrame(animationId);
            }
        };
    }, []);

    return { fps, averageFps };
} 