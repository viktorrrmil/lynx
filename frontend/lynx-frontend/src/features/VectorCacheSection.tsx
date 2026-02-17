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
                className={`px-3 py-1.5 text-xs font-medium rounded border transition-colors ${
                    isExpanded
                        ? 'bg-gray-900 text-white border-gray-900 hover:bg-gray-800'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
            >
                <span className={`transition-all duration-200 ${
                    isExpanded ? 'text-slate-50' : 'text-slate-800'
                }`}>Vector Cache</span>
            </button>

            {/* Expanded Content - Floats absolutely */}
            <div
                className={`absolute bg-gray-50 right-0 top-full mt-2 w-64 z-50 overflow-hidden transition-all shadow-xl duration-300 ease-in-out ${
                    isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                }`}
            >
                <div className="border border-slate-200 rounded-lg bg-gradient-to-br from-slate-50 to-blue-50/30 shadow-lg">
                    <div className="px-4 pb-4 pt-4">
                        {/* Action Buttons */}
                        <div className="flex flex-col space-y-2 mb-3">
                            <button
                                onClick={handleSaveEmbeddings}
                                disabled={loading}
                                className="px-3 py-1.5 text-xs border rounded bg-white hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Save Embeddings
                            </button>
                            <button
                                onClick={handleLoadEmbeddings}
                                disabled={loading}
                                className="px-3 py-1.5 text-xs border rounded bg-white hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Load Embeddings
                            </button>
                            <button
                                onClick={handleGetCacheInfo}
                                disabled={loading}
                                className="px-3 py-1.5 text-xs border rounded bg-white hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Get Cache Info
                            </button>
                        </div>

                        {/* Message Display */}
                        {message && (
                            <div className={`text-xs p-2 rounded mb-2 ${
                                message.includes('success') 
                                    ? 'bg-green-50 text-green-800 border border-green-200' 
                                    : 'bg-red-50 text-red-800 border border-red-200'
                            }`}>
                                {message}
                            </div>
                        )}

                        {/* Cache Info Display */}
                        {cacheInfo && (
                            <div className="flex flex-col space-y-2 text-xs text-slate-600 pt-2 border-t border-slate-200">
                                <div className="flex items-center justify-between">
                                    <span className="text-slate-700">Size:</span>
                                    <span className="px-2 py-0.5 bg-blue-50 rounded border border-blue-200 text-blue-900">
                                        {cacheInfo.count}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-slate-700">Dimension:</span>
                                    <span className="px-2 py-0.5 bg-indigo-50 rounded border border-indigo-200 text-indigo-900">
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
