import {useState} from 'react';
import type {IndexResults} from "../types/types.ts";
import ResultsColumn from "./results/ResultColumn.tsx";
import UploadSection from "./UploadSection.tsx";
import InfoScreen from "./InfoScreen.tsx";
import VectorCacheSection from "./VectorCacheSection.tsx";
import { IndexStatusPanel, IndexStatusToggle, IndexBuildingStatus } from "./IndexStatusPanel.tsx";
import BenchmarkSection from "./BenchmarkSection.tsx";

type AppMode = 'search' | 'benchmark';

const MainScreen = () => {
    const [loading, setLoading] = useState(false);
    const [query, setQuery] = useState('');
    const [bfResults, setBfResults] = useState<IndexResults>({results: [], searchTime: null});
    const [ivfResults, setIvfResults] = useState<IndexResults>({results: [], searchTime: null});
    const [ivfPqResults, setIvfPqResults] = useState<IndexResults>({results: [], searchTime: null});
    const [hnswResults, setHnswResults] = useState<IndexResults>({results: [], searchTime: null});
    const [k, setK] = useState(10);
    const [bfActive, setBfActive] = useState(true);
    const [ivfActive, setIvfActive] = useState(true);
    const [ivfPqActive, setIvfPqActive] = useState(true);
    const [hnswActive, setHnswActive] = useState(true);
    const [ivfTrackRecall, setIvfTrackRecall] = useState(false);
    const [ivfPqTrackRecall, setIvfPqTrackRecall] = useState(false);
    const [hnswTrackRecall, setHnswTrackRecall] = useState(false);
    const [indexStatusExpanded, setIndexStatusExpanded] = useState(false);
    const [indexesReady, setIndexesReady] = useState(false);
    const [appMode, setAppMode] = useState<AppMode>('search');
    const [modeDropdownOpen, setModeDropdownOpen] = useState(false);

    const handleSearch = async () => {
        if (!query.trim()) return;
        if (!bfActive && !ivfActive && !ivfPqActive && !hnswActive) return; // Don't search if no indexes are active

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
                        body: JSON.stringify({query, top_k: k, track_recall: ivfTrackRecall}),
                    })
                );
            } else {
                promises.push(null);
            }

            if (ivfPqActive) {
                promises.push(
                    fetch('http://localhost:8080/ivf_pq_search', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({query, top_k: k, track_recall: ivfPqTrackRecall}),
                    })
                );
            } else {
                promises.push(null);
            }

            if (hnswActive) {
                promises.push(
                    fetch('http://localhost:8080/hnsw_search', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({query, top_k: k, track_recall: hnswTrackRecall}),
                    })
                );
            } else {
                promises.push(null);
            }

            const [bfResponse, ivfResponse, ivfPqResponse, hnswResponse] = await Promise.all(promises);

            if (bfResponse && bfResponse.ok) {
                const data = await bfResponse.json();
                setBfResults({
                    results: data.results || [],
                    searchTime: data.search_time_ns
                });
            } else if (!bfActive) {
                // Clear results if index is not active
                setBfResults({results: [], searchTime: null});
            }

            if (ivfResponse && ivfResponse.ok) {
                const data = await ivfResponse.json();
                setIvfResults({
                    results: data.results || [],
                    searchTime: data.search_time_ns,
                    recall: data.recall !== undefined ? data.recall : undefined
                });
            } else if (!ivfActive) {
                // Clear results if index is not active
                setIvfResults({results: [], searchTime: null});
            }

            if (ivfPqResponse && ivfPqResponse.ok) {
                const data = await ivfPqResponse.json();
                setIvfPqResults({
                    results: data.results || [],
                    searchTime: data.search_time_ns,
                    recall: data.recall !== undefined ? data.recall : undefined
                });
            } else if (!ivfPqActive) {
                // Clear results if index is not active
                setIvfPqResults({results: [], searchTime: null});
            }

            if (hnswResponse && hnswResponse.ok) {
                const data = await hnswResponse.json();
                setHnswResults({
                    results: data.results || [],
                    searchTime: data.search_time_ns,
                    recall: data.recall !== undefined ? data.recall : undefined
                });
            } else if (!hnswActive) {
                // Clear results if index is not active
                setHnswResults({results: [], searchTime: null});
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
                <div className="flex w-full justify-between mb-6 items-stretch gap-4">
                    <div className="flex items-center gap-6">
                        <div>
                            <h1 className="text-2xl font-light tracking-tight text-gray-900">
                                Lynx - Vector Search Engine
                            </h1>
                            <p className="text-sm text-gray-500 mt-2">
                                Compare BruteForce vs IVF index performance
                            </p>
                        </div>

                        {/* Mode Dropdown */}
                        <div className="relative">
                            <button
                                onClick={() => setModeDropdownOpen(!modeDropdownOpen)}
                                className="flex items-center gap-2 px-4 py-2 text-sm border border-gray-300 rounded bg-white hover:bg-gray-50 transition-colors"
                            >
                                <span className={`w-2 h-2 rounded-full ${appMode === 'search' ? 'bg-green-500' : 'bg-blue-500'}`} />
                                {appMode === 'search' ? 'Search Mode' : 'Benchmark Mode'}
                                <span className="text-gray-400">{modeDropdownOpen ? '▲' : '▼'}</span>
                            </button>

                            {modeDropdownOpen && (
                                <div className="absolute top-full left-0 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                                    <button
                                        onClick={() => {
                                            setAppMode('search');
                                            setModeDropdownOpen(false);
                                        }}
                                        className={`w-full flex items-center gap-2 px-4 py-2 text-sm text-left hover:bg-gray-50 transition-colors rounded-t-lg ${
                                            appMode === 'search' ? 'bg-gray-50' : ''
                                        }`}
                                    >
                                        <span className="w-2 h-2 rounded-full bg-green-500" />
                                        Search
                                        {appMode === 'search' && <span className="ml-auto text-gray-400">✓</span>}
                                    </button>
                                    <button
                                        onClick={() => {
                                            setAppMode('benchmark');
                                            setModeDropdownOpen(false);
                                        }}
                                        className={`w-full flex items-center gap-2 px-4 py-2 text-sm text-left hover:bg-gray-50 transition-colors rounded-b-lg ${
                                            appMode === 'benchmark' ? 'bg-gray-50' : ''
                                        }`}
                                    >
                                        <span className="w-2 h-2 rounded-full bg-blue-500" />
                                        Benchmark
                                        {appMode === 'benchmark' && <span className="ml-auto text-gray-400">✓</span>}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <IndexStatusToggle
                            isExpanded={indexStatusExpanded}
                            onToggle={() => setIndexStatusExpanded(!indexStatusExpanded)}
                        />
                        <VectorCacheSection />
                    </div>
                </div>

                {/* Index Status Panel */}
                <IndexStatusPanel isExpanded={indexStatusExpanded} />

                {/* Index Building Status - shows when indexes are being built */}
                {!indexesReady && (
                    <IndexBuildingStatus onReady={() => setIndexesReady(true)} />
                )}

                {/* Search Mode Content */}
                {appMode === 'search' && (
                    <>
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
                            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                                <h2 className="text-sm font-medium text-gray-900">
                                    Search Active Indexes
                                </h2>

                                {/* Index Toggle Buttons */}
                                <div className="flex gap-2 flex-wrap">
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
                                    {ivfActive && (
                                        <button
                                            onClick={() => setIvfTrackRecall(!ivfTrackRecall)}
                                            className={`px-3 py-1.5 text-xs font-medium rounded border transition-colors ${
                                                ivfTrackRecall
                                                    ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
                                                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                            }`}
                                            title="Track IVF Recall@k"
                                        >
                                            IVF Recall {ivfTrackRecall ? '✓' : '○'}
                                        </button>
                                    )}
                                    <button
                                        onClick={() => setIvfPqActive(!ivfPqActive)}
                                        className={`px-3 py-1.5 text-xs font-medium rounded border transition-colors ${
                                            ivfPqActive
                                                ? 'bg-gray-900 text-white border-gray-900 hover:bg-gray-800'
                                                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                        }`}
                                    >
                                        IVF-PQ {ivfPqActive ? '✓' : '○'}
                                    </button>
                                    {ivfPqActive && (
                                        <button
                                            onClick={() => setIvfPqTrackRecall(!ivfPqTrackRecall)}
                                            className={`px-3 py-1.5 text-xs font-medium rounded border transition-colors ${
                                                ivfPqTrackRecall
                                                    ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
                                                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                            }`}
                                            title="Track IVF-PQ Recall@k"
                                        >
                                            PQ Recall {ivfPqTrackRecall ? '✓' : '○'}
                                        </button>
                                    )}
                                    <button
                                        onClick={() => setHnswActive(!hnswActive)}
                                        className={`px-3 py-1.5 text-xs font-medium rounded border transition-colors ${
                                            hnswActive
                                                ? 'bg-gray-900 text-white border-gray-900 hover:bg-gray-800'
                                                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                        }`}
                                    >
                                        HNSW {hnswActive ? '✓' : '○'}
                                    </button>
                                    {hnswActive && (
                                        <button
                                            onClick={() => setHnswTrackRecall(!hnswTrackRecall)}
                                            className={`px-3 py-1.5 text-xs font-medium rounded border transition-colors ${
                                                hnswTrackRecall
                                                    ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
                                                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                            }`}
                                            title="Track HNSW Recall@k"
                                        >
                                            HNSW Recall {hnswTrackRecall ? '✓' : '○'}
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div className="space-y-6">
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        placeholder="Enter search query..."
                                        value={query}
                                        onChange={(e) => setQuery(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
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
                                        disabled={loading || (!bfActive && !ivfActive && !ivfPqActive && !hnswActive)}
                                        className="px-6 py-2 text-sm font-medium text-white bg-gray-900
                                             rounded hover:bg-gray-800 disabled:bg-gray-300
                                             disabled:cursor-not-allowed transition-colors"
                                    >
                                        {loading ? 'Searching...' :
                                         !bfActive && !ivfActive && !ivfPqActive && !hnswActive ? 'Select Index' :
                                         'Search'}
                                    </button>
                                </div>

                                {/* Performance Ranking Visualization */}
                                {(() => {
                                    // Collect active indexes with valid search times
                                    const indexTimes: { name: string; time: number; color: string }[] = [];

                                    if (bfActive && bfResults.searchTime !== null && bfResults.searchTime !== undefined && bfResults.searchTime > 0) {
                                        indexTimes.push({ name: 'BruteForce', time: bfResults.searchTime, color: 'bg-gray-600' });
                                    }
                                    if (ivfActive && ivfResults.searchTime !== null && ivfResults.searchTime !== undefined && ivfResults.searchTime > 0) {
                                        indexTimes.push({ name: 'IVF', time: ivfResults.searchTime, color: 'bg-blue-600' });
                                    }
                                    if (ivfPqActive && ivfPqResults.searchTime !== null && ivfPqResults.searchTime !== undefined && ivfPqResults.searchTime > 0) {
                                        indexTimes.push({ name: 'IVF-PQ', time: ivfPqResults.searchTime, color: 'bg-purple-600' });
                                    }
                                    if (hnswActive && hnswResults.searchTime !== null && hnswResults.searchTime !== undefined && hnswResults.searchTime > 0) {
                                        indexTimes.push({ name: 'HNSW', time: hnswResults.searchTime, color: 'bg-green-600' });
                                    }

                                    if (indexTimes.length < 2) return null;

                                    // Sort by time (fastest first)
                                    indexTimes.sort((a, b) => a.time - b.time);
                                    const slowestTime = indexTimes[indexTimes.length - 1].time;

                                    // Format time display (convert ns to ms for readability)
                                    const formatTime = (ns: number) => {
                                        if (ns >= 1_000_000) return `${(ns / 1_000_000).toFixed(2)}ms`;
                                        if (ns >= 1_000) return `${(ns / 1_000).toFixed(2)}µs`;
                                        return `${ns.toFixed(0)}ns`;
                                    };

                                    return (
                                        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Performance Ranking</p>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                {indexTimes.map((index, i) => {
                                                    const isFirst = i === 0;
                                                    const isLast = i === indexTimes.length - 1;

                                                    return (
                                                        <div key={index.name} className="flex items-center gap-2">
                                                            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${
                                                                isFirst ? 'bg-green-100 border border-green-300' : 
                                                                isLast ? 'bg-red-50 border border-red-200' : 
                                                                'bg-white border border-gray-200'
                                                            }`}>
                                                                <div className={`w-2 h-2 rounded-full ${index.color}`} />
                                                                <span className={`text-sm font-medium ${
                                                                    isFirst ? 'text-green-800' : 
                                                                    isLast ? 'text-red-700' : 
                                                                    'text-gray-700'
                                                                }`}>
                                                                    {index.name}
                                                                </span>
                                                                <span className="text-xs text-gray-500 font-mono">
                                                                    {formatTime(index.time)}
                                                                </span>
                                                            </div>
                                                            {i < indexTimes.length - 1 && (
                                                                <div className="flex items-center gap-1 text-gray-400">
                                                                    <span className="text-lg font-light">»</span>
                                                                    <span className="text-xs font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">
                                                                        {(indexTimes[i + 1].time / index.time).toFixed(1)}x
                                                                    </span>
                                                                    <span className="text-lg font-light">»</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            <p className="text-xs text-gray-500 mt-2">
                                                Fastest to slowest • {indexTimes[0].name} is{' '}
                                                <span className="font-mono font-medium text-green-700">
                                                    {(slowestTime / indexTimes[0].time).toFixed(1)}x
                                                </span>
                                                {' '}faster than {indexTimes[indexTimes.length - 1].name}
                                            </p>
                                        </div>
                                    );
                                })()}

                                {/* Recall Display */}
                                {ivfActive && ivfTrackRecall && ivfResults.recall !== undefined && ivfResults.recall !== -1 && (
                                    <div className="border border-blue-200 rounded-lg p-4 bg-blue-50">
                                        <p className="text-sm text-gray-900">
                                            <span className="font-medium">IVF Recall@{k}:</span>{' '}
                                            <span className="font-mono font-medium text-blue-700">
                                                {(ivfResults.recall * 100).toFixed(2)}%
                                            </span>
                                            <span className="text-gray-600 ml-2">
                                                ({ivfResults.recall.toFixed(4)})
                                            </span>
                                        </p>
                                    </div>
                                )}

                                {ivfPqActive && ivfPqTrackRecall && ivfPqResults.recall !== undefined && ivfPqResults.recall !== -1 && (
                                    <div className="border border-blue-200 rounded-lg p-4 bg-blue-50">
                                        <p className="text-sm text-gray-900">
                                            <span className="font-medium">IVF-PQ Recall@{k}:</span>{' '}
                                            <span className="font-mono font-medium text-blue-700">
                                                {(ivfPqResults.recall * 100).toFixed(2)}%
                                            </span>
                                            <span className="text-gray-600 ml-2">
                                                ({ivfPqResults.recall.toFixed(4)})
                                            </span>
                                        </p>
                                    </div>
                                )}

                                {hnswActive && hnswTrackRecall && hnswResults.recall !== undefined && hnswResults.recall !== -1 && (
                                    <div className="border border-blue-200 rounded-lg p-4 bg-blue-50">
                                        <p className="text-sm text-gray-900">
                                            <span className="font-medium">HNSW Recall@{k}:</span>{' '}
                                            <span className="font-mono font-medium text-blue-700">
                                                {(hnswResults.recall * 100).toFixed(2)}%
                                            </span>
                                            <span className="text-gray-600 ml-2">
                                                ({hnswResults.recall.toFixed(4)})
                                            </span>
                                        </p>
                                    </div>
                                )}

                                {/* Side by Side Results - dynamically adjust columns based on active count */}
                                <div className={`grid gap-4 ${
                                    (() => {
                                        const activeCount = [bfActive, ivfActive, ivfPqActive, hnswActive].filter(Boolean).length;
                                        if (activeCount === 1) return 'grid-cols-1';
                                        if (activeCount === 2) return 'grid-cols-1 md:grid-cols-2';
                                        if (activeCount === 3) return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3';
                                        return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4';
                                    })()
                                }`}>
                                    {bfActive && (
                                        <div className="w-full">
                                            <ResultsColumn
                                                query={query}
                                                title="BruteForce Index"
                                                results={bfResults.results}
                                                searchTime={bfResults.searchTime}
                                            />
                                        </div>
                                    )}
                                    {ivfActive && (
                                        <div className="w-full">
                                            <ResultsColumn
                                                query={query}
                                                title="IVF Index"
                                                results={ivfResults.results}
                                                searchTime={ivfResults.searchTime}
                                            />
                                        </div>
                                    )}
                                    {ivfPqActive && (
                                        <div className="w-full">
                                            <ResultsColumn
                                                query={query}
                                                title="IVF-PQ Index"
                                                results={ivfPqResults.results}
                                                searchTime={ivfPqResults.searchTime}
                                            />
                                        </div>
                                    )}
                                    {hnswActive && (
                                        <div className="w-full">
                                            <ResultsColumn
                                                query={query}
                                                title="HNSW Index"
                                                results={hnswResults.results}
                                                searchTime={hnswResults.searchTime}
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </>
                )}

                {/* Benchmark Mode Content */}
                {appMode === 'benchmark' && (
                    <BenchmarkSection />
                )}
            </div>
        </div>
    );
}

export default MainScreen;