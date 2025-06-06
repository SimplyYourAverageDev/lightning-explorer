import { useState } from "preact/hooks";

export function usePerformanceMonitoring() {
    const [navigationStats, setNavigationStats] = useState({
        totalNavigations: 0,
        averageTime: 0,
        lastNavigationTime: 0
    });

    const safeSetNavigationStats = (updater) => {
        setNavigationStats(prev => {
            // Ensure prev is always a valid object
            const safePrev = (prev && typeof prev === 'object') ? prev : {
                totalNavigations: 0,
                averageTime: 0,
                lastNavigationTime: 0
            };
            
            const newStats = typeof updater === 'function' ? updater(safePrev) : updater;
            
            // Ensure the result is a valid object with numeric values
            return {
                totalNavigations: Number(newStats?.totalNavigations) || 0,
                averageTime: Number(newStats?.averageTime) || 0,
                lastNavigationTime: Number(newStats?.lastNavigationTime) || 0,
                ...newStats
            };
        });
    };

    return {
        navigationStats,
        setNavigationStats: safeSetNavigationStats
    };
} 