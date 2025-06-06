import { useState, useEffect } from 'preact/hooks';
import { useFPSTracker } from '../hooks/useFPSTracker';

export function PerformanceDashboard({ benchmarkResults, navigationStats, serializationMode }) {
    const [isVisible, setIsVisible] = useState(false);
    const { fps, averageFps } = useFPSTracker();

    // Function to get FPS color based on performance
    const getFPSColor = (fpsValue) => {
        if (fpsValue >= 55) return '#00ff88'; // Green - Excellent
        if (fpsValue >= 45) return '#88ff00'; // Yellow-Green - Good
        if (fpsValue >= 30) return '#ffaa00'; // Orange - Fair
        return '#ff4444'; // Red - Poor
    };

    const getModeLabel = (mode) => {
        // Always return MessagePack Base64 since that's the only mode allowed
        return 'MessagePack (Base64) - FORCED';
    };

    if (!isVisible) {
        return (
            <button 
                className="performance-toggle"
                onClick={() => setIsVisible(true)}
                style={{
                    position: 'fixed',
                    bottom: '1rem',
                    right: '1rem',
                    background: 'rgba(0,0,0,0.7)',
                    color: 'white',
                    border: 'none',
                    padding: '0.5rem 1rem',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    zIndex: 1000,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                }}
            >
                📊 Performance
                <span style={{ 
                    color: getFPSColor(fps), 
                    fontWeight: 'bold',
                    fontSize: '0.75rem'
                }}>
                    {fps} FPS
                </span>
            </button>
        );
    }

    return (
        <div 
            className="performance-dashboard"
            style={{
                position: 'fixed',
                bottom: '1rem',
                right: '1rem',
                width: '350px',
                background: 'rgba(0,0,0,0.9)',
                color: 'white',
                padding: '1rem',
                borderRadius: '8px',
                fontSize: '0.8rem',
                zIndex: 1000,
                border: '1px solid rgba(255,255,255,0.2)',
                backdropFilter: 'blur(10px)'
            }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <h3 style={{ margin: 0, fontSize: '1rem' }}>⚡ Performance Monitor</h3>
                <button 
                    onClick={() => setIsVisible(false)}
                    style={{ 
                        background: 'rgba(255,255,255,0.1)', 
                        border: '1px solid rgba(255,255,255,0.2)', 
                        color: 'white', 
                        cursor: 'pointer',
                        borderRadius: '4px',
                        padding: '0.25rem 0.5rem',
                        fontSize: '0.75rem',
                        fontWeight: 'bold',
                        lineHeight: '1',
                        width: '24px',
                        height: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 150ms ease'
                    }}
                    onMouseEnter={(e) => {
                        e.target.style.background = 'rgba(255,255,255,0.2)';
                        e.target.style.borderColor = 'rgba(255,255,255,0.4)';
                    }}
                    onMouseLeave={(e) => {
                        e.target.style.background = 'rgba(255,255,255,0.1)';
                        e.target.style.borderColor = 'rgba(255,255,255,0.2)';
                    }}
                >
                    ✕
                </button>
            </div>

            {/* FPS Section - NEW */}
            <div className="perf-section" style={{ 
                marginBottom: '0.5rem',
                padding: '0.5rem',
                background: 'rgba(255,255,255,0.05)',
                borderRadius: '4px',
                border: `1px solid ${getFPSColor(fps)}40`
            }}>
                <div style={{ fontWeight: 'bold', marginBottom: '0.25rem', color: '#ffffff' }}>
                    🎮 Frame Rate:
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <span style={{ color: getFPSColor(fps), fontWeight: 'bold', fontSize: '1.2rem' }}>
                            {fps} FPS
                        </span>
                        <span style={{ color: '#aaa', marginLeft: '0.5rem', fontSize: '0.75rem' }}>
                            current
                        </span>
                    </div>
                    <div>
                        <span style={{ color: getFPSColor(averageFps), fontWeight: 'bold' }}>
                            {averageFps} FPS
                        </span>
                        <span style={{ color: '#aaa', marginLeft: '0.25rem', fontSize: '0.75rem' }}>
                            avg
                        </span>
                    </div>
                </div>
                <div style={{ 
                    marginTop: '0.25rem', 
                    fontSize: '0.7rem', 
                    color: '#aaa',
                    textAlign: 'center'
                }}>
                    {fps >= 55 ? '🚀 Excellent' : 
                     fps >= 45 ? '✅ Good' : 
                     fps >= 30 ? '⚠️ Fair' : '❌ Poor'} performance
                </div>
            </div>

            <div className="perf-section" style={{ marginBottom: '0.5rem' }}>
                <div style={{ fontWeight: 'bold', color: '#00ff88' }}>
                    📦 Mode: {getModeLabel(serializationMode)}
                </div>
            </div>

            {navigationStats && (
                <div className="perf-section" style={{ marginBottom: '0.5rem' }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>📈 Navigation Stats:</div>
                    <div>• Last navigation: {Math.round(navigationStats.lastNavigationTime)}ms</div>
                    <div>• Total navigations: {navigationStats.totalNavigations}</div>
                    {navigationStats.averageTime && (
                        <div>• Average time: {Math.round(navigationStats.averageTime)}ms</div>
                    )}
                </div>
            )}

            {benchmarkResults && (
                <div className="perf-section">
                    <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>🏆 Last Benchmark:</div>
                    <div>• Path: {benchmarkResults.path}</div>
                    <div>• Files: {benchmarkResults.files_count}, Dirs: {benchmarkResults.dirs_count}</div>
                    {benchmarkResults.sizes && (
                        <>
                            <div>• MessagePack: {benchmarkResults.sizes.msgpack} bytes</div>
                            <div>• vs JSON: {benchmarkResults.sizes.json} bytes (comparison)</div>
                        </>
                    )}
                    {benchmarkResults.size_reduction_percent && (
                        <div style={{ color: '#00ff88', fontWeight: 'bold' }}>
                            • {Math.round(benchmarkResults.size_reduction_percent)}% smaller than JSON! 🎯
                        </div>
                    )}
                </div>
            )}


        </div>
    );
} 