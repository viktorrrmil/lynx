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
}

interface IndexStatusToggleProps {
    isExpanded: boolean;
    onToggle: () => void;
}

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

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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

export const IndexStatusPanel = ({ isExpanded }: IndexStatusPanelProps) => {
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

    if (!isExpanded) return null;

    return (
        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 mb-8">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-gray-900">Index Status</h3>
                <button
                    onClick={fetchStatus}
                    disabled={loading}
                    className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
                >
                    {loading ? 'Refreshing...' : 'Refresh'}
                </button>
            </div>

            {loading && !status ? (
                <p className="text-sm text-gray-500">Loading status...</p>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* BruteForce Index Status */}
                    <div className="border border-gray-200 rounded-lg p-3 bg-white">
                        <div className="flex items-center gap-2 mb-2">
                            <div className={`w-2 h-2 rounded-full ${status?.bf?.initialized ? 'bg-green-500' : 'bg-gray-300'}`} />
                            <h4 className="text-sm font-medium text-gray-900">BruteForce Index</h4>
                        </div>
                        <div className="space-y-1">
                            <p className="text-xs text-gray-600">
                                Status: <span className="font-medium">{status?.bf?.initialized ? 'Initialized' : 'Not initialized'}</span>
                            </p>
                            <p className="text-xs text-gray-600">
                                Vectors: <span className="font-mono font-medium">{status?.bf?.vectorCount ?? 0}</span>
                            </p>
                        </div>
                    </div>

                    {/* IVF Index Status */}
                    <div className="border border-gray-200 rounded-lg p-3 bg-white">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${status?.ivf?.initialized ? 'bg-green-500' : 'bg-gray-300'}`} />
                                <h4 className="text-sm font-medium text-gray-900">IVF Index</h4>
                            </div>
                            {!editingIvf && (
                                <button
                                    onClick={() => setEditingIvf(true)}
                                    className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
                                >
                                    Edit
                                </button>
                            )}
                        </div>
                        <div className="space-y-1">
                            <p className="text-xs text-gray-600">
                                Status: <span className="font-medium">{status?.ivf?.initialized ? 'Initialized' : 'Not initialized'}</span>
                            </p>
                            <p className="text-xs text-gray-600">
                                Vectors: <span className="font-mono font-medium">{status?.ivf?.vectorCount ?? 0}</span>
                            </p>

                            {editingIvf ? (
                                <div className="mt-3 space-y-2">
                                    <div className="flex items-center gap-2">
                                        <label className="text-xs text-gray-600 w-14">nlist:</label>
                                        <input
                                            type="number"
                                            min={1}
                                            max={10000}
                                            value={ivfNlist}
                                            onChange={(e) => setIvfNlist(Number(e.target.value))}
                                            className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900"
                                        />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <label className="text-xs text-gray-600 w-14">nprobe:</label>
                                        <input
                                            type="number"
                                            min={1}
                                            max={ivfNlist}
                                            value={ivfNprobe}
                                            onChange={(e) => setIvfNprobe(Number(e.target.value))}
                                            className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900"
                                        />
                                    </div>
                                    <div className="flex gap-2 mt-2">
                                        <button
                                            onClick={handleRebuildIvf}
                                            disabled={rebuildLoading}
                                            className="flex-1 px-2 py-1 text-xs font-medium text-white bg-gray-900 rounded hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                                        >
                                            {rebuildLoading ? 'Rebuilding...' : 'Rebuild Index'}
                                        </button>
                                        <button
                                            onClick={handleCancelEdit}
                                            disabled={rebuildLoading}
                                            className="px-2 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:cursor-not-allowed transition-colors"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <p className="text-xs text-gray-600">
                                        nlist: <span className="font-mono font-medium">{status?.ivf?.nlist ?? '-'}</span>
                                    </p>
                                    <p className="text-xs text-gray-600">
                                        nprobe: <span className="font-mono font-medium">{status?.ivf?.nprobe ?? '-'}</span>
                                    </p>
                                </>
                            )}
                        </div>
                    </div>

                    {/* IVF-PQ Index Status */}
                    <div className="border border-gray-200 rounded-lg p-3 bg-white">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${status?.ivfpq?.initialized ? 'bg-green-500' : 'bg-gray-300'}`} />
                                <h4 className="text-sm font-medium text-gray-900">IVF-PQ Index</h4>
                            </div>
                            {!editingIvfPq && (
                                <button
                                    onClick={() => setEditingIvfPq(true)}
                                    className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
                                >
                                    Edit
                                </button>
                            )}
                        </div>
                        <div className="space-y-1">
                            <p className="text-xs text-gray-600">
                                Status: <span className="font-medium">{status?.ivfpq?.initialized ? 'Initialized' : 'Not initialized'}</span>
                            </p>
                            <p className="text-xs text-gray-600">
                                Vectors: <span className="font-mono font-medium">{status?.ivfpq?.vectorCount ?? 0}</span>
                            </p>

                            {editingIvfPq ? (
                                <div className="mt-3 space-y-2">
                                    <div className="flex items-center gap-2">
                                        <label className="text-xs text-gray-600 w-20">nlist:</label>
                                        <input
                                            type="number"
                                            min={1}
                                            max={10000}
                                            value={ivfPqNlist}
                                            onChange={(e) => setIvfPqNlist(Number(e.target.value))}
                                            className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900"
                                        />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <label className="text-xs text-gray-600 w-20">nprobe:</label>
                                        <input
                                            type="number"
                                            min={1}
                                            max={ivfPqNlist}
                                            value={ivfPqNprobe}
                                            onChange={(e) => setIvfPqNprobe(Number(e.target.value))}
                                            className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900"
                                        />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <label className="text-xs text-gray-600 w-20">m:</label>
                                        <input
                                            type="number"
                                            min={1}
                                            max={128}
                                            value={ivfPqM}
                                            onChange={(e) => setIvfPqM(Number(e.target.value))}
                                            className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900"
                                        />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <label className="text-xs text-gray-600 w-20">codebook:</label>
                                        <input
                                            type="number"
                                            min={1}
                                            max={1024}
                                            value={ivfPqCodebookSize}
                                            onChange={(e) => setIvfPqCodebookSize(Number(e.target.value))}
                                            className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900"
                                        />
                                    </div>
                                    <div className="flex gap-2 mt-2">
                                        <button
                                            onClick={handleRebuildIvfPq}
                                            disabled={rebuildIvfPqLoading}
                                            className="flex-1 px-2 py-1 text-xs font-medium text-white bg-gray-900 rounded hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                                        >
                                            {rebuildIvfPqLoading ? 'Rebuilding...' : 'Rebuild Index'}
                                        </button>
                                        <button
                                            onClick={handleCancelIvfPqEdit}
                                            disabled={rebuildIvfPqLoading}
                                            className="px-2 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:cursor-not-allowed transition-colors"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <p className="text-xs text-gray-600">
                                        nlist: <span className="font-mono font-medium">{status?.ivfpq?.nlist ?? '-'}</span>
                                    </p>
                                    <p className="text-xs text-gray-600">
                                        nprobe: <span className="font-mono font-medium">{status?.ivfpq?.nprobe ?? '-'}</span>
                                    </p>
                                    <p className="text-xs text-gray-600">
                                        m: <span className="font-mono font-medium">{status?.ivfpq?.m ?? '-'}</span>
                                    </p>
                                    <p className="text-xs text-gray-600">
                                        codebook: <span className="font-mono font-medium">{status?.ivfpq?.codebookSize ?? '-'}</span>
                                    </p>
                                </>
                            )}
                        </div>
                    </div>

                    {/* HNSW Index Status */}
                    <div className="border border-gray-200 rounded-lg p-3 bg-white">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${status?.hnsw?.initialized ? 'bg-green-500' : 'bg-gray-300'}`} />
                                <h4 className="text-sm font-medium text-gray-900">HNSW Index</h4>
                            </div>
                            {!editingHnsw && (
                                <button
                                    onClick={() => setEditingHnsw(true)}
                                    className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
                                >
                                    Edit
                                </button>
                            )}
                        </div>
                        <div className="space-y-1">
                            <p className="text-xs text-gray-600">
                                Status: <span className="font-medium">{status?.hnsw?.initialized ? 'Initialized' : 'Not initialized'}</span>
                            </p>
                            <p className="text-xs text-gray-600">
                                Vectors: <span className="font-mono font-medium">{status?.hnsw?.vectorCount ?? 0}</span>
                            </p>

                            {editingHnsw ? (
                                <div className="mt-3 space-y-2">
                                    <div className="flex items-center gap-2">
                                        <label className="text-xs text-gray-600 w-20">M:</label>
                                        <input
                                            type="number"
                                            min={2}
                                            max={128}
                                            value={hnswM}
                                            onChange={(e) => setHnswM(Number(e.target.value))}
                                            className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900"
                                        />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <label className="text-xs text-gray-600 w-20">efConstruct:</label>
                                        <input
                                            type="number"
                                            min={1}
                                            max={1000}
                                            value={hnswEfConstruction}
                                            onChange={(e) => setHnswEfConstruction(Number(e.target.value))}
                                            className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900"
                                        />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <label className="text-xs text-gray-600 w-20">efSearch:</label>
                                        <input
                                            type="number"
                                            min={1}
                                            max={1000}
                                            value={hnswEfSearch}
                                            onChange={(e) => setHnswEfSearch(Number(e.target.value))}
                                            className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900"
                                        />
                                    </div>
                                    <div className="flex gap-2 mt-2">
                                        <button
                                            onClick={handleRebuildHnsw}
                                            disabled={rebuildHnswLoading}
                                            className="flex-1 px-2 py-1 text-xs font-medium text-white bg-gray-900 rounded hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                                        >
                                            {rebuildHnswLoading ? 'Rebuilding...' : 'Rebuild Index'}
                                        </button>
                                        <button
                                            onClick={handleCancelHnswEdit}
                                            disabled={rebuildHnswLoading}
                                            className="px-2 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:cursor-not-allowed transition-colors"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <p className="text-xs text-gray-600">
                                        M: <span className="font-mono font-medium">{status?.hnsw?.m ?? '-'}</span>
                                    </p>
                                    <p className="text-xs text-gray-600">
                                        efConstruction: <span className="font-mono font-medium">{status?.hnsw?.efConstruction ?? '-'}</span>
                                    </p>
                                    <p className="text-xs text-gray-600">
                                        efSearch: <span className="font-mono font-medium">{status?.hnsw?.efSearch ?? '-'}</span>
                                    </p>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

