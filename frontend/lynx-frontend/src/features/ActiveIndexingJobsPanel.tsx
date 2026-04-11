import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type JobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

interface IndexingJob {
    id: string;
    type: string;
    status: JobStatus;
    total_points: number;
    indexed_points: number;
    source: string;
    started_at: string;
    finished_at?: string;
    error?: string;
}

interface IndexingJobEvent {
    kind: 'snapshot' | 'update' | 'removed' | 'error';
    job_id?: string;
    job?: IndexingJob;
    jobs?: IndexingJob[];
    message?: string;
}

const statusStyles: Record<JobStatus, { label: string; dot: string; text: string; card: string }> = {
    queued: {
        label: 'Queued',
        dot: 'bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.45)]',
        text: 'text-amber-700',
        card: 'border-amber-200/80 bg-amber-50/70',
    },
    running: {
        label: 'Running',
        dot: 'bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.45)]',
        text: 'text-cyan-700',
        card: 'border-cyan-200/80 bg-cyan-50/70',
    },
    completed: {
        label: 'Completed',
        dot: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.45)]',
        text: 'text-emerald-700',
        card: 'border-emerald-200/80 bg-emerald-50/70',
    },
    failed: {
        label: 'Failed',
        dot: 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.45)]',
        text: 'text-rose-700',
        card: 'border-rose-200/80 bg-rose-50/70',
    },
    cancelled: {
        label: 'Cancelled',
        dot: 'bg-slate-400 shadow-[0_0_6px_rgba(100,116,139,0.35)]',
        text: 'text-slate-600',
        card: 'border-slate-200/80 bg-slate-100/70',
    },
};

const formatCount = (value: number) => value.toLocaleString();

interface ActiveIndexingJobsPanelProps {
    onJobSettled?: () => void;
}

export const ActiveIndexingJobsPanel = ({ onJobSettled }: ActiveIndexingJobsPanelProps) => {
    const [jobs, setJobs] = useState<Record<string, IndexingJob>>({});
    const [connectionState, setConnectionState] = useState<'connecting' | 'open' | 'closed' | 'error'>('connecting');
    const [socketError, setSocketError] = useState<string | null>(null);
    const [isExpanded, setIsExpanded] = useState(true);
    const [activeTab, setActiveTab] = useState<'active' | 'finished'>('active');
    const [cancelingJobs, setCancelingJobs] = useState<Record<string, boolean>>({});
    const socketRef = useRef<WebSocket | null>(null);
    const reconnectTimerRef = useRef<number | null>(null);
    const connectRef = useRef<() => void>(() => {});

    const connect = useCallback(() => {
        if (socketRef.current) {
            socketRef.current.close();
        }

        setConnectionState('connecting');
        const socket = new WebSocket('ws://localhost:8080/api/v1/semantic-geo-search/index');
        socketRef.current = socket;

        socket.onopen = () => {
            setSocketError(null);
            setConnectionState('open');
        };

        socket.onmessage = (event) => {
            try {
                const payload: IndexingJobEvent = JSON.parse(event.data);
                if (payload.kind === 'snapshot' && payload.jobs) {
                    const nextJobs: Record<string, IndexingJob> = {};
                    payload.jobs.forEach((job) => {
                        nextJobs[job.id] = job;
                    });
                    setJobs(nextJobs);
                } else if (payload.kind === 'update' && payload.job) {
                    const job = payload.job;
                    let shouldNotifySettled = false;
                    setJobs((prev) => {
                        const previousStatus = prev[job.id]?.status;
                        const isTerminal = job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled';
                        if (isTerminal && previousStatus !== job.status) {
                            shouldNotifySettled = true;
                        }
                        return { ...prev, [job.id]: job };
                    });
                    if (shouldNotifySettled) {
                        onJobSettled?.();
                    }
                } else if (payload.kind === 'removed' && payload.job_id) {
                    const removedJobID = payload.job_id;
                    setJobs((prev) => {
                        if (!prev[removedJobID]) {
                            return prev;
                        }
                        const next = { ...prev };
                        delete next[removedJobID];
                        return next;
                    });
                } else if (payload.kind === 'error' && payload.message) {
                    setSocketError(payload.message);
                }
            } catch (err) {
                console.error('Failed to parse indexing job event', err);
            }
        };

        socket.onerror = () => {
            setConnectionState('error');
        };

        socket.onclose = () => {
            setConnectionState('closed');
            if (reconnectTimerRef.current) {
                window.clearTimeout(reconnectTimerRef.current);
            }
            reconnectTimerRef.current = window.setTimeout(() => {
                connectRef.current();
            }, 3000);
        };
    }, [onJobSettled]);

    useEffect(() => {
        connectRef.current = connect;
    }, [connect]);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            connectRef.current();
        }, 0);
        return () => {
            window.clearTimeout(timer);
            if (reconnectTimerRef.current) {
                window.clearTimeout(reconnectTimerRef.current);
            }
            socketRef.current?.close();
        };
    }, [connect]);

    const jobList = useMemo(() => {
        return Object.values(jobs).sort((a, b) => {
            const aTime = new Date(a.started_at).getTime();
            const bTime = new Date(b.started_at).getTime();
            return bTime - aTime;
        });
    }, [jobs]);

    const ongoingJobs = useMemo(() => {
        return jobList.filter((job) => job.status === 'queued' || job.status === 'running');
    }, [jobList]);

    const finishedJobs = useMemo(() => {
        return jobList.filter(
            (job) => (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') && job.total_points > 0
        );
    }, [jobList]);

    const visibleJobs = activeTab === 'active' ? ongoingJobs : finishedJobs;
    const emptyMessage = activeTab === 'active' ? 'No active indexing jobs.' : 'No finished indexing jobs yet.';

    const renderJobs = (list: IndexingJob[], listEmptyMessage: string) => {
        if (list.length === 0) {
            return <p className="text-xs text-slate-500 font-mono">{listEmptyMessage}</p>;
        }

        return (
            <div className="space-y-1.5">
                {list.map((job) => {
                    const total = job.total_points || 0;
                    const indexed = job.indexed_points || 0;
                    const isZeroPoints = total === 0 && job.status === 'completed';
                    const hasTotal = total > 0;
                    const isCounting = !hasTotal && (job.status === 'running' || job.status === 'queued');
                    const progress = hasTotal
                        ? Math.min(100, Math.floor((indexed / total) * 100))
                        : isZeroPoints
                          ? 0
                          : job.status === 'completed'
                            ? 100
                            : 0;
                    const status = statusStyles[job.status];
                    const isActive = job.status === 'running' || job.status === 'queued';
                    const baseCardClass = isZeroPoints
                        ? 'border border-dashed border-slate-300/80 bg-slate-50/80'
                        : status.card;
                    const barClass = isZeroPoints
                        ? 'bg-slate-300'
                        : job.status === 'failed'
                          ? 'bg-gradient-to-r from-rose-500 to-rose-400'
                          : job.status === 'cancelled'
                            ? 'bg-gradient-to-r from-slate-500 to-slate-400'
                          : job.status === 'completed'
                            ? 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                            : 'bg-gradient-to-r from-cyan-500 to-blue-500';
                    const isCanceling = !!cancelingJobs[job.id];

                    return (
                        <div
                            key={job.id}
                            className={`border rounded-md p-2 ${baseCardClass} transition-all duration-300 hover:border-slate-300 shadow-[0_4px_12px_rgba(15,23,42,0.06)]`}
                        >
                            <div className="mb-1.5 flex items-center justify-between gap-2">
                                <div className="flex min-w-0 items-center gap-2">
                                    <span className={`h-2 w-2 rounded-full ${status.dot} ${isActive ? 'animate-pulse' : ''}`} />
                                    <div className="min-w-0">
                                        <p className="truncate text-xs font-semibold text-slate-900">Semantic Geo Index</p>
                                        <p className="truncate text-[11px] text-slate-500 font-mono">Source: {job.source}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {isActive && (
                                        <button
                                            type="button"
                                            onClick={async () => {
                                                if (isCanceling) {
                                                    return;
                                                }
                                                setCancelingJobs((prev) => ({ ...prev, [job.id]: true }));
                                                try {
                                                    const response = await fetch('http://localhost:8080/api/v1/semantic-geo-search/index/cancel', {
                                                        method: 'POST',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({ job_id: job.id }),
                                                    });
                                                    if (!response.ok) {
                                                        const payload = await response.json().catch(() => null);
                                                        throw new Error(payload?.error || `Cancel failed (${response.status})`);
                                                    }
                                                } catch (err) {
                                                    const message = err instanceof Error ? err.message : 'Failed to cancel job';
                                                    setSocketError(message);
                                                } finally {
                                                    setCancelingJobs((prev) => {
                                                        const next = { ...prev };
                                                        delete next[job.id];
                                                        return next;
                                                    });
                                                }
                                            }}
                                            disabled={isCanceling}
                                            className="rounded border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-700 transition-colors hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60 font-mono"
                                        >
                                            {isCanceling ? 'Stopping...' : 'Stop'}
                                        </button>
                                    )}
                                    {isZeroPoints && (
                                        <span className="rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-500 font-mono">
                                            No points
                                        </span>
                                    )}
                                    <span className={`text-[10px] uppercase tracking-wide font-semibold ${status.text} font-mono`}>
                                        {status.label}
                                    </span>
                                </div>
                            </div>

                            <div className="mb-1.5">
                                <div className="mb-1 flex items-center justify-between text-[11px] text-slate-600 font-mono">
                                    <span>
                                        {hasTotal
                                            ? `${formatCount(indexed)} / ${formatCount(total)} points`
                                            : isCounting
                                              ? 'Counting points...'
                                              : '0 points'}
                                    </span>
                                    <span>{hasTotal ? `${progress}%` : isCounting ? '--' : '0%'}</span>
                                </div>
                                <div className="h-1.5 overflow-hidden rounded-full border border-slate-200 bg-white">
                                    <div
                                        className={`h-full rounded-full ${isActive ? 'animate-pulse' : ''} ${barClass}`}
                                        style={{ width: `${progress}%` }}
                                    />
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 font-mono">
                                <span>Started: {new Date(job.started_at).toLocaleString()}</span>
                                {job.finished_at && <span>Finished: {new Date(job.finished_at).toLocaleString()}</span>}
                            </div>

                            {job.error && job.status !== 'cancelled' && (
                                <div className="mt-2 rounded-md border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700 font-mono">
                                    {job.error}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="border border-slate-200 rounded-xl p-3 bg-gradient-to-br from-white via-slate-50 to-slate-100 text-slate-900 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-slate-900">Indexing Jobs</h3>
                    <p className="text-xs text-slate-500 font-mono">
                        {ongoingJobs.length} active · {finishedJobs.length} finished
                    </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    <span
                        className={`h-2 w-2 rounded-full ${
                            connectionState === 'open' ? 'bg-emerald-500' : connectionState === 'connecting' ? 'bg-amber-400' : 'bg-rose-500'
                        }`}
                    />
                    <span className="text-xs capitalize text-slate-500 font-mono">{connectionState}</span>
                    <button
                        type="button"
                        onClick={() => setIsExpanded((prev) => !prev)}
                        className="text-xs font-semibold text-slate-600 hover:text-slate-800 font-mono"
                    >
                        {isExpanded ? 'Hide' : 'Show'}
                    </button>
                </div>
            </div>

            {socketError && (
                <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700 font-mono">
                    {socketError}
                </div>
            )}

            {isExpanded ? (
                <div className="mt-3 space-y-3">
                    <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white/80 p-1 shadow-[0_4px_12px_rgba(15,23,42,0.04)]">
                        <button
                            type="button"
                            onClick={() => setActiveTab('active')}
                            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold font-mono transition-colors ${
                                activeTab === 'active'
                                    ? 'bg-slate-900 text-white shadow-sm'
                                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                            }`}
                        >
                            Active ({ongoingJobs.length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('finished')}
                            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold font-mono transition-colors ${
                                activeTab === 'finished'
                                    ? 'bg-slate-900 text-white shadow-sm'
                                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                            }`}
                        >
                            Finished ({finishedJobs.length})
                        </button>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                        <span>Showing {activeTab === 'active' ? 'active' : 'finished'} jobs only</span>
                        <span>{visibleJobs.length} total</span>
                    </div>

                    <p className="text-[11px] text-slate-500 font-mono">
                        Files/jobs with no points to index are automatically removed and not shown here.
                    </p>

                    {renderJobs(visibleJobs, emptyMessage)}
                </div>
            ) : (
                <p className="mt-3 text-xs text-slate-500 font-mono">Jobs hidden. Toggle to view details.</p>
            )}
        </div>
    );
};
