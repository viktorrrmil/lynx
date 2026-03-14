import { useEffect, useState } from 'react';
import { IndexStatusPanel } from "./IndexStatusPanel.tsx";
import { ActiveIndexingJobsPanel } from "./ActiveIndexingJobsPanel.tsx";

interface IsReadyResponse {
    ready: boolean;
    message: string;
    status?: {
        bf_ready: boolean;
        ivf_ready: boolean;
        ivfpq_ready: boolean;
        hnsw_ready: boolean;
        vector_count: number;
    };
}

interface DatabaseStats {
    database: string;
    server_version: string;
    size_bytes: number;
    size_pretty: string;
    table_rows: Record<string, number>;
    postgis_version?: string;
}

interface DatabaseStatus {
    name: string;
    role: string;
    connected: boolean;
    error?: string;
    stats?: DatabaseStats;
}

interface DatabaseStatusResponse {
    databases: DatabaseStatus[];
}

type VectorSource = 'vector' | 'geo';

interface VectorStoreSourceResponse {
    source: string;
    vector_count: number;
}

interface VectorStoreSwapResponse {
    source: string;
    vector_count: number;
    previous_source?: string;
}

const HotSwapSpinner = ({ active }: { active: boolean }) => (
    <span className={`hot-swap-spinner ${active ? 'is-active' : ''}`} aria-hidden="true">
        <span className="hot-swap-dot" />
        <span className="hot-swap-dot" />
        <span className="hot-swap-dot" />
        <span className="hot-swap-dot" />
        <span className="hot-swap-dot" />
        <span className="hot-swap-dot" />
        <span className="hot-swap-dot" />
        <span className="hot-swap-dot" />
    </span>
);

const IndexActivityPanel = () => {
    const [status, setStatus] = useState<IsReadyResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    const fetchStatus = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch('http://localhost:8080/is_ready');
            const data: IsReadyResponse = await response.json();
            setStatus(data);
            setLastUpdated(new Date());
        } catch (err) {
            console.error('Failed to fetch index activity:', err);
            const message = err instanceof Error ? err.message : 'Unknown error';
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStatus();
        const interval = setInterval(fetchStatus, 30000);
        return () => clearInterval(interval);
    }, []);

    const indexes = [
        { name: 'BruteForce', ready: status?.status?.bf_ready },
        { name: 'IVF', ready: status?.status?.ivf_ready },
        { name: 'IVF-PQ', ready: status?.status?.ivfpq_ready },
        { name: 'HNSW', ready: status?.status?.hnsw_ready },
    ];

    return (
        <div className="border border-slate-200 rounded-xl p-4 bg-gradient-to-br from-white via-slate-50 to-slate-100 text-slate-900 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="text-sm font-semibold text-slate-900 font-mono uppercase tracking-wide">Index Activity</h3>
                    <p className="text-xs text-slate-500 font-mono">
                        {status?.ready ? 'All indexes are ready' : status?.message || 'Awaiting status'}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {lastUpdated && (
                        <span className="text-xs text-slate-400 font-mono">
                            Updated {lastUpdated.toLocaleTimeString()}
                        </span>
                    )}
                    <button
                        onClick={fetchStatus}
                        disabled={loading}
                        className="text-xs text-slate-500 hover:text-slate-700 transition-colors font-mono"
                    >
                        {loading ? 'Refreshing...' : 'Refresh'}
                    </button>
                </div>
            </div>

            {error && (
                <div className="mb-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-md p-2 font-mono">
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {indexes.map((index) => {
                    const isReady = index.ready;
                    const stateLabel = isReady === undefined ? 'Unknown' : isReady ? 'Ready' : 'Building';
                    const dotClass = isReady === undefined ? 'bg-gray-300' : isReady ? 'bg-green-500' : 'bg-amber-400';
                    const cardClass = isReady === undefined
                        ? 'border-slate-200/80 bg-white/70'
                        : isReady
                          ? 'border-emerald-200/80 bg-emerald-50/70'
                          : 'border-amber-200/80 bg-white/70';

                    return (
                        <div key={index.name} className={`border rounded-lg p-3 transition-all shadow-[0_8px_20px_rgba(15,23,42,0.08)] ${cardClass}`}>
                            <div className="flex items-center gap-2 mb-1">
                                <div className={`w-2 h-2 rounded-full ${dotClass}`} />
                                <span className="text-xs font-semibold text-slate-900 font-mono">{index.name}</span>
                            </div>
                            <p className="text-xs text-slate-600 font-mono">{stateLabel}</p>
                        </div>
                    );
                })}
            </div>

            {status?.status?.vector_count !== undefined && (
                <div className="mt-3 pt-3 border-t border-slate-200">
                    <p className="text-xs text-slate-600 font-mono">
                        Vectors loaded: <span className="font-mono font-medium">{status.status.vector_count}</span>
                    </p>
                </div>
            )}
        </div>
    );
};

const DatabaseStatusPanel = () => {
    const [data, setData] = useState<DatabaseStatusResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [vectorSource, setVectorSource] = useState<VectorSource | null>(null);
    const [vectorCount, setVectorCount] = useState<number | null>(null);
    const [swapLoading, setSwapLoading] = useState(false);
    const [swapError, setSwapError] = useState<string | null>(null);

    const fetchStatus = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch('http://localhost:8080/db_status');
            if (!response.ok) {
                throw new Error(`Failed to fetch database status (${response.status})`);
            }
            const payload: DatabaseStatusResponse = await response.json();
            setData(payload);
        } catch (err) {
            console.error('Failed to fetch database status:', err);
            const message = err instanceof Error ? err.message : 'Unknown error';
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    const fetchVectorSource = async () => {
        try {
            const response = await fetch('http://localhost:8080/vector_store/source');
            if (!response.ok) {
                throw new Error(`Failed to fetch vector source (${response.status})`);
            }
            const payload: VectorStoreSourceResponse = await response.json();
            const normalized: VectorSource = payload.source === 'geo' ? 'geo' : 'vector';
            setVectorSource(normalized);
            setVectorCount(payload.vector_count);
        } catch (err) {
            console.error('Failed to fetch vector source:', err);
            const message = err instanceof Error ? err.message : 'Unknown error';
            setSwapError(message);
        }
    };

    const handleSwap = async () => {
        const target: VectorSource = vectorSource === 'geo' ? 'vector' : 'geo';
        setSwapLoading(true);
        setSwapError(null);
        try {
            const response = await fetch('http://localhost:8080/vector_store/hot_swap', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ target }),
            });
            if (!response.ok) {
                const fallback = `Failed to hot-swap vector store (${response.status})`;
                const payload = await response.json().catch(() => null);
                throw new Error(payload?.error || fallback);
            }
            const payload: VectorStoreSwapResponse = await response.json();
            const normalized: VectorSource = payload.source === 'geo' ? 'geo' : 'vector';
            setVectorSource(normalized);
            setVectorCount(payload.vector_count);
        } catch (err) {
            console.error('Failed to hot-swap vector store:', err);
            const message = err instanceof Error ? err.message : 'Unknown error';
            setSwapError(message);
        } finally {
            setSwapLoading(false);
        }
    };

    useEffect(() => {
        fetchStatus();
        fetchVectorSource();
    }, []);

    const swapTarget = vectorSource === 'geo' ? 'vector' : 'geo';
    const swapLabel = swapLoading ? 'Hot-swapping...' : `Swap to ${swapTarget.toUpperCase()}`;
    const sourceLabel = vectorSource ? vectorSource.toUpperCase() : 'UNKNOWN';

    return (
        <div className="border border-slate-200 rounded-xl p-4 bg-gradient-to-br from-white via-slate-50 to-slate-100 text-slate-900 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-900 font-mono uppercase tracking-wide">Database Status</h3>
                <button
                    onClick={fetchStatus}
                    disabled={loading}
                    className="text-xs text-slate-500 hover:text-slate-700 transition-colors font-mono"
                >
                    {loading ? 'Refreshing...' : 'Refresh'}
                </button>
            </div>

            <div className="border border-slate-200/80 rounded-lg p-3 bg-white/90 shadow-[0_8px_20px_rgba(15,23,42,0.08)] mb-4">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-xs text-slate-500 font-mono uppercase tracking-wide">Vector Store Hot Swap</p>
                        <p className="text-sm font-semibold text-slate-900">
                            Active source: <span className="font-mono">{sourceLabel}</span>
                        </p>
                        {vectorCount !== null && (
                            <p className="text-xs text-slate-600 font-mono">
                                Loaded vectors: <span className="font-semibold text-slate-900">{vectorCount.toLocaleString()}</span>
                            </p>
                        )}
                    </div>
                    <button
                        onClick={handleSwap}
                        disabled={swapLoading}
                        className={`px-3 py-2 rounded-lg text-xs font-semibold font-mono transition-all duration-300 flex items-center gap-2 ${
                            swapLoading
                                ? 'bg-amber-500 text-white shadow-[0_0_12px_rgba(245,158,11,0.35)] animate-pulse'
                                : 'bg-slate-900 text-white hover:bg-slate-800'
                        }`}
                    >
                        <HotSwapSpinner active={swapLoading} />
                        {swapLabel}
                    </button>
                </div>
                {swapLoading && (
                    <div className="mt-3 flex items-center gap-2 text-xs text-amber-700 font-mono">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                        </span>
                        Indexes are rebuilding during the hot-swap...
                    </div>
                )}
                {swapError && (
                    <div className="mt-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-md p-2 font-mono">
                        {swapError}
                    </div>
                )}
            </div>

            {error && (
                <div className="mb-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-md p-2 font-mono">
                    {error}
                </div>
            )}

            <div className="space-y-3">
                {data?.databases.map((db) => (
                    <div key={db.name} className="border border-slate-200/80 rounded-lg p-3 bg-white/80 shadow-[0_8px_20px_rgba(15,23,42,0.08)]">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${db.connected ? 'bg-green-500' : 'bg-red-400'}`} />
                                <div>
                                    <p className="text-sm font-semibold text-slate-900">{db.name}</p>
                                    <p className="text-xs text-slate-500 font-mono">{db.role}</p>
                                </div>
                            </div>
                            <span className={`text-xs font-semibold font-mono ${db.connected ? 'text-emerald-700' : 'text-rose-600'}`}>
                                {db.connected ? 'Connected' : 'Unavailable'}
                            </span>
                        </div>

                        {db.error && (
                            <div className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2 font-mono">
                                {db.error}
                            </div>
                        )}

                        {db.stats && (
                            <div className="mt-3 space-y-2 text-xs text-slate-600 font-mono">
                                <div className="flex items-center justify-between">
                                    <span>Database</span>
                                    <span className="font-mono text-slate-900">{db.stats.database}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span>Server</span>
                                    <span className="font-mono text-slate-900">{db.stats.server_version}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span>Size</span>
                                    <span className="font-mono text-slate-900">
                                        {db.stats.size_pretty || `${db.stats.size_bytes} bytes`}
                                    </span>
                                </div>
                                {db.stats.postgis_version && (
                                    <div className="flex items-center justify-between">
                                        <span>PostGIS</span>
                                        <span className="font-mono text-slate-900">{db.stats.postgis_version}</span>
                                    </div>
                                )}
                                {Object.keys(db.stats.table_rows || {}).length > 0 && (
                                    <div className="pt-2 border-t border-slate-200 space-y-1">
                                        {Object.entries(db.stats.table_rows).map(([table, count]) => (
                                            <div key={table} className="flex items-center justify-between">
                                                <span>{table}</span>
                                                <span className="font-mono text-slate-900">{count}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}

                {!data?.databases?.length && !error && (
                    <p className="text-xs text-slate-500 font-mono">No database status available.</p>
                )}
            </div>
        </div>
    );
};

const MasterControlTerminal = () => {
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="space-y-6 xl:col-span-2">
                    <IndexActivityPanel />
                    <ActiveIndexingJobsPanel />
                </div>
                <div className="space-y-6">
                    <DatabaseStatusPanel />
                    <IndexStatusPanel isExpanded={true} variant="terminal" />
                </div>
            </div>
        </div>
    );
};

export default MasterControlTerminal;
