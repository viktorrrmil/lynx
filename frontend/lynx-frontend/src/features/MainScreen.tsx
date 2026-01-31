import React, {useState} from 'react';
import type {IndexResults} from "../types/types.ts";
import ResultsColumn from "./results/ResultColumn.tsx";
import UploadSection from "./UploadSection.tsx";

// TODO: Finish simplifying the frontend
const MainScreen = () => {
    const [loading, setLoading] = useState(false);
    const [query, setQuery] = useState('');
    const [bfResults, setBfResults] = useState<IndexResults>({results: [], searchTime: null});
    const [ivfResults, setIvfResults] = useState<IndexResults>({results: [], searchTime: null});
    const [ivfTrained, setIvfTrained] = useState(false);
    const [k, setK] = useState(10);

    const handleSearch = async () => {
        if (!query.trim()) return;

        setLoading(true);

        try {
            // Search both indexes in parallel
            const [bfResponse] = await Promise.all([
                fetch('http://localhost:8080/bf_search', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({query, top_k: k}),
                }),
                // ivfTrained ? fetch('http://localhost:8080/ivf_search', {
                //     method: 'POST',
                //     headers: {'Content-Type': 'application/json'},
                //     body: JSON.stringify({query, top_k: k}),
                // }) : null
            ]);

            if (bfResponse.ok) {
                const data = await bfResponse.json();
                setBfResults({
                    results: data.results || [],
                    searchTime: data.search_time_ms
                });
            }

            // if (ivfResponse && ivfResponse.ok) {
            //     const data = await ivfResponse.json();
            //     setIvfResults({
            //         results: data.results || [],
            //         searchTime: data.search_time_ms
            //     });
            // }
        } catch (error) {
            console.error('Search error:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-white">
            <div className="max-w-7xl mx-auto px-6 py-8">
                {/* Header */}
                <div className="mb-12">
                    <h1 className="text-2xl font-light tracking-tight text-gray-900">
                        Lynx - Vector Search Engine
                    </h1>
                    <p className="text-sm text-gray-500 mt-2">
                        Compare BruteForce vs IVF index performance
                    </p>
                </div>

                {/* Upload Section */}
                <UploadSection
                    loading={loading}
                    setLoading={setLoading}
                    ivfTrained={ivfTrained}
                    setIvfTrained={setIvfTrained}
                />

                {/* Search Section */}
                <div>
                    <h2 className="text-sm font-medium text-gray-900 mb-4">
                        Search Both Indexes
                    </h2>
                    <div className="space-y-6">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                placeholder="Enter search query..."
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                                className="flex-1 px-4 py-2 text-sm border border-gray-300 rounded
                                     focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900"
                            />
                            <input
                                type="number"
                                min={1}
                                max={1000}
                                value={k}
                                onChange={(e) => setK(Number(e.target.value))}
                                className="w-24 px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900"
                            />
                            <button
                                onClick={handleSearch}
                                disabled={loading}
                                className="px-6 py-2 text-sm font-medium text-white bg-gray-900
                                     rounded hover:bg-gray-800 disabled:bg-gray-300
                                     disabled:cursor-not-allowed transition-colors"
                            >
                                {loading ? 'Searching...' : 'Search Both'}
                            </button>
                        </div>

                        {/* Performance Summary */}
                        {(bfResults.searchTime !== null && bfResults.searchTime !== undefined && bfResults.searchTime === 0)
                            && (ivfResults.searchTime !== null && ivfResults.searchTime !== undefined && ivfResults.searchTime === 0) && (
                                <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                                    <p className="text-sm text-gray-900">
                                        Both indexes returned results instantly. No performance difference to report.
                                    </p>
                                </div>
                            )}

                        {(bfResults.searchTime !== null && bfResults.searchTime !== undefined && bfResults.searchTime !== 0)
                            && (ivfResults.searchTime !== null && ivfResults.searchTime !== undefined && ivfResults.searchTime !== 0) && (
                                <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                                    <p className="text-sm text-gray-900">
                                        <span className="font-medium">Performance:</span> IVF is{' '}
                                        <span className="font-mono font-medium">
                                             {(bfResults.searchTime / ivfResults.searchTime).toFixed(2)}x
                                        </span>
                                        {' '}{bfResults.searchTime > ivfResults.searchTime ? 'faster' : 'slower'} than
                                        BruteForce
                                    </p>
                                </div>
                            )}

                        {/* Side by Side Results */}
                        <div className="flex gap-6">
                            <ResultsColumn
                                query={query}
                                title="BruteForce Index"
                                results={bfResults.results}
                                searchTime={bfResults.searchTime}
                            />
                            <ResultsColumn
                                query={query}
                                title="IVF Index"
                                results={ivfResults.results}
                                searchTime={ivfResults.searchTime}
                                trained={ivfTrained}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default MainScreen;