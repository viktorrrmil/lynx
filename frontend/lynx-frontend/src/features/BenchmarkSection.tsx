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
                            {summary.results?.map((result, index) => (
                                <div key={index} className="flex items-center gap-3">
                                    <span className="text-xs text-gray-600 w-32 truncate" title={result.query}>
                                        {result.query}
                                    </span>
                                    <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all ${
                                                (result.recall_at_k ?? 0) >= 0.95 ? 'bg-green-500' :
                                                    (result.recall_at_k ?? 0) >= 0.8 ? 'bg-yellow-500' : 'bg-red-500'
                                            }`}
                                            style={{width: `${(result.recall_at_k ?? 0) * 100}%`}}
                                        />
                                    </div>
                                    <span className="text-xs font-mono text-gray-600 w-16 text-right">
                                        {((result.recall_at_k ?? 0) * 100).toFixed(1)}%
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BenchmarkSection;
