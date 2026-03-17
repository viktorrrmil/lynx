import {useState} from 'react';
import type {IndexResults} from "../types/types.ts";
import ResultsColumn from "./results/ResultColumn.tsx";
import DatasetIngestionCard from "./DatasetIngestionCard.tsx";
import DatasetIngestionDialog from "./DatasetIngestionDialog.tsx";
import UploadSection from "./UploadSection.tsx";
import InfoScreen from "./InfoScreen.tsx";
import VectorCacheSection from "./VectorCacheSection.tsx";
import { IndexBuildingStatus } from "./IndexStatusPanel.tsx";
import BenchmarkSection from "./BenchmarkSection.tsx";
import MasterControlTerminal from "./MasterControlTerminal.tsx";

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
    const [indexesReady, setIndexesReady] = useState(false);
    const [appMode, setAppMode] = useState<AppMode>('search');
    const [modeDropdownOpen, setModeDropdownOpen] = useState(false);
    const [showTerminal, setShowTerminal] = useState(false);
    const [ingestionDialogOpen, setIngestionDialogOpen] = useState(false);

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
        <div className={`min-h-screen cli-shell`}>
            <div className={`${showTerminal ? 'max-w-screen-2xl' : 'max-w-7xl'} mx-auto px-6 py-8`}>
                <DatasetIngestionDialog
                    open={ingestionDialogOpen}
                    onClose={() => setIngestionDialogOpen(false)}
                />
                {/* Header */}
                <div className="flex w-full justify-between mb-8 items-start gap-6">
                    <div className="flex items-start gap-6">
                        <div>
                            <h1
                                className="cli-title"
                            >
                                {showTerminal ? 'Master Control Terminal' : 'Lynx - Vector Search Engine'}
                            </h1>
                            <p className="cli-subtitle mt-2">
                                {showTerminal
                                    ? 'System-wide admin dashboard and operational status'
                                    : 'Compare BruteForce vs IVF index performance'}
                            </p>
                        </div>

                        {/* Mode Dropdown */}
                        {!showTerminal && (
                            <div className="relative">
                                <button
                                    onClick={() => setModeDropdownOpen(!modeDropdownOpen)}
                                    className="cli-button flex items-center gap-2 font-mono"
                                >
                                    <span className={`w-2 h-2 rounded-full ${appMode === 'search' ? 'bg-green-500' : 'bg-blue-500'}`} />
                                    {appMode === 'search' ? 'Search Mode' : 'Benchmark Mode'}
                                    <span className="text-slate-400">{modeDropdownOpen ? '▲' : '▼'}</span>
                                </button>

                                {modeDropdownOpen && (
                                    <div className="absolute top-full left-0 mt-1 w-full cli-panel-strong z-10">
                                        <button
                                            onClick={() => {
                                                setAppMode('search');
                                                setModeDropdownOpen(false);
                                            }}
                                            className={`w-full flex items-center gap-2 px-4 py-2 text-xs text-left font-mono hover:bg-slate-50 transition-colors rounded-t-lg ${
                                                appMode === 'search' ? 'bg-slate-50' : ''
                                            }`}
                                        >
                                            <span className="w-2 h-2 rounded-full bg-green-500" />
                                            Search
                                            {appMode === 'search' && <span className="ml-auto text-slate-400">✓</span>}
                                        </button>
                                        <button
                                            onClick={() => {
                                                setAppMode('benchmark');
                                                setModeDropdownOpen(false);
                                            }}
                                            className={`w-full flex items-center gap-2 px-4 py-2 text-xs text-left font-mono hover:bg-slate-50 transition-colors rounded-b-lg ${
                                                appMode === 'benchmark' ? 'bg-slate-50' : ''
                                            }`}
                                        >
                                            <span className="w-2 h-2 rounded-full bg-blue-500" />
                                            Benchmark
                                            {appMode === 'benchmark' && <span className="ml-auto text-slate-400">✓</span>}
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => {
                                setShowTerminal(!showTerminal);
                                setModeDropdownOpen(false);
                            }}
                            className={showTerminal ? 'cli-button-primary font-mono' : 'cli-button font-mono'}
                        >
                            {showTerminal ? 'Back to Main' : 'Master Control'}
                        </button>
                        {!showTerminal && (
                            <>
                                <VectorCacheSection />
                            </>
                        )}
                    </div>
                </div>

                {showTerminal ? (
                    <MasterControlTerminal />
                ) : (
                    <>
                        {/* Index Building Status - shows when indexes are being built */}
                        {!indexesReady && (
                            <IndexBuildingStatus onReady={() => setIndexesReady(true)} />
                        )}

                        {/* Search Mode Content */}
                        {appMode === 'search' && (
                            <>
                        {/* Upload Section */}
                        <div className="flex w-full flex-col gap-4 mb-10">
                            <DatasetIngestionCard onOpen={() => setIngestionDialogOpen(true)} />
                            <UploadSection loading={loading} setLoading={setLoading} />
                            <InfoScreen />
                        </div>


                        {/* Search Section */}
                        <div>
                            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                                <h2 className="cli-header">
                                    Search Active Indexes
                                </h2>

                                {/* Index Toggle Buttons */}
                                <div className="flex gap-2 flex-wrap">
                                    <button
                                        onClick={() => setBfActive(!bfActive)}
                                        className={`px-3 py-1.5 text-xs font-medium rounded border font-mono transition-colors ${
                                            bfActive
                                                ? 'bg-slate-900 text-white border-slate-900 hover:bg-slate-800'
                                                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                                        }`}
                                    >
                                        BruteForce {bfActive ? '✓' : '○'}
                                    </button>
                                    <button
                                        onClick={() => setIvfActive(!ivfActive)}
                                        className={`px-3 py-1.5 text-xs font-medium rounded border font-mono transition-colors ${
                                            ivfActive
                                                ? 'bg-slate-900 text-white border-slate-900 hover:bg-slate-800'
                                                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                                        }`}
                                    >
                                        IVF {ivfActive ? '✓' : '○'}
                                    </button>
                                    {ivfActive && (
                                        <button
                                            onClick={() => setIvfTrackRecall(!ivfTrackRecall)}
                                            className={`px-3 py-1.5 text-xs font-medium rounded border font-mono transition-colors ${
                                                ivfTrackRecall
                                                    ? 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700'
                                                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                                            }`}
                                            title="Track IVF Recall@k"
                                        >
                                            IVF Recall {ivfTrackRecall ? '✓' : '○'}
                                        </button>
                                    )}
                                    <button
                                        onClick={() => setIvfPqActive(!ivfPqActive)}
                                        className={`px-3 py-1.5 text-xs font-medium rounded border font-mono transition-colors ${
                                            ivfPqActive
                                                ? 'bg-slate-900 text-white border-slate-900 hover:bg-slate-800'
                                                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                                        }`}
                                    >
                                        IVF-PQ {ivfPqActive ? '✓' : '○'}
                                    </button>
                                    {ivfPqActive && (
                                        <button
                                            onClick={() => setIvfPqTrackRecall(!ivfPqTrackRecall)}
                                            className={`px-3 py-1.5 text-xs font-medium rounded border font-mono transition-colors ${
                                                ivfPqTrackRecall
                                                    ? 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700'
                                                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                                            }`}
                                            title="Track IVF-PQ Recall@k"
                                        >
                                            PQ Recall {ivfPqTrackRecall ? '✓' : '○'}
                                        </button>
                                    )}
                                    <button
                                        onClick={() => setHnswActive(!hnswActive)}
                                        className={`px-3 py-1.5 text-xs font-medium rounded border font-mono transition-colors ${
                                            hnswActive
                                                ? 'bg-slate-900 text-white border-slate-900 hover:bg-slate-800'
                                                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                                        }`}
                                    >
                                        HNSW {hnswActive ? '✓' : '○'}
                                    </button>
                                    {hnswActive && (
                                        <button
                                            onClick={() => setHnswTrackRecall(!hnswTrackRecall)}
                                            className={`px-3 py-1.5 text-xs font-medium rounded border font-mono transition-colors ${
                                                hnswTrackRecall
                                                    ? 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700'
                                                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
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
                                        className="flex-1 cli-input"
                                    />
                                    <input
                                        type="number"
                                        min={1}
                                        max={1000}
                                        value={k}
                                        onChange={(e) => setK(Number(e.target.value))}
                                        className="w-24 cli-input"
                                    />
                                    <button
                                        onClick={handleSearch}
                                        disabled={loading || (!bfActive && !ivfActive && !ivfPqActive && !hnswActive)}
                                        className="cli-button-primary disabled:bg-slate-300 disabled:cursor-not-allowed"
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
                                        <div className="cli-panel-muted p-4">
                                            <p className="cli-pill mb-3">Performance Ranking</p>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                {indexTimes.map((index, i) => {
                                                    const isFirst = i === 0;
                                                    const isLast = i === indexTimes.length - 1;

                                                    return (
                                                        <div key={index.name} className="flex items-center gap-2">
                                                            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${
                                                                isFirst ? 'bg-emerald-100 border border-emerald-300' :
                                                                isLast ? 'bg-rose-50 border border-rose-200' :
                                                                'bg-white border border-slate-200'
                                                            }`}>
                                                                <div className={`w-2 h-2 rounded-full ${index.color}`} />
                                                                <span className={`text-sm font-medium ${
                                                                    isFirst ? 'text-emerald-800' :
                                                                    isLast ? 'text-rose-700' :
                                                                    'text-slate-700'
                                                                }`}>
                                                                    {index.name}
                                                                </span>
                                                                <span className="text-xs text-slate-500 font-mono">
                                                                    {formatTime(index.time)}
                                                                </span>
                                                            </div>
                                                            {i < indexTimes.length - 1 && (
                                                                <div className="flex items-center gap-1 text-slate-400">
                                                                    <span className="text-lg font-light">»</span>
                                                                    <span className="text-xs font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">
                                                                        {(indexTimes[i + 1].time / index.time).toFixed(1)}x
                                                                    </span>
                                                                    <span className="text-lg font-light">»</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            <p className="text-xs text-slate-500 mt-2">
                                                Fastest to slowest • {indexTimes[0].name} is{' '}
                                                <span className="font-mono font-medium text-emerald-700">
                                                    {(slowestTime / indexTimes[0].time).toFixed(1)}x
                                                </span>
                                                {' '}faster than {indexTimes[indexTimes.length - 1].name}
                                            </p>
                                        </div>
                                    );
                                })()}

                                {/* Recall Display */}
                                {ivfActive && ivfTrackRecall && ivfResults.recall !== undefined && ivfResults.recall !== -1 && (
                                    <div className="cli-panel-muted p-4">
                                        <p className="text-sm text-slate-900">
                                            <span className="font-medium">IVF Recall@{k}:</span>{' '}
                                            <span className="font-mono font-medium text-indigo-700">
                                                {(ivfResults.recall * 100).toFixed(2)}%
                                            </span>
                                            <span className="text-slate-600 ml-2">
                                                ({ivfResults.recall.toFixed(4)})
                                            </span>
                                        </p>
                                    </div>
                                )}

                                {ivfPqActive && ivfPqTrackRecall && ivfPqResults.recall !== undefined && ivfPqResults.recall !== -1 && (
                                    <div className="cli-panel-muted p-4">
                                        <p className="text-sm text-slate-900">
                                            <span className="font-medium">IVF-PQ Recall@{k}:</span>{' '}
                                            <span className="font-mono font-medium text-indigo-700">
                                                {(ivfPqResults.recall * 100).toFixed(2)}%
                                            </span>
                                            <span className="text-slate-600 ml-2">
                                                ({ivfPqResults.recall.toFixed(4)})
                                            </span>
                                        </p>
                                    </div>
                                )}

                                {hnswActive && hnswTrackRecall && hnswResults.recall !== undefined && hnswResults.recall !== -1 && (
                                    <div className="cli-panel-muted p-4">
                                        <p className="text-sm text-slate-900">
                                            <span className="font-medium">HNSW Recall@{k}:</span>{' '}
                                            <span className="font-mono font-medium text-indigo-700">
                                                {(hnswResults.recall * 100).toFixed(2)}%
                                            </span>
                                            <span className="text-slate-600 ml-2">
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
                    </>
                )}
            </div>
        </div>
    );
}

export default MainScreen;
