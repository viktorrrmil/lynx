import { useState } from 'react';

const VectorCacheSection = () => {
    const [isExpanded, setIsExpanded] = useState<boolean>(false);
    const [cacheInfo, setCacheInfo] = useState<{ count: number; dimension: number } | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [message, setMessage] = useState<string>('');

    const handleSaveEmbeddings = async () => {
        setLoading(true);
        setMessage('');
        try {
            const response = await fetch('http://localhost:8080/vector_cache/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });
            if (response.ok) {
                setMessage('Embeddings saved successfully!');
            } else {
                setMessage('Failed to save embeddings');
            }
        } catch (error) {
            console.error('Error saving embeddings:', error);
            setMessage('Error saving embeddings');
        } finally {
            setLoading(false);
        }
    };

    const handleLoadEmbeddings = async () => {
        setLoading(true);
        setMessage('');
        try {
            const response = await fetch('http://localhost:8080/vector_cache/load', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });
            if (response.ok) {
                setMessage('Embeddings loaded successfully!');
            } else {
                setMessage('Failed to load embeddings');
            }
        } catch (error) {
            console.error('Error loading embeddings:', error);
            setMessage('Error loading embeddings');
        } finally {
            setLoading(false);
        }
    };

    const handleGetCacheInfo = async () => {
        setLoading(true);
        setMessage('');
        try {
            const response = await fetch('http://localhost:8080/vector_cache/info');
            if (response.ok) {
                const data = await response.json();
                setCacheInfo({ count: data.count, dimension: data.dimension });
                setMessage('');
            } else {
                setMessage('Failed to fetch cache info');
            }
        } catch (error) {
            console.error('Error fetching cache info:', error);
            setMessage('Error fetching cache info');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="relative">
            {/* Header Button - Always Visible */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className={`cli-button font-mono flex items-center gap-2 ${
                    isExpanded ? 'bg-slate-900 text-white border-slate-900 hover:bg-slate-800' : ''
                }`}
            >
                <span className={`transition-all duration-200 ${
                    isExpanded ? 'text-slate-50' : 'text-slate-800'
                }`}>Vector Cache</span>
                <span className="px-1.5 py-0.5 rounded-full text-[10px] uppercase tracking-[0.18em] bg-amber-100 text-amber-700 border border-amber-200">
                    Stale
                </span>
            </button>

            {/* Expanded Content - Floats absolutely */}
            <div
                className={`absolute right-0 top-full mt-2 w-72 z-50 overflow-hidden transition-all duration-300 ease-in-out ${
                    isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                }`}
            >
                <div className="cli-panel-strong">
                    <div className="px-4 pb-4 pt-4 space-y-3">
                        <p className="text-[11px] text-amber-700 font-mono bg-amber-50 border border-amber-200 rounded px-2 py-1">
                            Cache may be slightly outdated. Reload after ingest.
                        </p>
                        {/* Action Buttons */}
                        <div className="flex flex-col space-y-2">
                            <button
                                onClick={handleSaveEmbeddings}
                                disabled={loading}
                                className="cli-button font-mono disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Save Embeddings
                            </button>
                            <button
                                onClick={handleLoadEmbeddings}
                                disabled={loading}
                                className="cli-button font-mono disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Load Embeddings
                            </button>
                            <button
                                onClick={handleGetCacheInfo}
                                disabled={loading}
                                className="cli-button font-mono disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Get Cache Info
                            </button>
                        </div>

                        {/* Message Display */}
                        {message && (
                            <div className={`text-xs p-2 rounded mb-2 ${
                                message.includes('success') 
                                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                            }`}>
                                {message}
                            </div>
                        )}

                        {/* Cache Info Display */}
                        {cacheInfo && (
                            <div className="flex flex-col space-y-2 text-xs text-slate-600 pt-2 border-t border-slate-200">
                                <div className="flex items-center justify-between">
                                    <span className="text-slate-700 font-mono">Size</span>
                                    <span className="px-2 py-0.5 bg-slate-900 rounded border border-slate-900 text-slate-50 font-mono">
                                        {cacheInfo.count}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-slate-700 font-mono">Dimension</span>
                                    <span className="px-2 py-0.5 bg-indigo-600 rounded border border-indigo-600 text-white font-mono">
                                        {cacheInfo.dimension}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VectorCacheSection;
