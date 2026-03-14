import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type JobStatus = 'queued' | 'running' | 'completed' | 'failed';

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
    kind: 'snapshot' | 'update' | 'error';
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
};

const formatCount = (value: number) => value.toLocaleString();

export const ActiveIndexingJobsPanel = () => {
    const [jobs, setJobs] = useState<Record<string, IndexingJob>>({});
    const [connectionState, setConnectionState] = useState<'connecting' | 'open' | 'closed' | 'error'>('connecting');
    const [socketError, setSocketError] = useState<string | null>(null);
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
                    setJobs((prev) => ({ ...prev, [job.id]: job }));
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
    }, []);

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
        return jobList.filter((job) => job.status === 'completed' || job.status === 'failed');
    }, [jobList]);

    const renderJobs = (list: IndexingJob[], emptyMessage: string) => {
        if (list.length === 0) {
            return <p className="text-xs text-slate-500 font-mono">{emptyMessage}</p>;
        }

        return (
            <div className="space-y-3">
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
                    const cardPadding = isZeroPoints ? 'p-3' : 'p-3';
                    const titleClass = isZeroPoints ? 'text-sm font-semibold text-slate-900' : 'text-sm font-semibold text-slate-900';
                    const metaClass = isZeroPoints ? 'text-xs text-slate-500 font-mono' : 'text-xs text-slate-500 font-mono';
                    const statusBadgeClass = isZeroPoints ? 'text-[10px]' : 'text-[11px]';
                    const progressTextClass = isZeroPoints ? 'text-xs text-slate-600 font-mono' : 'text-xs text-slate-600 font-mono';
                    const baseCardClass = isZeroPoints
                        ? 'border border-dashed border-slate-300/80 bg-slate-50/80'
                        : status.card;
                    const barClass = isZeroPoints
                        ? 'bg-slate-300'
                        : job.status === 'failed'
                          ? 'bg-gradient-to-r from-rose-500 to-rose-400'
                          : job.status === 'completed'
                            ? 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                            : 'bg-gradient-to-r from-cyan-500 to-blue-500';

                    return (
                        <div
                            key={job.id}
                            className={`border rounded-lg ${cardPadding} ${baseCardClass} transition-all duration-300 hover:border-slate-300 shadow-[0_12px_30px_rgba(15,23,42,0.08)]`}
                        >
                            <div className={`flex items-center justify-between ${isZeroPoints ? 'mb-2' : 'mb-2'}`}>
                                <div className="flex items-center gap-2">
                                    <span
                                        className={`w-2.5 h-2.5 rounded-full ${status.dot} ${isActive ? 'animate-pulse' : ''}`}
                                    />
                                    <div>
                                        <p className={titleClass}>Semantic Geo Index</p>
                                        <p className={metaClass}>Source: {job.source}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {isZeroPoints && (
                                        <span className="text-[10px] text-nowrap font-semibold uppercase text-slate-500 border border-slate-300 bg-white px-2.5 py-1 rounded-full font-mono">
                                            No points
                                        </span>
                                    )}
                                    <span className={`${statusBadgeClass} uppercase tracking-wide font-semibold ${status.text} font-mono`}>
                                        {status.label}
                                    </span>
                                </div>
                            </div>

                            <div className={isZeroPoints ? 'mb-2' : 'mb-2'}>
                                <div className={`flex items-center justify-between mb-1 ${progressTextClass}`}>
                                    <span>
                                        {hasTotal
                                            ? `${formatCount(indexed)} / ${formatCount(total)} points`
                                            : isCounting
                                              ? 'Counting points...'
                                              : '0 points'}
                                    </span>
                                    <span>{hasTotal ? `${progress}%` : isCounting ? '--' : '0%'}</span>
                                </div>
                                <div className="h-2 rounded-full bg-white border border-slate-200 overflow-hidden">
                                    <div
                                        className={`h-full rounded-full ${isActive ? 'animate-pulse' : ''} ${barClass}`}
                                        style={{ width: `${progress}%` }}
                                    />
                                </div>
                            </div>

                            <div className={`flex flex-wrap items-center justify-between gap-2 ${metaClass}`}>
                                <span>Started: {new Date(job.started_at).toLocaleString()}</span>
                                {job.finished_at && <span>Finished: {new Date(job.finished_at).toLocaleString()}</span>}
                            </div>

                            {job.error && (
                                <div className="mt-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-md p-2 font-mono">
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
        <div className="space-y-4">
            <div className="border border-slate-200 rounded-xl p-4 bg-gradient-to-br from-white via-slate-50 to-slate-100 text-slate-900 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
                <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                        <h3 className="text-sm font-semibold text-slate-900">Ongoing Indexing Jobs</h3>
                        <p className="text-xs text-slate-500 font-mono">
                            {ongoingJobs.length} active {ongoingJobs.length === 1 ? 'job' : 'jobs'} (queued or running).
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <span
                            className={`w-2 h-2 rounded-full ${
                                connectionState === 'open' ? 'bg-emerald-500' : connectionState === 'connecting' ? 'bg-amber-400' : 'bg-rose-500'
                            }`}
                        />
                        <span className="text-xs text-slate-500 capitalize font-mono">{connectionState}</span>
                    </div>
                </div>

                {socketError && (
                    <div className="mb-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-md p-2 font-mono">
                        {socketError}
                    </div>
                )}

                {renderJobs(ongoingJobs, 'No ongoing indexing jobs.')}
            </div>

            <div className="border border-slate-200 rounded-xl p-4 bg-gradient-to-br from-white via-slate-50 to-slate-100 text-slate-900 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
                <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                        <h3 className="text-sm font-semibold text-slate-900">Finished Indexing Jobs</h3>
                        <p className="text-xs text-slate-500 font-mono">
                            {finishedJobs.length} completed {finishedJobs.length === 1 ? 'job' : 'jobs'} (success or failed).
                        </p>
                    </div>
                </div>

                {renderJobs(finishedJobs, 'No finished indexing jobs yet.')}
            </div>
        </div>
    );
};
