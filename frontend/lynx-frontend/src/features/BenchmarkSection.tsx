import {useState} from 'react';

interface BenchmarkResult {
    query: string;
    recall_at_k: number;
    speedup_x: number;
    ivf_time_ms: number;
    bf_time_ms: number;
}

interface BenchmarkSummary {
    num_queries: number;
    mean_recall: number;
    median_recall: number;
    min_recall: number;
    max_recall: number;
    stddev_recall: number;
    mean_speedup: number;
    results: BenchmarkResult[];
}

interface IVFParamResult {
    nlist: number;
    nprobe: number;
    mean_recall: number;
    mean_latency_ms: number;
    speedup: number;
}

interface IVFParamSweepResponse {
    results: IVFParamResult[];
    best_recall?: IVFParamResult;
    best_speedup?: IVFParamResult;
    best_latency?: IVFParamResult;
    best_balanced?: IVFParamResult;
}

const DEFAULT_QUERIES = [
    "tree", "cattle", "lord", "mountain", "ocean",
    "building", "computer", "happiness", "science", "art",
    "technology", "nature", "history", "music", "food",
].join(", ");

const BenchmarkSection = () => {
    const [queries, setQueries] = useState(DEFAULT_QUERIES);
    const [topK, setTopK] = useState(10);
    const [loading, setLoading] = useState(false);
    const [summary, setSummary] = useState<BenchmarkSummary | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [showAllResults, setShowAllResults] = useState(false);
    const [copied, setCopied] = useState(false);

    // IVF Parameter Sweep state
    const [showParamSweep, setShowParamSweep] = useState(false);
    const [nlistValues, setNlistValues] = useState("4, 8, 16, 32, 64");
    const [nprobeValues, setNprobeValues] = useState("1, 2, 4, 8, 16");
    const [sweepTopK, setSweepTopK] = useState(10);
    const [sweepQueries, setSweepQueries] = useState(DEFAULT_QUERIES);
    const [sweepLoading, setSweepLoading] = useState(false);
    const [sweepResults, setSweepResults] = useState<IVFParamSweepResponse | null>(null);
    const [sweepError, setSweepError] = useState<string | null>(null);
    const [sweepCopied, setSweepCopied] = useState(false);

    const handleCopyStats = () => {
        if (!summary) return;

        const statsText = `
Benchmark Results
════════════════════════════════════════

Summary
────────────────────────────────────────
Queries Tested:  ${summary.num_queries ?? 0}
Top K:           ${topK}

Recall@k Statistics
────────────────────────────────────────
Mean Recall:     ${((summary.mean_recall ?? 0) * 100).toFixed(2)}%
Median Recall:   ${((summary.median_recall ?? 0) * 100).toFixed(2)}%
Min Recall:      ${((summary.min_recall ?? 0) * 100).toFixed(2)}%
Max Recall:      ${((summary.max_recall ?? 0) * 100).toFixed(2)}%
Std Dev:         ±${((summary.stddev_recall ?? 0) * 100).toFixed(2)}%

Performance
────────────────────────────────────────
Mean Speedup:    ${(summary.mean_speedup ?? 0).toFixed(2)}x

Individual Results
────────────────────────────────────────
${summary.results?.map(r =>
            `• ${r.query}
  Recall: ${((r.recall_at_k ?? 0) * 100).toFixed(2)}% | Speedup: ${(r.speedup_x ?? 0).toFixed(2)}x | BF: ${(r.bf_time_ms ?? 0).toFixed(2)}ms | IVF: ${(r.ivf_time_ms ?? 0).toFixed(2)}ms`
        ).join('\n') ?? ''}
`.trim();

        navigator.clipboard.writeText(statsText).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    const handleRunBenchmark = async () => {
        const queryList = queries
            .split(',')
            .map(q => q.trim())
            .filter(q => q.length > 0);

        if (queryList.length === 0) {
            setError('Please enter at least one query');
            return;
        }

        setLoading(true);
        setError(null);
        setSummary(null);

        try {
            const response = await fetch('http://localhost:8080/benchmark', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    num_queries: queryList.length,
                    queries: queryList,
                    top_k: topK
                }),
            });

            if (response.ok) {
                const data = await response.json();
                setSummary(data.summary);
            } else {
                setError('Benchmark failed. Please try again.');
            }
        } catch (err) {
            console.error('Benchmark error:', err);
            setError('Failed to connect to backend.');
        } finally {
            setLoading(false);
        }
    };

    const getRecallColor = (recall: number) => {
        if (recall >= 0.95) return 'text-green-600';
        if (recall >= 0.8) return 'text-yellow-600';
        return 'text-red-600';
    };

    const getSpeedupColor = (speedup: number) => {
        if (speedup >= 5) return 'text-green-600';
        if (speedup >= 2) return 'text-yellow-600';
        return 'text-gray-600';
    };

    const handleRunParamSweep = async () => {
        const nlistArr = nlistValues.split(',').map(v => parseInt(v.trim())).filter(v => !isNaN(v) && v > 0);
        const nprobeArr = nprobeValues.split(',').map(v => parseInt(v.trim())).filter(v => !isNaN(v) && v > 0);
        const queryList = sweepQueries.split(',').map(q => q.trim()).filter(q => q.length > 0);

        if (nlistArr.length === 0 || nprobeArr.length === 0) {
            setSweepError('Please enter valid nlist and nprobe values');
            return;
        }

        if (queryList.length === 0) {
            setSweepError('Please enter at least one query');
            return;
        }

        setSweepLoading(true);
        setSweepError(null);
        setSweepResults(null);

        try {
            const response = await fetch('http://localhost:8080/benchmark/ivf_param_sweep', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    nlist_values: nlistArr,
                    nprobe_values: nprobeArr,
                    queries: queryList,
                    top_k: sweepTopK
                }),
            });

            if (response.ok) {
                const data = await response.json();
                setSweepResults(data);
            } else {
                setSweepError('Parameter sweep failed. Please try again.');
            }
        } catch (err) {
            console.error('Parameter sweep error:', err);
            setSweepError('Failed to connect to backend.');
        } finally {
            setSweepLoading(false);
        }
    };

    const handleCopySweepResults = () => {
        if (!sweepResults) return;

        const formatConfig = (label: string, config: IVFParamResult | undefined) => {
            if (!config) return '';
            return `${label}
  nlist: ${config.nlist}, nprobe: ${config.nprobe}
  Recall: ${((config.mean_recall ?? 0) * 100).toFixed(2)}%
  Latency: ${(config.mean_latency_ms ?? 0).toFixed(2)}ms
  Speedup: ${(config.speedup ?? 0).toFixed(2)}x`;
        };

        const statsText = `
IVF Parameter Sweep Results
════════════════════════════════════════

Optimal Configurations
────────────────────────────────────────
${formatConfig('Best Recall', sweepResults.best_recall)}

${formatConfig('Best Speedup', sweepResults.best_speedup)}

${formatConfig('Best Latency', sweepResults.best_latency)}

${formatConfig('Best Balanced', sweepResults.best_balanced)}

All Results
────────────────────────────────────────
${sweepResults.results?.map(r =>
            `nlist=${r.nlist}, nprobe=${r.nprobe}: Recall=${((r.mean_recall ?? 0) * 100).toFixed(2)}%, Latency=${(r.mean_latency_ms ?? 0).toFixed(2)}ms, Speedup=${(r.speedup ?? 0).toFixed(2)}x`
        ).join('\n') ?? ''}
`.trim();

        navigator.clipboard.writeText(statsText).then(() => {
            setSweepCopied(true);
            setTimeout(() => setSweepCopied(false), 2000);
        });
    };

    // Calculate chart dimensions and positions for scatter plot
    const getChartData = () => {
        if (!sweepResults?.results || sweepResults.results.length === 0) return null;

        const results = sweepResults.results;
        const minLatency = Math.min(...results.map(r => r.mean_latency_ms ?? 0));
        const maxLatency = Math.max(...results.map(r => r.mean_latency_ms ?? 0));
        const minRecall = Math.min(...results.map(r => r.mean_recall ?? 0));
        const maxRecall = Math.max(...results.map(r => r.mean_recall ?? 0));

        // Add padding
        const latencyPadding = (maxLatency - minLatency) * 0.1 || 0.1;
        const recallPadding = (maxRecall - minRecall) * 0.1 || 0.05;

        return {
            results,
            minLatency: Math.max(0, minLatency - latencyPadding),
            maxLatency: maxLatency + latencyPadding,
            minRecall: Math.max(0, minRecall - recallPadding),
            maxRecall: Math.min(1, maxRecall + recallPadding),
        };
    };

    return (
        <div className="space-y-6">
            {/* Query Input Section */}
            <div className="border border-gray-200 rounded-lg p-4 bg-white">
                <h3 className="text-sm font-medium text-gray-900 mb-3">Test Queries</h3>
                <p className="text-xs text-gray-500 mb-3">
                    Enter comma-separated queries to benchmark IVF index performance against BruteForce.
                </p>
                <textarea
                    value={queries}
                    onChange={(e) => setQueries(e.target.value)}
                    placeholder="Enter queries separated by commas..."
                    rows={4}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded
                             focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900
                             resize-none"
                />
                <div className="flex justify-between items-center mt-3">
                    <span className="text-xs text-gray-500">
                        {queries.split(',').filter(q => q.trim().length > 0).length} queries
                    </span>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                            <label className="text-xs text-gray-600">top_k:</label>
                            <input
                                type="number"
                                min={1}
                                max={1000}
                                value={topK}
                                onChange={(e) => setTopK(Number(e.target.value))}
                                className="w-20 px-2 py-1.5 text-sm border border-gray-300 rounded
                                         focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900"
                            />
                        </div>
                        <button
                            onClick={handleRunBenchmark}
                            disabled={loading}
                            className="px-6 py-2 text-sm font-medium text-white bg-gray-900
                                     rounded hover:bg-gray-800 disabled:bg-gray-300
                                     disabled:cursor-not-allowed transition-colors"
                        >
                            {loading ? 'Running Benchmark...' : 'Run Benchmark'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Error Display */}
            {error && (
                <div className="border border-red-200 rounded-lg p-4 bg-red-50">
                    <p className="text-sm text-red-700">{error}</p>
                </div>
            )}

            {/* Benchmark Summary */}
            {summary && (
                <div className="space-y-4">
                    {/* Summary Stats */}
                    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-medium text-gray-900">Benchmark Summary</h3>
                            <button
                                onClick={handleCopyStats}
                                className={`px-3 py-1.5 text-xs font-medium rounded border transition-colors ${
                                    copied
                                        ? 'bg-green-600 text-white border-green-600'
                                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                }`}
                            >
                                {copied ? 'Copied!' : 'Copy Stats'}
                            </button>
                        </div>
                        <div className="grid grid-cols-4 gap-4">
                            <div className="bg-white border border-gray-200 rounded-lg p-3">
                                <p className="text-xs text-gray-500 mb-1">Queries Tested</p>
                                <p className="text-lg font-mono font-medium text-gray-900">
                                    {summary.num_queries ?? 0}
                                </p>
                            </div>
                            <div className="bg-white border border-gray-200 rounded-lg p-3">
                                <p className="text-xs text-gray-500 mb-1">Mean Recall@k</p>
                                <p className={`text-lg font-mono font-medium ${getRecallColor(summary.mean_recall ?? 0)}`}>
                                    {((summary.mean_recall ?? 0) * 100).toFixed(2)}%
                                </p>
                            </div>
                            <div className="bg-white border border-gray-200 rounded-lg p-3">
                                <p className="text-xs text-gray-500 mb-1">Median Recall@k</p>
                                <p className={`text-lg font-mono font-medium ${getRecallColor(summary.median_recall ?? 0)}`}>
                                    {((summary.median_recall ?? 0) * 100).toFixed(2)}%
                                </p>
                            </div>
                            <div className="bg-white border border-gray-200 rounded-lg p-3">
                                <p className="text-xs text-gray-500 mb-1">Mean Speedup</p>
                                <p className={`text-lg font-mono font-medium ${getSpeedupColor(summary.mean_speedup ?? 0)}`}>
                                    {(summary.mean_speedup ?? 0).toFixed(2)}x
                                </p>
                            </div>
                        </div>

                        {/* Recall Distribution */}
                        <div className="mt-4 grid grid-cols-3 gap-4">
                            <div className="bg-white border border-gray-200 rounded-lg p-3">
                                <p className="text-xs text-gray-500 mb-1">Min Recall</p>
                                <p className={`text-sm font-mono font-medium ${getRecallColor(summary.min_recall ?? 0)}`}>
                                    {((summary.min_recall ?? 0) * 100).toFixed(2)}%
                                </p>
                            </div>
                            <div className="bg-white border border-gray-200 rounded-lg p-3">
                                <p className="text-xs text-gray-500 mb-1">Max Recall</p>
                                <p className={`text-sm font-mono font-medium ${getRecallColor(summary.max_recall ?? 0)}`}>
                                    {((summary.max_recall ?? 0) * 100).toFixed(2)}%
                                </p>
                            </div>
                            <div className="bg-white border border-gray-200 rounded-lg p-3">
                                <p className="text-xs text-gray-500 mb-1">Std Dev</p>
                                <p className="text-sm font-mono font-medium text-gray-600">
                                    ±{((summary.stddev_recall ?? 0) * 100).toFixed(2)}%
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Individual Results */}
                    <div className="border border-gray-200 rounded-lg bg-white">
                        <div
                            className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                            onClick={() => setShowAllResults(!showAllResults)}
                        >
                            <h3 className="text-sm font-medium text-gray-900">
                                Individual Results ({summary.results?.length})
                            </h3>
                            <span className="text-xs text-gray-500">
                                {showAllResults ? '▲ Hide' : '▼ Show'}
                            </span>
                        </div>

                        {showAllResults && (
                            <div className="border-t border-gray-200">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Query</th>
                                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Recall@k</th>
                                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Speedup</th>
                                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">BF
                                            Time
                                        </th>
                                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">IVF
                                            Time
                                        </th>
                                    </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                    {summary.results?.map((result, index) => (
                                        <tr key={index} className="hover:bg-gray-50">
                                            <td className="px-4 py-2 text-gray-900 max-w-xs truncate"
                                                title={result.query}>
                                                {result.query}
                                            </td>
                                            <td className={`px-4 py-2 text-right font-mono ${getRecallColor(result.recall_at_k ?? 0)}`}>
                                                {((result.recall_at_k ?? 0) * 100).toFixed(2)}%
                                            </td>
                                            <td className={`px-4 py-2 text-right font-mono ${getSpeedupColor(result.speedup_x ?? 0)}`}>
                                                {(result.speedup_x ?? 0).toFixed(2)}x
                                            </td>
                                            <td className="px-4 py-2 text-right font-mono text-gray-600">
                                                {(result.bf_time_ms ?? 0).toFixed(2)}ms
                                            </td>
                                            <td className="px-4 py-2 text-right font-mono text-gray-600">
                                                {(result.ivf_time_ms ?? 0).toFixed(2)}ms
                                            </td>
                                        </tr>
                                    ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Visual Recall Bar */}
                    <div className="border border-gray-200 rounded-lg p-4 bg-white">
                        <h3 className="text-sm font-medium text-gray-900 mb-3">Recall Distribution</h3>
                        <div className="space-y-2">
                            {summary.results?.map((result, index) => {
                                const value = result.recall_at_k ?? 0;
                                const barColor = value >= 0.95 ? 'bg-green-500' : value >= 0.8 ? 'bg-amber-400' : 'bg-rose-500';
                                const textColor = value >= 0.95 ? 'text-green-600' : value >= 0.8 ? 'text-amber-500' : 'text-rose-600';

                                return (
                                    <div key={index} className="flex items-center gap-2 sm:gap-3">
                                        <span className="text-xs text-gray-500 w-20 sm:w-28 md:w-32 truncate flex-shrink-0" title={result.query}>
                                            {result.query}
                                        </span>
                                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden min-w-0">
                                            <div
                                                className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                                                style={{ width: `${value * 100}%` }}
                                            />
                                        </div>
                                        <span className={`text-xs font-mono w-12 text-right font-medium flex-shrink-0 ${textColor}`}>
                                            {(value * 100).toFixed(1)}%
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                </div>
            )}

            {/* IVF Parameter Tuning Section */}
            <div className="border border-gray-200 rounded-lg bg-white">
                <div
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => setShowParamSweep(!showParamSweep)}
                >
                    <div>
                        <h3 className="text-sm font-medium text-gray-900">IVF Parameter Tuning</h3>
                        <p className="text-xs text-gray-500 mt-1">
                            Find optimal nlist and nprobe combinations for your dataset
                        </p>
                    </div>
                    <span className="text-gray-400">
                        {showParamSweep ? '▲' : '▼'}
                    </span>
                </div>

                {showParamSweep && (
                    <div className="border-t border-gray-200 p-4 space-y-4">
                        {/* Parameter Inputs */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                    nlist values (comma-separated)
                                </label>
                                <input
                                    type="text"
                                    value={nlistValues}
                                    onChange={(e) => setNlistValues(e.target.value)}
                                    placeholder="4, 8, 16, 32, 64"
                                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded
                                             focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                    nprobe values (comma-separated)
                                </label>
                                <input
                                    type="text"
                                    value={nprobeValues}
                                    onChange={(e) => setNprobeValues(e.target.value)}
                                    placeholder="1, 2, 4, 8, 16"
                                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded
                                             focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                Test queries (comma-separated)
                            </label>
                            <input
                                type="text"
                                value={sweepQueries}
                                onChange={(e) => setSweepQueries(e.target.value)}
                                placeholder="tree, ocean, science..."
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded
                                         focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900"
                            />
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <label className="text-xs text-gray-600">top_k:</label>
                                <input
                                    type="number"
                                    min={1}
                                    max={1000}
                                    value={sweepTopK}
                                    onChange={(e) => setSweepTopK(Number(e.target.value))}
                                    className="w-20 px-2 py-1.5 text-sm border border-gray-300 rounded
                                             focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900"
                                />
                            </div>
                            <button
                                onClick={handleRunParamSweep}
                                disabled={sweepLoading}
                                className="px-6 py-2 text-sm font-medium text-white bg-gray-900
                                         rounded hover:bg-gray-800 disabled:bg-gray-300
                                         disabled:cursor-not-allowed transition-colors"
                            >
                                {sweepLoading ? 'Running Sweep...' : 'Run Parameter Sweep'}
                            </button>
                        </div>

                        {/* Sweep Error */}
                        {sweepError && (
                            <div className="border border-red-200 rounded-lg p-3 bg-red-50">
                                <p className="text-sm text-red-700">{sweepError}</p>
                            </div>
                        )}

                        {/* Sweep Results */}
                        {sweepResults && (
                            <div className="space-y-4">
                                {/* Copy Button */}
                                <div className="flex justify-end">
                                    <button
                                        onClick={handleCopySweepResults}
                                        className={`px-3 py-1.5 text-xs font-medium rounded border transition-colors ${
                                            sweepCopied
                                                ? 'bg-green-600 text-white border-green-600'
                                                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                        }`}
                                    >
                                        {sweepCopied ? 'Copied!' : 'Copy All Results'}
                                    </button>
                                </div>

                                {/* Optimal Configurations Grid */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {/* Best Recall */}
                                    {sweepResults.best_recall && (
                                        <div className="border rounded-lg p-3">
                                            <div className="flex items-center gap-2 mb-2">
                                                <h4 className="text-sm text-green-800">Best Recall</h4>
                                            </div>
                                            <div className="grid grid-cols-4 gap-2">
                                                <div>
                                                    <p className="text-[10px] text-gray-500 uppercase">nlist</p>
                                                    <p className="text-sm font-mono font-medium text-gray-900">{sweepResults.best_recall.nlist}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] text-gray-500 uppercase">nprobe</p>
                                                    <p className="text-sm font-mono font-medium text-gray-900">{sweepResults.best_recall.nprobe}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] text-gray-500 uppercase">Recall</p>
                                                    <p className="text-sm font-mono font-semibold text-green-600">{((sweepResults.best_recall.mean_recall ?? 0) * 100).toFixed(1)}%</p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] text-gray-500 uppercase">Latency</p>
                                                    <p className="text-sm font-mono text-gray-600">{(sweepResults.best_recall.mean_latency_ms ?? 0).toFixed(2)}ms</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Best Speedup */}
                                    {sweepResults.best_speedup && (
                                        <div className="border rounded-lg p-3">
                                            <div className="flex items-center gap-2 mb-2">
                                                <h4 className="text-sm text-blue-800">Best Speedup</h4>
                                            </div>
                                            <div className="grid grid-cols-4 gap-2">
                                                <div>
                                                    <p className="text-[10px] text-gray-500 uppercase">nlist</p>
                                                    <p className="text-sm font-mono font-medium text-gray-900">{sweepResults.best_speedup.nlist}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] text-gray-500 uppercase">nprobe</p>
                                                    <p className="text-sm font-mono font-medium text-gray-900">{sweepResults.best_speedup.nprobe}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] text-gray-500 uppercase">Speedup</p>
                                                    <p className="text-sm font-mono font-semibold text-blue-600">{(sweepResults.best_speedup.speedup ?? 0).toFixed(2)}x</p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] text-gray-500 uppercase">Recall</p>
                                                    <p className="text-sm font-mono text-gray-600">{((sweepResults.best_speedup.mean_recall ?? 0) * 100).toFixed(1)}%</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Best Latency */}
                                    {sweepResults.best_latency && (
                                        <div className="border rounded-lg p-3">
                                            <div className="flex items-center gap-2 mb-2">
                                                <h4 className="text-sm text-amber-800">Best Latency</h4>
                                            </div>
                                            <div className="grid grid-cols-4 gap-2">
                                                <div>
                                                    <p className="text-[10px] text-gray-500 uppercase">nlist</p>
                                                    <p className="text-sm font-mono font-medium text-gray-900">{sweepResults.best_latency.nlist}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] text-gray-500 uppercase">nprobe</p>
                                                    <p className="text-sm font-mono font-medium text-gray-900">{sweepResults.best_latency.nprobe}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] text-gray-500 uppercase">Latency</p>
                                                    <p className="text-sm font-mono font-semibold text-amber-600">{(sweepResults.best_latency.mean_latency_ms ?? 0).toFixed(2)}ms</p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] text-gray-500 uppercase">Recall</p>
                                                    <p className="text-sm font-mono text-gray-600">{((sweepResults.best_latency.mean_recall ?? 0) * 100).toFixed(1)}%</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Best Balanced */}
                                    {sweepResults.best_balanced && (
                                        <div className="border rounded-lg p-3">
                                            <div className="flex items-center gap-2 mb-2">
                                                <h4 className="text-sm text-purple-800">Best Balanced</h4>
                                            </div>
                                            <div className="grid grid-cols-4 gap-2">
                                                <div>
                                                    <p className="text-[10px] text-gray-500 uppercase">nlist</p>
                                                    <p className="text-sm font-mono font-medium text-gray-900">{sweepResults.best_balanced.nlist}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] text-gray-500 uppercase">nprobe</p>
                                                    <p className="text-sm font-mono font-medium text-gray-900">{sweepResults.best_balanced.nprobe}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] text-gray-500 uppercase">Recall</p>
                                                    <p className="text-sm font-mono font-semibold text-purple-600">{((sweepResults.best_balanced.mean_recall ?? 0) * 100).toFixed(1)}%</p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] text-gray-500 uppercase">Speedup</p>
                                                    <p className="text-sm font-mono text-gray-600">{(sweepResults.best_balanced.speedup ?? 0).toFixed(2)}x</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Scatter Plot Chart */}
                                {getChartData() && (
                                    <div className="border border-gray-200 rounded-xl p-5 bg-white shadow-sm">
                                        <h4 className="text-sm font-medium text-gray-900 mb-4">
                                            Recall vs Latency Trade-off
                                        </h4>
                                        <div className="relative">
                                            <svg viewBox="0 0 420 280" className="w-full h-72">
                                                {/* Background */}
                                                <rect x="50" y="20" width="350" height="220" fill="#fafafa" rx="4"/>

                                                {/* Gradient definitions */}
                                                <defs>
                                                    <linearGradient id="gridGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                                        <stop offset="0%" stopColor="#f3f4f6" stopOpacity="0.5"/>
                                                        <stop offset="100%" stopColor="#e5e7eb" stopOpacity="0.3"/>
                                                    </linearGradient>
                                                </defs>

                                                {/* Horizontal grid lines */}
                                                {[0, 25, 50, 75, 100].map((pct, i) => {
                                                    const chartData = getChartData()!;
                                                    const y = 230 - (pct / 100) * 200;
                                                    const recallValue = chartData.minRecall + (pct / 100) * (chartData.maxRecall - chartData.minRecall);
                                                    return (
                                                        <g key={`h-${i}`}>
                                                            <line x1="50" y1={y} x2="400" y2={y}
                                                                  stroke="#e5e7eb" strokeWidth="1" strokeDasharray={pct === 0 ? "0" : "4,4"}/>
                                                            <text x="45" y={y + 4} textAnchor="end"
                                                                  fill="#9ca3af" fontSize="10" fontFamily="monospace">
                                                                {(recallValue * 100).toFixed(0)}%
                                                            </text>
                                                        </g>
                                                    );
                                                })}

                                                {/* Vertical grid lines */}
                                                {[0, 25, 50, 75, 100].map((pct, i) => {
                                                    const chartData = getChartData()!;
                                                    const x = 50 + (pct / 100) * 350;
                                                    const latencyValue = chartData.minLatency + (pct / 100) * (chartData.maxLatency - chartData.minLatency);
                                                    return (
                                                        <g key={`v-${i}`}>
                                                            <line x1={x} y1="30" x2={x} y2="230"
                                                                  stroke="#e5e7eb" strokeWidth="1" strokeDasharray={pct === 0 ? "0" : "4,4"}/>
                                                            <text x={x} y="250" textAnchor="middle"
                                                                  fill="#9ca3af" fontSize="10" fontFamily="monospace">
                                                                {latencyValue.toFixed(1)}
                                                            </text>
                                                        </g>
                                                    );
                                                })}

                                                {/* Y-axis label */}
                                                <text x="15" y="130" textAnchor="middle"
                                                      transform="rotate(-90, 15, 130)"
                                                      fill="#6b7280" fontSize="11" fontWeight="500">
                                                    Recall@k (%)
                                                </text>

                                                {/* X-axis label */}
                                                <text x="225" y="272" textAnchor="middle"
                                                      fill="#6b7280" fontSize="11" fontWeight="500">
                                                    Latency (ms)
                                                </text>

                                                {/* Data points */}
                                                {(() => {
                                                    const chartData = getChartData()!;
                                                    const latencyRange = chartData.maxLatency - chartData.minLatency || 1;
                                                    const recallRange = chartData.maxRecall - chartData.minRecall || 1;

                                                    const isMatch = (r: IVFParamResult, opt: IVFParamResult | undefined) =>
                                                        opt && r.nlist === opt.nlist && r.nprobe === opt.nprobe;

                                                    return chartData.results.map((result, idx) => {
                                                        const x = 50 + ((result.mean_latency_ms - chartData.minLatency) / latencyRange) * 350;
                                                        const y = 230 - ((result.mean_recall - chartData.minRecall) / recallRange) * 200;

                                                        const isBestRecall = isMatch(result, sweepResults.best_recall);
                                                        const isBestSpeedup = isMatch(result, sweepResults.best_speedup);
                                                        const isBestLatency = isMatch(result, sweepResults.best_latency);
                                                        const isBestBalanced = isMatch(result, sweepResults.best_balanced);

                                                        // Determine color based on type
                                                        let fill = '#cbd5e1'; // Default gray
                                                        let stroke = '#94a3b8';
                                                        let radius = 5;

                                                        if (isBestRecall) { fill = '#22c55e'; stroke = '#16a34a'; radius = 7; }
                                                        else if (isBestSpeedup) { fill = '#3b82f6'; stroke = '#2563eb'; radius = 7; }
                                                        else if (isBestLatency) { fill = '#f59e0b'; stroke = '#d97706'; radius = 7; }
                                                        else if (isBestBalanced) { fill = '#a855f7'; stroke = '#9333ea'; radius = 7; }

                                                        return (
                                                            <g key={idx} className="transition-all duration-200">
                                                                {/* Glow effect for highlighted points */}
                                                                <circle
                                                                    cx={x}
                                                                    cy={y}
                                                                    r={radius}
                                                                    fill={fill}
                                                                    stroke={stroke}
                                                                    strokeWidth={1.5}
                                                                    className="cursor-pointer hover:opacity-80 transition-opacity"
                                                                />
                                                                <title>
                                                                    {`nlist=${result.nlist}, nprobe=${result.nprobe}\nRecall: ${((result.mean_recall ?? 0) * 100).toFixed(1)}%\nLatency: ${(result.mean_latency_ms ?? 0).toFixed(2)}ms\nSpeedup: ${(result.speedup ?? 0).toFixed(2)}x`}
                                                                </title>
                                                            </g>
                                                        );
                                                    });
                                                })()}

                                                {/* Axes */}
                                                <line x1="50" y1="230" x2="400" y2="230" stroke="#374151" strokeWidth="1.5"/>
                                                <line x1="50" y1="30" x2="50" y2="230" stroke="#374151" strokeWidth="1.5"/>
                                            </svg>

                                            {/* Legend */}
                                            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 mt-3 pt-3 border-t border-gray-100">
                                                <div className="flex items-center gap-1.5">
                                                    <div className="w-3 h-3 rounded-full bg-slate-300 border border-slate-400"/>
                                                    <span className="text-xs text-gray-500">Other</span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <div className="w-3.5 h-3.5 rounded-full bg-green-500 border-2 border-green-600 shadow-sm"/>
                                                    <span className="text-xs text-gray-600 font-medium">Best Recall</span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <div className="w-3.5 h-3.5 rounded-full bg-blue-500 border-2 border-blue-600 shadow-sm"/>
                                                    <span className="text-xs text-gray-600 font-medium">Best Speedup</span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <div className="w-3.5 h-3.5 rounded-full bg-amber-500 border-2 border-amber-600 shadow-sm"/>
                                                    <span className="text-xs text-gray-600 font-medium">Best Latency</span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <div className="w-3.5 h-3.5 rounded-full bg-purple-500 border-2 border-purple-600 shadow-sm"/>
                                                    <span className="text-xs text-gray-600 font-medium">Best Balanced</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Results Table */}
                                <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
                                    <div className="p-3 bg-gray-50 border-b border-gray-200">
                                        <h4 className="text-sm font-medium text-gray-900">All Results</h4>
                                    </div>
                                    <div className="max-h-64 overflow-y-auto">
                                        <table className="w-full text-sm">
                                            <thead className="bg-gray-50 sticky top-0">
                                            <tr>
                                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">nlist</th>
                                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">nprobe</th>
                                                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Recall</th>
                                                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Latency</th>
                                                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Speedup</th>
                                                <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Type</th>
                                            </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-200">
                                            {sweepResults.results?.map((result, idx) => {
                                                const isMatch = (opt: IVFParamResult | undefined) =>
                                                    opt && result.nlist === opt.nlist && result.nprobe === opt.nprobe;

                                                const isBestRecall = isMatch(sweepResults.best_recall);
                                                const isBestSpeedup = isMatch(sweepResults.best_speedup);
                                                const isBestLatency = isMatch(sweepResults.best_latency);
                                                const isBestBalanced = isMatch(sweepResults.best_balanced);

                                                let rowBg = 'hover:bg-gray-50';
                                                let badge = null;

                                                if (isBestRecall) {
                                                    rowBg = 'bg-green-50';
                                                    badge = <span className="px-1.5 py-0.5 text-[10px] font-medium bg-green-100 text-green-700 rounded">Recall</span>;
                                                } else if (isBestSpeedup) {
                                                    rowBg = 'bg-blue-50';
                                                    badge = <span className="px-1.5 py-0.5 text-[10px] font-medium bg-blue-100 text-blue-700 rounded">Speedup</span>;
                                                } else if (isBestLatency) {
                                                    rowBg = 'bg-amber-50';
                                                    badge = <span className="px-1.5 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-700 rounded">Latency</span>;
                                                } else if (isBestBalanced) {
                                                    rowBg = 'bg-purple-50';
                                                    badge = <span className="px-1.5 py-0.5 text-[10px] font-medium bg-purple-100 text-purple-700 rounded">Balanced</span>;
                                                }

                                                return (
                                                    <tr key={idx} className={rowBg}>
                                                        <td className="px-3 py-2 font-mono text-gray-900">
                                                            {result.nlist}
                                                        </td>
                                                        <td className="px-3 py-2 font-mono text-gray-900">{result.nprobe}</td>
                                                        <td className={`px-3 py-2 text-right font-mono ${getRecallColor(result.mean_recall ?? 0)}`}>
                                                            {((result.mean_recall ?? 0) * 100).toFixed(2)}%
                                                        </td>
                                                        <td className="px-3 py-2 text-right font-mono text-gray-600">
                                                            {(result.mean_latency_ms ?? 0).toFixed(2)}ms
                                                        </td>
                                                        <td className={`px-3 py-2 text-right font-mono ${getSpeedupColor(result.speedup ?? 0)}`}>
                                                            {(result.speedup ?? 0).toFixed(2)}x
                                                        </td>
                                                        <td className="px-3 py-2 text-center">
                                                            {badge}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default BenchmarkSection;
