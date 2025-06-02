import { useState, useEffect } from "preact/hooks";
import { GetCacheStats } from "../../wailsjs/go/backend/App";
import { navCache } from "../services/NavigationService";

export function usePerformanceMonitoring() {
    const [navigationStats, setNavigationStats] = useState({
        totalNavigations: 0,
        cacheHits: 0,
        averageTime: 0
    });

    // Performance monitoring
    useEffect(() => {
        const interval = setInterval(async () => {
            try {
                const [frontendStats, backendStats] = await Promise.all([
                    Promise.resolve(navCache.getStats()),
                    GetCacheStats()
                ]);
                console.log('📊 Performance Stats:', {
                    frontend: frontendStats,
                    backend: backendStats,
                    navigation: navigationStats
                });
            } catch (err) {
                console.log('Stats collection failed:', err);
            }
        }, 30000); // Every 30 seconds

        return () => clearInterval(interval);
    }, [navigationStats]);

    return {
        navigationStats,
        setNavigationStats
    };
} 