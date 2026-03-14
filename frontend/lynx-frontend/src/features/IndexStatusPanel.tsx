import { useState, useEffect, useRef } from 'react';

interface IndexStatus {
    bf: {
        initialized: boolean;
        vectorCount: number;
    };
    ivf: {
        initialized: boolean;
        vectorCount: number;
        nlist: number;
        nprobe: number;
    };
    ivfpq: {
        initialized: boolean;
        vectorCount: number;
        nlist: number;
        nprobe: number;
        m: number;
        codebookSize: number;
    };
    hnsw: {
        initialized: boolean;
        vectorCount: number;
        m: number;
        efConstruction: number;
        efSearch: number;
    };
}

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

interface IndexStatusPanelProps {
    isExpanded: boolean;
    variant?: 'default' | 'terminal';
}

interface IndexStatusToggleProps {
    isExpanded: boolean;
    onToggle: () => void;
}

interface IvfSuggestion {
    nlist: number;
    nprobe: number;
}

interface IvfPqSuggestion extends IvfSuggestion {
    m: number;
    codebookSize: number;
}

interface HnswSuggestion {
    m: number;
    efConstruction: number;
    efSearch: number;
}

const clampNumber = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const resolveVectorCount = (status: IndexStatus | null) => {
    if (!status) {
        return 0;
    }
    return Math.max(
        status.bf?.vectorCount ?? 0,
        status.ivf?.vectorCount ?? 0,
        status.ivfpq?.vectorCount ?? 0,
        status.hnsw?.vectorCount ?? 0
    );
};

const recommendIvfParams = (vectorCount: number): IvfSuggestion | null => {
    if (vectorCount <= 0) {
        return null;
    }
    const maxNlist = Math.min(10000, Math.max(1, vectorCount));
    const minNlist = Math.min(16, maxNlist);
    const nlist = clampNumber(Math.round(4 * Math.sqrt(vectorCount)), minNlist, maxNlist);
    const nprobe = clampNumber(Math.round(Math.sqrt(nlist)), 1, Math.min(128, nlist));
    return { nlist, nprobe };
};

const recommendIvfPqParams = (vectorCount: number): IvfPqSuggestion | null => {
    const ivfBase = recommendIvfParams(vectorCount);
    if (!ivfBase) {
        return null;
    }
    let m = 8;
    let codebookSize = 128;
    if (vectorCount >= 200000) {
        m = 32;
        codebookSize = 256;
    } else if (vectorCount >= 50000) {
        m = 16;
        codebookSize = 256;
    }
    m = clampNumber(m, 1, 128);
    codebookSize = clampNumber(codebookSize, 1, 1024);
    return { ...ivfBase, m, codebookSize };
};

const recommendHnswParams = (vectorCount: number): HnswSuggestion | null => {
    if (vectorCount <= 0) {
        return null;
    }
    let m = 16;
    let efConstruction = 200;
    let efSearch = 50;
    if (vectorCount >= 200000) {
        m = 32;
        efConstruction = 400;
        efSearch = 100;
    } else if (vectorCount >= 50000) {
        m = 24;
        efConstruction = 300;
        efSearch = 75;
    }
    return {
        m: clampNumber(m, 2, 128),
        efConstruction: clampNumber(efConstruction, 1, 1000),
        efSearch: clampNumber(efSearch, 1, 1000),
    };
};

const formatCount = (value: number) => value.toLocaleString();

export const IndexStatusToggle = ({ isExpanded, onToggle }: IndexStatusToggleProps) => {
    return (
        <button
            onClick={onToggle}
            className={`px-3 py-1.5 text-xs font-medium rounded border transition-colors ${
                isExpanded
                    ? 'bg-gray-900 text-white border-gray-900 hover:bg-gray-800'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
        >
            Index Status
        </button>
    );
};

interface IndexBuildingStatusProps {
    onReady: () => void;
}

export const IndexBuildingStatus = ({ onReady }: IndexBuildingStatusProps) => {
    const [readyStatus, setReadyStatus] = useState<IsReadyResponse | null>(null);
    const [isPolling, setIsPolling] = useState(true);

    useEffect(() => {
        const checkReady = async () => {
            try {
                const response = await fetch('http://localhost:8080/is_ready');
                const data: IsReadyResponse = await response.json();
                setReadyStatus(data);

                if (data.ready) {
                    setIsPolling(false);
                    onReady();
                }
            } catch (error) {
                console.error('Failed to check ready status:', error);
            }
        };

        checkReady();

        if (isPolling) {
            const interval = setInterval(checkReady, 3000);
            return () => clearInterval(interval);
        }
    }, [isPolling, onReady]);

    if (!readyStatus || readyStatus.ready) {
        return null;
    }

    const indexes = [
        { name: 'BruteForce', key: 'bf_ready', ready: readyStatus.status?.bf_ready },
        { name: 'IVF', key: 'ivf_ready', ready: readyStatus.status?.ivf_ready },
        { name: 'IVF-PQ', key: 'ivfpq_ready', ready: readyStatus.status?.ivfpq_ready },
        { name: 'HNSW', key: 'hnsw_ready', ready: readyStatus.status?.hnsw_ready },
    ];

    return (
        <div className="border border-amber-200 rounded-lg p-4 bg-amber-50 mb-8">
            <div className="flex items-center gap-3 mb-4">
                <div className="relative">
                    <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                </div>
                <div>
                    <h3 className="text-sm font-medium text-amber-900">Building Indexes</h3>
                    <p className="text-xs text-amber-700">{readyStatus.message}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
                {indexes.map((index) => (
                    <div
                        key={index.key}
                        className={`border rounded-lg p-3 transition-all ${
                            index.ready
                                ? 'border-green-200 bg-green-50'
                                : 'border-amber-200 bg-white'
                        }`}
                    >
                        <div className="flex items-center gap-2 mb-1">
                            {index.ready ? (
                                <div className="w-2 h-2 rounded-full bg-green-500" />
                            ) : (
                                <div className="w-2 h-2 rounded-full bg-amber-400" />
                            )}
                            <span className="text-xs font-medium text-gray-900">{index.name}</span>
                        </div>
                        <p className="text-xs text-gray-600">
                            {index.ready ? 'Ready' : index.name === 'HNSW' ? 'Building (this may take a while)' : 'Building'}
                        </p>
                    </div>
                ))}
            </div>

            {readyStatus.status?.vector_count !== undefined && (
                <div className="mt-3 pt-3 border-t border-amber-200">
                    <p className="text-xs text-amber-700">
                        Vectors loaded: <span className="font-mono font-medium">{readyStatus.status.vector_count}</span>
                    </p>
                </div>
            )}
        </div>
    );
};

export const IndexStatusPanel = ({ isExpanded, variant = 'default' }: IndexStatusPanelProps) => {
    const [status, setStatus] = useState<IndexStatus | null>(null);
    const [loading, setLoading] = useState(false);
    const [editingIvf, setEditingIvf] = useState(false);
    const [ivfNlist, setIvfNlist] = useState(100);
    const [ivfNprobe, setIvfNprobe] = useState(10);
    const [rebuildLoading, setRebuildLoading] = useState(false);
    const [editingIvfPq, setEditingIvfPq] = useState(false);
    const [ivfPqNlist, setIvfPqNlist] = useState(100);
    const [ivfPqNprobe, setIvfPqNprobe] = useState(10);
    const [ivfPqM, setIvfPqM] = useState(8);
    const [ivfPqCodebookSize, setIvfPqCodebookSize] = useState(256);
    const [rebuildIvfPqLoading, setRebuildIvfPqLoading] = useState(false);
    const [editingHnsw, setEditingHnsw] = useState(false);
    const [hnswM, setHnswM] = useState(16);
    const [hnswEfConstruction, setHnswEfConstruction] = useState(200);
    const [hnswEfSearch, setHnswEfSearch] = useState(50);
    const [rebuildHnswLoading, setRebuildHnswLoading] = useState(false);
    const hasFetched = useRef(false);
    const vectorCount = resolveVectorCount(status);
    const ivfSuggestion = vectorCount ? recommendIvfParams(vectorCount) : null;
    const ivfPqSuggestion = vectorCount ? recommendIvfPqParams(vectorCount) : null;
    const hnswSuggestion = vectorCount ? recommendHnswParams(vectorCount) : null;
    const ivfMatchesSuggestion = Boolean(
        ivfSuggestion &&
        status?.ivf &&
        status.ivf.nlist === ivfSuggestion.nlist &&
        status.ivf.nprobe === ivfSuggestion.nprobe
    );
    const ivfPqMatchesSuggestion = Boolean(
        ivfPqSuggestion &&
        status?.ivfpq &&
        status.ivfpq.nlist === ivfPqSuggestion.nlist &&
        status.ivfpq.nprobe === ivfPqSuggestion.nprobe &&
        status.ivfpq.m === ivfPqSuggestion.m &&
        status.ivfpq.codebookSize === ivfPqSuggestion.codebookSize
    );
    const hnswMatchesSuggestion = Boolean(
        hnswSuggestion &&
        status?.hnsw &&
        status.hnsw.m === hnswSuggestion.m &&
        status.hnsw.efConstruction === hnswSuggestion.efConstruction &&
        status.hnsw.efSearch === hnswSuggestion.efSearch
    );
    const hasActionableSuggestions = Boolean(
        (ivfSuggestion && !ivfMatchesSuggestion) ||
        (ivfPqSuggestion && !ivfPqMatchesSuggestion) ||
        (hnswSuggestion && !hnswMatchesSuggestion)
    );

    const fetchStatus = async () => {
        setLoading(true);
        try {
            const response = await fetch('http://localhost:8080/index_status');
            if (response.ok) {
                const data = await response.json();
                setStatus(data);
                if (data.ivf) {
                    setIvfNlist(data.ivf.nlist || 100);
                    setIvfNprobe(data.ivf.nprobe || 10);
                }
                if (data.ivfpq) {
                    setIvfPqNlist(data.ivfpq.nlist || 100);
                    setIvfPqNprobe(data.ivfpq.nprobe || 10);
                    setIvfPqM(data.ivfpq.m || 8);
                    setIvfPqCodebookSize(data.ivfpq.codebookSize || 256);
                }
                if (data.hnsw) {
                    setHnswM(data.hnsw.m || 16);
                    setHnswEfConstruction(data.hnsw.efConstruction || 200);
                    setHnswEfSearch(data.hnsw.efSearch || 50);
                }
            }
        } catch (error) {
            console.error('Failed to fetch index status:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isExpanded && !hasFetched.current) {
            hasFetched.current = true;
            fetchStatus();
        }
    }, [isExpanded]);

    const handleRebuildIvf = async () => {
        setRebuildLoading(true);
        try {
            const response = await fetch('http://localhost:8080/rebuild_ivf', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nlist: ivfNlist, nprobe: ivfNprobe }),
            });
            if (response.ok) {
                setEditingIvf(false);
                await fetchStatus();
            }
        } catch (error) {
            console.error('Failed to rebuild IVF index:', error);
        } finally {
            setRebuildLoading(false);
        }
    };

    const handleCancelEdit = () => {
        setEditingIvf(false);
        if (status?.ivf) {
            setIvfNlist(status.ivf.nlist);
            setIvfNprobe(status.ivf.nprobe);
        }
    };

    const handleRebuildIvfPq = async () => {
        setRebuildIvfPqLoading(true);
        try {
            const response = await fetch('http://localhost:8080/rebuild_ivf_pq', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nlist: ivfPqNlist,
                    nprobe: ivfPqNprobe,
                    m: ivfPqM,
                    codebook_size: ivfPqCodebookSize
                }),
            });
            if (response.ok) {
                setEditingIvfPq(false);
                await fetchStatus();
            }
        } catch (error) {
            console.error('Failed to rebuild IVF-PQ index:', error);
        } finally {
            setRebuildIvfPqLoading(false);
        }
    };

    const handleCancelIvfPqEdit = () => {
        setEditingIvfPq(false);
        if (status?.ivfpq) {
            setIvfPqNlist(status.ivfpq.nlist);
            setIvfPqNprobe(status.ivfpq.nprobe);
            setIvfPqM(status.ivfpq.m);
            setIvfPqCodebookSize(status.ivfpq.codebookSize);
        }
    };

    const handleRebuildHnsw = async () => {
        setRebuildHnswLoading(true);
        try {
            const response = await fetch('http://localhost:8080/rebuild_hnsw', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    m: hnswM,
                    ef_construction: hnswEfConstruction,
                    ef_search: hnswEfSearch
                }),
            });
            if (response.ok) {
                setEditingHnsw(false);
                await fetchStatus();
            }
        } catch (error) {
            console.error('Failed to rebuild HNSW index:', error);
        } finally {
            setRebuildHnswLoading(false);
        }
    };

    const handleCancelHnswEdit = () => {
        setEditingHnsw(false);
        if (status?.hnsw) {
            setHnswM(status.hnsw.m);
            setHnswEfConstruction(status.hnsw.efConstruction);
            setHnswEfSearch(status.hnsw.efSearch);
        }
    };

    const applyIvfSuggestion = () => {
        if (!ivfSuggestion || ivfMatchesSuggestion) {
            return;
        }
        setIvfNlist(ivfSuggestion.nlist);
        setIvfNprobe(ivfSuggestion.nprobe);
        setEditingIvf(true);
    };

    const applyIvfPqSuggestion = () => {
        if (!ivfPqSuggestion || ivfPqMatchesSuggestion) {
            return;
        }
        setIvfPqNlist(ivfPqSuggestion.nlist);
        setIvfPqNprobe(ivfPqSuggestion.nprobe);
        setIvfPqM(ivfPqSuggestion.m);
        setIvfPqCodebookSize(ivfPqSuggestion.codebookSize);
        setEditingIvfPq(true);
    };

    const applyHnswSuggestion = () => {
        if (!hnswSuggestion || hnswMatchesSuggestion) {
            return;
        }
        setHnswM(hnswSuggestion.m);
        setHnswEfConstruction(hnswSuggestion.efConstruction);
        setHnswEfSearch(hnswSuggestion.efSearch);
        setEditingHnsw(true);
    };

    const applyAllSuggestions = () => {
        applyIvfSuggestion();
        applyIvfPqSuggestion();
        applyHnswSuggestion();
    };

    if (!isExpanded) return null;

    const isTerminal = variant === 'terminal';
    const panelClass = isTerminal
        ? 'border border-slate-200 rounded-xl p-4 bg-gradient-to-br from-white via-slate-50 to-slate-100 text-slate-900 shadow-[0_20px_60px_rgba(15,23,42,0.08)]'
        : 'border border-gray-200 rounded-lg p-4 bg-gray-50 mb-8';
    const titleClass = isTerminal
        ? 'text-sm font-semibold text-slate-900 font-mono uppercase tracking-wide'
        : 'text-sm font-medium text-gray-900';
    const refreshClass = isTerminal
        ? 'text-xs text-slate-500 hover:text-slate-700 transition-colors font-mono'
        : 'text-xs text-gray-500 hover:text-gray-700 transition-colors';
    const loadingTextClass = isTerminal ? 'text-sm text-slate-500 font-mono' : 'text-sm text-gray-500';
    const cardClass = isTerminal
        ? 'border border-slate-200/80 rounded-lg p-3 bg-white/80 shadow-[0_8px_20px_rgba(15,23,42,0.08)]'
        : 'border border-gray-200 rounded-lg p-3 bg-white';
    const headingClass = isTerminal ? 'text-sm font-semibold text-slate-900' : 'text-sm font-medium text-gray-900';
    const rowTextClass = isTerminal ? 'text-xs text-slate-600 font-mono' : 'text-xs text-gray-600';
    const editButtonClass = isTerminal
        ? 'text-xs text-slate-500 hover:text-slate-700 transition-colors font-mono'
        : 'text-xs text-gray-500 hover:text-gray-700 transition-colors';
    const inputClass = isTerminal
        ? 'flex-1 px-2 py-1 text-xs border border-slate-300 rounded bg-white/80 focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-400 font-mono'
        : 'flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900';
    const primaryButtonClass = isTerminal
        ? 'flex-1 px-2 py-1 text-xs font-semibold text-slate-50 bg-slate-900 rounded hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors font-mono'
        : 'flex-1 px-2 py-1 text-xs font-medium text-white bg-gray-900 rounded hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors';
    const secondaryButtonClass = isTerminal
        ? 'px-2 py-1 text-xs font-medium text-slate-600 bg-white border border-slate-300 rounded hover:bg-slate-50 disabled:cursor-not-allowed transition-colors font-mono'
        : 'px-2 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:cursor-not-allowed transition-colors';
    const suggestionContainerClass = isTerminal
        ? 'mt-3 border-t border-slate-200 pt-2 text-xs text-slate-600 font-mono'
        : 'mt-3 border-t border-gray-200 pt-2 text-xs text-gray-600';
    const suggestionLabelClass = isTerminal
        ? 'text-[11px] uppercase tracking-wide text-slate-400 font-mono'
        : 'text-[11px] uppercase tracking-wide text-gray-400';
    const suggestionButtonClass = isTerminal
        ? 'mt-2 inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded hover:bg-amber-100 transition-colors font-mono'
        : 'mt-2 inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded hover:bg-amber-100 transition-colors';
    const applyAllButtonClass = isTerminal
        ? 'px-2 py-1 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded hover:bg-amber-100 transition-colors font-mono'
        : 'px-2 py-1 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded hover:bg-amber-100 transition-colors';
    const suggestionSource = vectorCount > 0
        ? `Based on ${formatCount(vectorCount)} vectors`
        : 'Vector count unavailable';

    return (
        <div className={panelClass}>
            <div className="flex items-center justify-between mb-4">
                <h3 className={titleClass}>Index Status</h3>
                <div className="flex items-center gap-2">
                    {hasActionableSuggestions && (
                        <button
                            type="button"
                            onClick={applyAllSuggestions}
                            className={applyAllButtonClass}
                        >
                            Apply all suggestions
                        </button>
                    )}
                    <button
                        onClick={fetchStatus}
                        disabled={loading}
                        className={refreshClass}
                    >
                        {loading ? 'Refreshing...' : 'Refresh'}
                    </button>
                </div>
            </div>

            {loading && !status ? (
                <p className={loadingTextClass}>Loading status...</p>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {/* BruteForce Index Status */}
                    <div className={cardClass}>
                        <div className="flex items-center gap-2 mb-2">
                            <div className={`w-2 h-2 rounded-full ${status?.bf?.initialized ? 'bg-green-500' : 'bg-gray-300'}`} />
                            <h4 className={headingClass}>BruteForce Index</h4>
                        </div>
                        <div className="space-y-1">
                            <p className={rowTextClass}>
                                Status: <span className="font-medium">{status?.bf?.initialized ? 'Initialized' : 'Not initialized'}</span>
                            </p>
                            <p className={rowTextClass}>
                                Vectors: <span className="font-mono font-medium">{status?.bf?.vectorCount ?? 0}</span>
                            </p>
                        </div>
                        {vectorCount > 0 && (
                            <div className={suggestionContainerClass}>
                                <p className={suggestionLabelClass}>Heuristic suggestion</p>
                                <p className={rowTextClass}>
                                    BruteForce has no recalibration parameters. Use it as the recall baseline. {suggestionSource}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* IVF Index Status */}
                    <div className={cardClass}>
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${status?.ivf?.initialized ? 'bg-green-500' : 'bg-gray-300'}`} />
                                <h4 className={headingClass}>IVF Index</h4>
                            </div>
                            {!editingIvf && (
                                <button
                                    onClick={() => setEditingIvf(true)}
                                    className={editButtonClass}
                                >
                                    Edit
                                </button>
                            )}
                        </div>
                        <div className="space-y-1">
                            <p className={rowTextClass}>
                                Status: <span className="font-medium">{status?.ivf?.initialized ? 'Initialized' : 'Not initialized'}</span>
                            </p>
                            <p className={rowTextClass}>
                                Vectors: <span className="font-mono font-medium">{status?.ivf?.vectorCount ?? 0}</span>
                            </p>

                            {editingIvf ? (
                                <div className="mt-3 space-y-2">
                                    <div className="flex items-center gap-2">
                                        <label className={`${rowTextClass} w-14`}>nlist:</label>
                                        <input
                                            type="number"
                                            min={1}
                                            max={10000}
                                            value={ivfNlist}
                                            onChange={(e) => setIvfNlist(Number(e.target.value))}
                                            className={inputClass}
                                        />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <label className={`${rowTextClass} w-14`}>nprobe:</label>
                                        <input
                                            type="number"
                                            min={1}
                                            max={ivfNlist}
                                            value={ivfNprobe}
                                            onChange={(e) => setIvfNprobe(Number(e.target.value))}
                                            className={inputClass}
                                        />
                                    </div>
                                    <div className="flex gap-2 mt-2">
                                        <button
                                            onClick={handleRebuildIvf}
                                            disabled={rebuildLoading}
                                            className={primaryButtonClass}
                                        >
                                            {rebuildLoading ? 'Rebuilding...' : 'Rebuild Index'}
                                        </button>
                                        <button
                                            onClick={handleCancelEdit}
                                            disabled={rebuildLoading}
                                            className={secondaryButtonClass}
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <p className={rowTextClass}>
                                        nlist: <span className="font-mono font-medium">{status?.ivf?.nlist ?? '-'}</span>
                                    </p>
                                    <p className={rowTextClass}>
                                        nprobe: <span className="font-mono font-medium">{status?.ivf?.nprobe ?? '-'}</span>
                                    </p>
                                </>
                            )}
                            {ivfSuggestion && !ivfMatchesSuggestion && (
                                <div className={suggestionContainerClass}>
                                    <p className={suggestionLabelClass}>Heuristic suggestion</p>
                                    <p className={rowTextClass}>
                                        nlist: <span className="font-mono font-medium">{ivfSuggestion.nlist}</span> · nprobe:{' '}
                                        <span className="font-mono font-medium">{ivfSuggestion.nprobe}</span> {suggestionSource}
                                    </p>
                                    <button
                                        type="button"
                                        onClick={applyIvfSuggestion}
                                        className={suggestionButtonClass}
                                    >
                                        Apply suggestions
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* IVF-PQ Index Status */}
                    <div className={cardClass}>
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${status?.ivfpq?.initialized ? 'bg-green-500' : 'bg-gray-300'}`} />
                                <h4 className={headingClass}>IVF-PQ Index</h4>
                            </div>
                            {!editingIvfPq && (
                                <button
                                    onClick={() => setEditingIvfPq(true)}
                                    className={editButtonClass}
                                >
                                    Edit
                                </button>
                            )}
                        </div>
                        <div className="space-y-1">
                            <p className={rowTextClass}>
                                Status: <span className="font-medium">{status?.ivfpq?.initialized ? 'Initialized' : 'Not initialized'}</span>
                            </p>
                            <p className={rowTextClass}>
                                Vectors: <span className="font-mono font-medium">{status?.ivfpq?.vectorCount ?? 0}</span>
                            </p>

                            {editingIvfPq ? (
                                <div className="mt-3 space-y-2">
                                    <div className="flex items-center gap-2">
                                        <label className={`${rowTextClass} w-20`}>nlist:</label>
                                        <input
                                            type="number"
                                            min={1}
                                            max={10000}
                                            value={ivfPqNlist}
                                            onChange={(e) => setIvfPqNlist(Number(e.target.value))}
                                            className={inputClass}
                                        />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <label className={`${rowTextClass} w-20`}>nprobe:</label>
                                        <input
                                            type="number"
                                            min={1}
                                            max={ivfPqNlist}
                                            value={ivfPqNprobe}
                                            onChange={(e) => setIvfPqNprobe(Number(e.target.value))}
                                            className={inputClass}
                                        />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <label className={`${rowTextClass} w-20`}>m:</label>
                                        <input
                                            type="number"
                                            min={1}
                                            max={128}
                                            value={ivfPqM}
                                            onChange={(e) => setIvfPqM(Number(e.target.value))}
                                            className={inputClass}
                                        />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <label className={`${rowTextClass} w-20`}>codebook:</label>
                                        <input
                                            type="number"
                                            min={1}
                                            max={1024}
                                            value={ivfPqCodebookSize}
                                            onChange={(e) => setIvfPqCodebookSize(Number(e.target.value))}
                                            className={inputClass}
                                        />
                                    </div>
                                    <div className="flex gap-2 mt-2">
                                        <button
                                            onClick={handleRebuildIvfPq}
                                            disabled={rebuildIvfPqLoading}
                                            className={primaryButtonClass}
                                        >
                                            {rebuildIvfPqLoading ? 'Rebuilding...' : 'Rebuild Index'}
                                        </button>
                                        <button
                                            onClick={handleCancelIvfPqEdit}
                                            disabled={rebuildIvfPqLoading}
                                            className={secondaryButtonClass}
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <p className={rowTextClass}>
                                        nlist: <span className="font-mono font-medium">{status?.ivfpq?.nlist ?? '-'}</span>
                                    </p>
                                    <p className={rowTextClass}>
                                        nprobe: <span className="font-mono font-medium">{status?.ivfpq?.nprobe ?? '-'}</span>
                                    </p>
                                    <p className={rowTextClass}>
                                        m: <span className="font-mono font-medium">{status?.ivfpq?.m ?? '-'}</span>
                                    </p>
                                    <p className={rowTextClass}>
                                        codebook: <span className="font-mono font-medium">{status?.ivfpq?.codebookSize ?? '-'}</span>
                                    </p>
                                </>
                            )}
                            {ivfPqSuggestion && !ivfPqMatchesSuggestion && (
                                <div className={suggestionContainerClass}>
                                    <p className={suggestionLabelClass}>Heuristic suggestion</p>
                                    <p className={rowTextClass}>
                                        nlist: <span className="font-mono font-medium">{ivfPqSuggestion.nlist}</span> · nprobe:{' '}
                                        <span className="font-mono font-medium">{ivfPqSuggestion.nprobe}</span>
                                    </p>
                                    <p className={rowTextClass}>
                                        m: <span className="font-mono font-medium">{ivfPqSuggestion.m}</span> · codebook:{' '}
                                        <span className="font-mono font-medium">{ivfPqSuggestion.codebookSize}</span> {suggestionSource}
                                    </p>
                                    <button
                                        type="button"
                                        onClick={applyIvfPqSuggestion}
                                        className={suggestionButtonClass}
                                    >
                                        Apply suggestions
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* HNSW Index Status */}
                    <div className={cardClass}>
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${status?.hnsw?.initialized ? 'bg-green-500' : 'bg-gray-300'}`} />
                                <h4 className={headingClass}>HNSW Index</h4>
                            </div>
                            {!editingHnsw && (
                                <button
                                    onClick={() => setEditingHnsw(true)}
                                    className={editButtonClass}
                                >
                                    Edit
                                </button>
                            )}
                        </div>
                        <div className="space-y-1">
                            <p className={rowTextClass}>
                                Status: <span className="font-medium">{status?.hnsw?.initialized ? 'Initialized' : 'Not initialized'}</span>
                            </p>
                            <p className={rowTextClass}>
                                Vectors: <span className="font-mono font-medium">{status?.hnsw?.vectorCount ?? 0}</span>
                            </p>

                            {editingHnsw ? (
                                <div className="mt-3 space-y-2">
                                    <div className="flex items-center gap-2">
                                        <label className={`${rowTextClass} w-20`}>M:</label>
                                        <input
                                            type="number"
                                            min={2}
                                            max={128}
                                            value={hnswM}
                                            onChange={(e) => setHnswM(Number(e.target.value))}
                                            className={inputClass}
                                        />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <label className={`${rowTextClass} w-20`}>efConstruct:</label>
                                        <input
                                            type="number"
                                            min={1}
                                            max={1000}
                                            value={hnswEfConstruction}
                                            onChange={(e) => setHnswEfConstruction(Number(e.target.value))}
                                            className={inputClass}
                                        />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <label className={`${rowTextClass} w-20`}>efSearch:</label>
                                        <input
                                            type="number"
                                            min={1}
                                            max={1000}
                                            value={hnswEfSearch}
                                            onChange={(e) => setHnswEfSearch(Number(e.target.value))}
                                            className={inputClass}
                                        />
                                    </div>
                                    <div className="flex gap-2 mt-2">
                                        <button
                                            onClick={handleRebuildHnsw}
                                            disabled={rebuildHnswLoading}
                                            className={primaryButtonClass}
                                        >
                                            {rebuildHnswLoading ? 'Rebuilding...' : 'Rebuild Index'}
                                        </button>
                                        <button
                                            onClick={handleCancelHnswEdit}
                                            disabled={rebuildHnswLoading}
                                            className={secondaryButtonClass}
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <p className={rowTextClass}>
                                        M: <span className="font-mono font-medium">{status?.hnsw?.m ?? '-'}</span>
                                    </p>
                                    <p className={rowTextClass}>
                                        efConstruction: <span className="font-mono font-medium">{status?.hnsw?.efConstruction ?? '-'}</span>
                                    </p>
                                    <p className={rowTextClass}>
                                        efSearch: <span className="font-mono font-medium">{status?.hnsw?.efSearch ?? '-'}</span>
                                    </p>
                                </>
                            )}
                            {hnswSuggestion && !hnswMatchesSuggestion && (
                                <div className={suggestionContainerClass}>
                                    <p className={suggestionLabelClass}>Heuristic suggestion</p>
                                    <p className={rowTextClass}>
                                        M: <span className="font-mono font-medium">{hnswSuggestion.m}</span> · efConstruct:{' '}
                                        <span className="font-mono font-medium">{hnswSuggestion.efConstruction}</span> · efSearch:{' '}
                                        <span className="font-mono font-medium">{hnswSuggestion.efSearch}</span> {suggestionSource}
                                    </p>
                                    <button
                                        type="button"
                                        onClick={applyHnswSuggestion}
                                        className={suggestionButtonClass}
                                    >
                                        Apply suggestions
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
