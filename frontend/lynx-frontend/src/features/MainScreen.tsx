import {useState} from 'react';
import type {IndexResults} from "../types/types.ts";
import ResultsColumn from "./results/ResultColumn.tsx";
import UploadSection from "./UploadSection.tsx";
import InfoScreen from "./InfoScreen.tsx";
import VectorCacheSection from "./VectorCacheSection.tsx";

const MainScreen = () => {
    const [loading, setLoading] = useState(false);
    const [query, setQuery] = useState('');
    const [bfResults, setBfResults] = useState<IndexResults>({results: [], searchTime: null});
    const [ivfResults, setIvfResults] = useState<IndexResults>({results: [], searchTime: null});
    const [k, setK] = useState(10);
    const [bfActive, setBfActive] = useState(true);
    const [ivfActive, setIvfActive] = useState(true);

    const handleSearch = async () => {
        if (!query.trim()) return;
        if (!bfActive && !ivfActive) return; // Don't search if no indexes are active

        setLoading(true);

        try {
            const promises = [];

            // Only add fetch promises for active indexes
            if (bfActive) {
                promises.push(
                    fetch('http://localhost:8080/bf_search', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({query, top_k: k}),
                    })
                );
            } else {
                promises.push(null);
            }

            if (ivfActive) {
                promises.push(
                    fetch('http://localhost:8080/ivf_search', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({query, top_k: k}),
                    })
                );
            } else {
                promises.push(null);
            }

            const [bfResponse, ivfResponse] = await Promise.all(promises);

            if (bfResponse && bfResponse.ok) {
                const data = await bfResponse.json();
                setBfResults({
                    results: data.results || [],
                    searchTime: data.search_time_ms
                });
            } else if (!bfActive) {
                // Clear results if index is not active
                setBfResults({results: [], searchTime: null});
            }

            if (ivfResponse && ivfResponse.ok) {
                const data = await ivfResponse.json();
                setIvfResults({
                    results: data.results || [],
                    searchTime: data.search_time_ms
                });
            } else if (!ivfActive) {
                // Clear results if index is not active
                setIvfResults({results: [], searchTime: null});
            }
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
                <div className="flex w-full justify-between mb-12 items-stretch gap-4">
                    <div className="">
                        <h1 className="text-2xl font-light tracking-tight text-gray-900">
                            Lynx - Vector Search Engine
                        </h1>
                        <p className="text-sm text-gray-500 mt-2">
                            Compare BruteForce vs IVF index performance
                        </p>
                    </div>
                    <VectorCacheSection />
                </div>


                {/* Upload Section */}
                <div className="flex w-full justify-center mb-12 items-stretch gap-4">
                    <div className="flex-1">
                        <UploadSection loading={loading} setLoading={setLoading} />
                    </div>
                    <div className="flex-1">
                        <InfoScreen />
                    </div>
                </div>


                {/* Search Section */}
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-sm font-medium text-gray-900">
                            {bfActive && ivfActive ? 'Search Both Indexes' :
                             bfActive ? 'Search BruteForce Index' :
                             ivfActive ? 'Search IVF Index' : 'Search Indexes'}
                        </h2>

                        {/* Index Toggle Buttons */}
                        <div className="flex gap-2">
                            <button
                                onClick={() => setBfActive(!bfActive)}
                                className={`px-3 py-1.5 text-xs font-medium rounded border transition-colors ${
                                    bfActive
                                        ? 'bg-gray-900 text-white border-gray-900 hover:bg-gray-800'
                                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                }`}
                            >
                                BruteForce {bfActive ? '✓' : '○'}
                            </button>
                            <button
                                onClick={() => setIvfActive(!ivfActive)}
                                className={`px-3 py-1.5 text-xs font-medium rounded border transition-colors ${
                                    ivfActive
                                        ? 'bg-gray-900 text-white border-gray-900 hover:bg-gray-800'
                                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                }`}
                            >
                                IVF {ivfActive ? '✓' : '○'}
                            </button>
                        </div>
                    </div>
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
                                disabled={loading || (!bfActive && !ivfActive)}
                                className="px-6 py-2 text-sm font-medium text-white bg-gray-900
                                     rounded hover:bg-gray-800 disabled:bg-gray-300
                                     disabled:cursor-not-allowed transition-colors"
                            >
                                {loading ? 'Searching...' :
                                 !bfActive && !ivfActive ? 'Select Index' :
                                 bfActive && ivfActive ? 'Search Both' :
                                 bfActive ? 'Search BF' : 'Search IVF'}
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
                            {bfActive && (
                                <ResultsColumn
                                    query={query}
                                    title="BruteForce Index"
                                    results={bfResults.results}
                                    searchTime={bfResults.searchTime}
                                />
                            )}
                            {ivfActive && (
                                <ResultsColumn
                                    query={query}
                                    title="IVF Index"
                                    results={ivfResults.results}
                                    searchTime={ivfResults.searchTime}
                                />
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default MainScreen;