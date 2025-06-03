import { useState } from "preact/hooks";

export function usePerformanceMonitoring() {
    const [navigationStats, setNavigationStats] = useState({
        totalNavigations: 0,
        averageTime: 0,
        lastNavigationTime: 0
    });

    return {
        navigationStats,
        setNavigationStats
    };
} 