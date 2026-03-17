import { useEffect, useMemo, useRef, useState } from 'react';

type IngestionFileInput = {
    name: string;
    type: string;
    size_bytes: number;
};

type IngestionFileResult = {
    name: string;
    type: string;
    size_bytes: number;
    available: boolean;
    reason?: string;
};

type IngestionEvaluateResponse = {
    files: IngestionFileResult[];
    supported_extensions?: string[];
};

const formatBytes = (bytes: number) => {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / Math.pow(1024, index);
    return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
};

const estimateIngestion = (bytes: number) => {
    const throughputBytesPerSec = 25 * 1024 * 1024;
    const seconds = bytes / throughputBytesPerSec;
    if (!Number.isFinite(seconds) || seconds <= 0) return '—';
    if (seconds < 60) return `~${Math.ceil(seconds)}s`;
    const minutes = Math.floor(seconds / 60);
    const remainder = Math.ceil(seconds % 60);
    return `~${minutes}m ${remainder}s`;
};

const buildFileType = (name: string, fallbackType: string) => {
    const ext = name.split('.').pop()?.toLowerCase() ?? '';
    if (ext && ext !== name.toLowerCase()) {
        return ext;
    }
    if (fallbackType) {
        return fallbackType.toLowerCase();
    }
    return 'unknown';
};

const DatasetIngestionDialog = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
    const inputRef = useRef<HTMLInputElement | null>(null);
    const [files, setFiles] = useState<File[]>([]);
    const [evaluation, setEvaluation] = useState<IngestionFileResult[] | null>(null);
    const [selected, setSelected] = useState<Record<string, boolean>>({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!open) return;
        if (inputRef.current) {
            inputRef.current.setAttribute('webkitdirectory', '');
            inputRef.current.setAttribute('directory', '');
        }
    }, [open]);

    const handleFilesChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const nextFiles = event.target.files ? Array.from(event.target.files) : [];
        setFiles(nextFiles);
        setEvaluation(null);
        setSelected({});
        setError(null);
    };

    const handleEvaluate = async () => {
        if (files.length === 0) return;
        setLoading(true);
        setError(null);

        const payload: IngestionFileInput[] = files.map((file) => ({
            name: file.webkitRelativePath || file.name,
            type: buildFileType(file.name, file.type),
            size_bytes: file.size,
        }));

        try {
            const response = await fetch('http://localhost:8080/ingestion/evaluate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ files: payload }),
            });

            if (!response.ok) {
                const message = await response.text();
                throw new Error(message || 'Failed to evaluate dataset.');
            }

            const data: IngestionEvaluateResponse = await response.json();
            setEvaluation(data.files || []);
            const defaults: Record<string, boolean> = {};
            (data.files || []).forEach((item) => {
                defaults[item.name] = item.available;
            });
            setSelected(defaults);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to evaluate dataset.';
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    const toggleSelection = (name: string) => {
        setSelected((prev) => ({
            ...prev,
            [name]: !prev[name],
        }));
    };

    const selectedBytes = useMemo(() => {
        if (!evaluation) return 0;
        return evaluation.reduce((total, item) => {
            if (!selected[item.name]) return total;
            return total + item.size_bytes;
        }, 0);
    }, [evaluation, selected]);

    const handleBeginIngestion = () => {
        // Placeholder for ingestion action.
        console.log('Begin ingestion placeholder', selected);
    };

    if (!open) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-4xl mx-4 cli-panel-strong p-6">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h2 className="cli-title">Dataset Ingestion</h2>
                        <p className="cli-subtitle mt-2">
                            Select a folder, evaluate its files, and choose what to ingest.
                        </p>
                    </div>
                    <button className="cli-button font-mono" onClick={onClose}>
                        Close
                    </button>
                </div>

                <div className="mt-6 space-y-4">
                    <div className="cli-panel p-4">
                        <p className="cli-header mb-3">Folder Selection</p>
                        <input
                            ref={inputRef}
                            type="file"
                            multiple
                            onChange={handleFilesChange}
                            className="block w-full text-xs text-slate-600 font-mono
                                       file:mr-4 file:py-2 file:px-4
                                       file:rounded file:border file:border-slate-300
                                       file:text-xs file:font-semibold
                                       file:bg-white file:text-slate-700
                                       hover:file:bg-slate-50
                                       file:cursor-pointer cursor-pointer"
                            // Attribute is added via ref for folder selection.
                        />
                        <p className="text-xs text-slate-500 font-mono mt-2">
                            Choose a folder with .parquet or .txt files.
                        </p>
                        {files.length > 0 && (
                            <button
                                className="mt-4 cli-button-primary disabled:bg-slate-300 disabled:cursor-not-allowed"
                                onClick={handleEvaluate}
                                disabled={loading}
                            >
                                {loading ? 'Evaluating…' : 'Evaluate Dataset'}
                            </button>
                        )}
                        {error && (
                            <p className="text-xs text-rose-700 font-mono mt-2">{error}</p>
                        )}
                    </div>

                    {evaluation && (
                        <div className="cli-panel p-4">
                            <div className="flex items-center justify-between mb-3">
                                <p className="cli-header">Dataset Contents</p>
                                <span className="text-xs text-slate-500 font-mono">
                                    {evaluation.length} files detected
                                </span>
                            </div>
                            <div className="overflow-auto max-h-80 border border-slate-200 rounded-lg">
                                <table className="min-w-full text-xs font-mono">
                                    <thead className="bg-slate-50 sticky top-0">
                                        <tr>
                                            <th className="px-3 py-2 text-left text-slate-500 uppercase">Select</th>
                                            <th className="px-3 py-2 text-left text-slate-500 uppercase">Name</th>
                                            <th className="px-3 py-2 text-left text-slate-500 uppercase">Type</th>
                                            <th className="px-3 py-2 text-right text-slate-500 uppercase">Size</th>
                                            <th className="px-3 py-2 text-left text-slate-500 uppercase">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200">
                                        {evaluation.map((item) => {
                                            const disabled = !item.available;
                                            return (
                                                <tr key={item.name} className="hover:bg-slate-50">
                                                    <td className="px-3 py-2">
                                                        <input
                                                            type="checkbox"
                                                            checked={!!selected[item.name]}
                                                            disabled={disabled}
                                                            onChange={() => toggleSelection(item.name)}
                                                        />
                                                    </td>
                                                    <td className="px-3 py-2 text-slate-900">{item.name}</td>
                                                    <td className="px-3 py-2 text-slate-600">{item.type}</td>
                                                    <td className="px-3 py-2 text-right text-slate-600">
                                                        {formatBytes(item.size_bytes)}
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        {item.available ? (
                                                            <span className="text-emerald-700">Allowed</span>
                                                        ) : (
                                                            <span className="text-rose-700">Unsupported</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            <div className="flex items-center justify-between mt-4 flex-wrap gap-3">
                                <button
                                    className="cli-button-primary disabled:bg-slate-300 disabled:cursor-not-allowed"
                                    onClick={handleBeginIngestion}
                                    disabled={selectedBytes === 0}
                                >
                                    Begin ingestion
                                </button>
                                <span className="text-xs text-slate-500 font-mono">
                                    Estimated ingestion: {estimateIngestion(selectedBytes)}
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DatasetIngestionDialog;
