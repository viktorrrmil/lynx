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
                <div className="grid grid-cols-3 gap-4">
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
                </div>
            )}
        </div>
    );
};

