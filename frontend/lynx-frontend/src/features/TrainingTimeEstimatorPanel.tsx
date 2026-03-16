import { useEffect, useRef, useState } from 'react';

import { recommendHnswParams, recommendIvfParams, recommendIvfPqParams } from './indexRecommendations';

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

interface InfoResponse {
    size: number;
    dimension: number;
}

type EstimateResult = {
    timeNs?: number;
    error?: string;
};

type EstimateRequest = {
    key: 'bf' | 'ivf' | 'ivfpq' | 'hnsw';
    url: string;
    body: Record<string, number>;
};

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

const formatDuration = (timeNs?: number) => {
    if (timeNs === undefined) {
        return '—';
    }
    const ms = timeNs / 1e6;
    const sec = timeNs / 1e9;
    return `${timeNs.toLocaleString()} ns · ${ms.toFixed(2)} ms · ${sec.toFixed(2)} s`;
};

const toNumber = (value: string) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

export const TrainingTimeEstimatorPanel = () => {
    const [dimension, setDimension] = useState(384);
    const [ivfNlist, setIvfNlist] = useState(350);
    const [ivfNprobe, setIvfNprobe] = useState(50);
    const [ivfPqNlist, setIvfPqNlist] = useState(350);
    const [ivfPqNprobe, setIvfPqNprobe] = useState(125);
    const [ivfPqM, setIvfPqM] = useState(32);
    const [ivfPqCodebookSize, setIvfPqCodebookSize] = useState(256);
    const [hnswM, setHnswM] = useState(32);
    const [hnswEfConstruction, setHnswEfConstruction] = useState(400);
    const [hnswEfSearch, setHnswEfSearch] = useState(300);
    const [estimating, setEstimating] = useState(false);
    const [estimateResults, setEstimateResults] = useState<Record<string, EstimateResult>>({
        bf: {},
        ivf: {},
        ivfpq: {},
        hnsw: {},
    });
    const [statusError, setStatusError] = useState<string | null>(null);
    const defaultsApplied = useRef(false);

    useEffect(() => {
        if (defaultsApplied.current) {
            return;
        }

        const fetchDefaults = async () => {
            try {
                const [infoResponse, statusResponse] = await Promise.all([
                    fetch('http://localhost:8080/info'),
                    fetch('http://localhost:8080/index_status'),
                ]);

                if (infoResponse.ok) {
                    const info: InfoResponse = await infoResponse.json();
                    if (info.dimension > 0) {
                        setDimension(info.dimension);
                    }
                }

                if (statusResponse.ok) {
                    const status: IndexStatus = await statusResponse.json();
                    const vectorCount = resolveVectorCount(status);
                    const ivfSuggestion = recommendIvfParams(vectorCount) ?? { nlist: 350, nprobe: 50 };
                    const ivfPqSuggestion = recommendIvfPqParams(vectorCount) ?? {
                        nlist: 350,
                        nprobe: 125,
                        m: 32,
                        codebookSize: 256,
                    };
                    const hnswSuggestion = recommendHnswParams(vectorCount) ?? {
                        m: 32,
                        efConstruction: 400,
                        efSearch: 300,
                    };

                    setIvfNlist(ivfSuggestion.nlist);
                    setIvfNprobe(ivfSuggestion.nprobe);
                    setIvfPqNlist(ivfPqSuggestion.nlist);
                    setIvfPqNprobe(ivfPqSuggestion.nprobe);
                    setIvfPqM(ivfPqSuggestion.m);
                    setIvfPqCodebookSize(ivfPqSuggestion.codebookSize);
                    setHnswM(hnswSuggestion.m);
                    setHnswEfConstruction(hnswSuggestion.efConstruction);
                    setHnswEfSearch(hnswSuggestion.efSearch);
                }

                defaultsApplied.current = true;
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Unknown error';
                setStatusError(message);
            }
        };

        fetchDefaults();
    }, []);

    const requestEstimate = async (url: string, body: Record<string, number>) => {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const payload = await response.json().catch(() => null);
            const fallback = `Failed to estimate training time (${response.status})`;
            throw new Error(payload?.error || fallback);
        }

        const payload = await response.json();
        if (typeof payload?.estimated_time_ns !== 'number') {
            throw new Error('Invalid estimate response');
        }

        return payload.estimated_time_ns as number;
    };

    const handleEstimateAll = async () => {
        setEstimating(true);
        setEstimateResults({ bf: {}, ivf: {}, ivfpq: {}, hnsw: {} });

        const requests: EstimateRequest[] = [
            {
                key: 'bf',
                url: 'http://localhost:8080/estimate/bf_training_time',
                body: { dimension },
            },
            {
                key: 'ivf',
                url: 'http://localhost:8080/estimate/ivf_training_time',
                body: { dimension, nlist: ivfNlist, nprobe: ivfNprobe },
            },
            {
                key: 'ivfpq',
                url: 'http://localhost:8080/estimate/ivf_pq_training_time',
                body: {
                    dimension,
                    nlist: ivfPqNlist,
                    nprobe: ivfPqNprobe,
                    m: ivfPqM,
                    codebook_size: ivfPqCodebookSize,
                },
            },
            {
                key: 'hnsw',
                url: 'http://localhost:8080/estimate/hnsw_training_time',
                body: {
                    dimension,
                    m: hnswM,
                    ef_construction: hnswEfConstruction,
                    ef_search: hnswEfSearch,
                },
            },
        ];

        const settled = await Promise.allSettled(
            requests.map((request) => requestEstimate(request.url, request.body))
        );

        const nextResults: Record<string, EstimateResult> = { bf: {}, ivf: {}, ivfpq: {}, hnsw: {} };
        settled.forEach((result, index) => {
            const key = requests[index].key;
            if (result.status === 'fulfilled') {
                nextResults[key] = { timeNs: result.value };
            } else {
                const message = result.reason instanceof Error ? result.reason.message : 'Failed to estimate time';
                nextResults[key] = { error: message };
            }
        });

        setEstimateResults(nextResults);
        setEstimating(false);
    };

    const panelClass =
        'border border-slate-200 rounded-xl p-4 bg-gradient-to-br from-white via-slate-50 to-slate-100 text-slate-900 shadow-[0_20px_60px_rgba(15,23,42,0.08)]';
    const titleClass = 'text-sm font-semibold text-slate-900 font-mono uppercase tracking-wide';
    const buttonClass =
        'px-3 py-1.5 text-xs font-semibold text-slate-50 bg-slate-900 rounded hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors font-mono';
    const inputClass =
        'w-full px-2 py-1 text-xs border border-slate-300 rounded bg-white/80 focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-400 font-mono';
    const labelClass = 'text-xs text-slate-600 font-mono';
    const cardClass =
        'border border-slate-200/80 rounded-lg p-3 bg-white/80 shadow-[0_8px_20px_rgba(15,23,42,0.08)]';

    return (
        <div className={panelClass}>
            <div className="flex items-center justify-between">
                <div>
                    <h3 className={titleClass}>Training Time Estimator</h3>
                    <p className="text-xs text-slate-500 font-mono">
                        Estimate build time for 1,000 vectors across all indexes.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={handleEstimateAll}
                    disabled={estimating}
                    className={buttonClass}
                >
                    {estimating ? 'Estimating...' : 'Estimate all indexes'}
                </button>
            </div>

            {statusError && (
                <div className="mt-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-md p-2 font-mono">
                    {statusError}
                </div>
            )}

            <div className="mt-4 space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2 border border-slate-200/80 rounded-lg p-3 bg-white/70 lg:col-span-2">
                        <div className="flex flex-col gap-1">
                            <label className={labelClass}>dimension:</label>
                            <input
                                type="number"
                                min={1}
                                value={dimension}
                                onChange={(e) => setDimension(toNumber(e.target.value))}
                                className={inputClass}
                            />
                        </div>
                        <p className="text-[11px] text-slate-500 font-mono">
                            Estimates use 1,000 normalized random vectors.
                        </p>
                    </div>

                    <div className={cardClass}>
                        <div className="flex items-center justify-between mb-2">
                            <h4 className="text-sm font-semibold text-slate-900 font-mono">BruteForce</h4>
                            <span className="text-xs text-slate-600 font-mono">
                                {estimateResults.bf?.error ?? formatDuration(estimateResults.bf?.timeNs)}
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 font-mono">No index parameters required.</p>
                    </div>

                    <div className={cardClass}>
                        <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-semibold text-slate-900 font-mono">IVF</h4>
                            <span className="text-xs text-slate-600 font-mono">
                                {estimateResults.ivf?.error ?? formatDuration(estimateResults.ivf?.timeNs)}
                            </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div className="flex flex-col gap-1">
                                <label className={labelClass}>nlist:</label>
                                <input
                                    type="number"
                                    min={1}
                                    max={10000}
                                    value={ivfNlist}
                                    onChange={(e) => setIvfNlist(toNumber(e.target.value))}
                                    className={inputClass}
                                />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className={labelClass}>nprobe:</label>
                                <input
                                    type="number"
                                    min={1}
                                    max={ivfNlist}
                                    value={ivfNprobe}
                                    onChange={(e) => setIvfNprobe(toNumber(e.target.value))}
                                    className={inputClass}
                                />
                            </div>
                        </div>
                    </div>

                    <div className={cardClass}>
                        <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-semibold text-slate-900 font-mono">IVF-PQ</h4>
                            <span className="text-xs text-slate-600 font-mono">
                                {estimateResults.ivfpq?.error ?? formatDuration(estimateResults.ivfpq?.timeNs)}
                            </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div className="flex flex-col gap-1">
                                <label className={labelClass}>nlist:</label>
                                <input
                                    type="number"
                                    min={1}
                                    max={10000}
                                    value={ivfPqNlist}
                                    onChange={(e) => setIvfPqNlist(toNumber(e.target.value))}
                                    className={inputClass}
                                />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className={labelClass}>nprobe:</label>
                                <input
                                    type="number"
                                    min={1}
                                    max={ivfPqNlist}
                                    value={ivfPqNprobe}
                                    onChange={(e) => setIvfPqNprobe(toNumber(e.target.value))}
                                    className={inputClass}
                                />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className={labelClass}>m:</label>
                                <input
                                    type="number"
                                    min={1}
                                    max={128}
                                    value={ivfPqM}
                                    onChange={(e) => setIvfPqM(toNumber(e.target.value))}
                                    className={inputClass}
                                />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className={labelClass}>codebook:</label>
                                <input
                                    type="number"
                                    min={1}
                                    max={1024}
                                    value={ivfPqCodebookSize}
                                    onChange={(e) => setIvfPqCodebookSize(toNumber(e.target.value))}
                                    className={inputClass}
                                />
                            </div>
                        </div>
                    </div>

                    <div className={cardClass}>
                        <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-semibold text-slate-900 font-mono">HNSW</h4>
                            <span className="text-xs text-slate-600 font-mono">
                                {estimateResults.hnsw?.error ?? formatDuration(estimateResults.hnsw?.timeNs)}
                            </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div className="flex flex-col gap-1">
                                <label className={labelClass}>M:</label>
                                <input
                                    type="number"
                                    min={2}
                                    max={128}
                                    value={hnswM}
                                    onChange={(e) => setHnswM(toNumber(e.target.value))}
                                    className={inputClass}
                                />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className={labelClass}>efConstruct:</label>
                                <input
                                    type="number"
                                    min={1}
                                    max={1000}
                                    value={hnswEfConstruction}
                                    onChange={(e) => setHnswEfConstruction(toNumber(e.target.value))}
                                    className={inputClass}
                                />
                            </div>
                            <div className="flex flex-col gap-1 sm:col-span-2">
                                <label className={labelClass}>efSearch:</label>
                                <input
                                    type="number"
                                    min={1}
                                    max={1000}
                                    value={hnswEfSearch}
                                    onChange={(e) => setHnswEfSearch(toNumber(e.target.value))}
                                    className={inputClass}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end">
                    <button
                        type="button"
                        onClick={handleEstimateAll}
                        disabled={estimating}
                        className={buttonClass}
                    >
                        {estimating ? 'Recalculating...' : 'Recalculate'}
                    </button>
                </div>
            </div>
        </div>
    );
};
