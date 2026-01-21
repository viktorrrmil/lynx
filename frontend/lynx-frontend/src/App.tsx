import React, {useState} from 'react';
import './index.css';

interface SearchResult {
    id: number;
    distance: number;
    text: string;
}

interface IndexResults {
    results: SearchResult[];
    searchTime: number | null;
}

function App() {
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [query, setQuery] = useState('');
    const [bfResults, setBfResults] = useState<IndexResults>({results: [], searchTime: null});
    const [ivfResults, setIvfResults] = useState<IndexResults>({results: [], searchTime: null});
    const [ivfTrained, setIvfTrained] = useState(false);
    const [training, setTraining] = useState(false);
    const [k, setK] = useState(10);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleUpload = async () => {
        if (!file) {
            setMessage('Please select a file first');
            return;
        }

        setLoading(true);
        setMessage('');

        try {
            const text = await file.text();
            const lines = text.split('\n').filter(line => line.trim() !== '');

            // Add to both indexes
            const bfResponse = await fetch('http://localhost:8080/bf_add_text_batch', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({batch: lines}),
            });

            if (bfResponse.ok) {
                const data = await bfResponse.json();
                setMessage(`✓ Added ${data.added.length} items to both indexes!`);

                // If IVF is trained, also add there
                if (ivfTrained) {
                    await fetch('http://localhost:8080/ivf_add_text_batch', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({batch: lines}),
                    });
                }
            } else {
                const error = await bfResponse.text();
                setMessage(`Error: ${error}`);
            }
        } catch (error) {
            setMessage(`Error: ${error}`);
        } finally {
            setLoading(false);
        }
    };

    const handleTrain = async () => {
        setTraining(true);
        setMessage('');

        try {
            const response = await fetch('http://localhost:8080/ivf_train', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    num_clusters: 10,  // You can make this configurable
                    num_probes: 3
                }),
            });

            if (response.ok) {
                setIvfTrained(true);
                setMessage('IVF index trained successfully!');
            } else {
                const error = await response.text();
                setMessage(`Training failed: ${error}`);
            }
        } catch (error) {
            setMessage(`Error: ${error}`);
        } finally {
            setTraining(false);
        }
    };

    const handleSearch = async () => {
        if (!query.trim()) return;

        setLoading(true);

        try {
            // Search both indexes in parallel
            const [bfResponse, ivfResponse] = await Promise.all([
                fetch('http://localhost:8080/bf_search', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({query, top_k: k}),
                }),
                ivfTrained ? fetch('http://localhost:8080/ivf_search', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({query, top_k: k}),
                }) : null
            ]);

            if (bfResponse.ok) {
                const data = await bfResponse.json();
                setBfResults({
                    results: data.results || [],
                    searchTime: data.search_time_ms
                });
            }

            if (ivfResponse && ivfResponse.ok) {
                const data = await ivfResponse.json();
                setIvfResults({
                    results: data.results || [],
                    searchTime: data.search_time_ms
                });
            }
        } catch (error) {
            console.error('Search error:', error);
        } finally {
            setLoading(false);
        }
    };

    const ResultsColumn = ({title, results, searchTime, trained = true}: {
        title: string,
        results: SearchResult[],
        searchTime: number | null,
        trained?: boolean
    }) => (
        <div className="flex-1">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-gray-900">{title}</h3>
                {searchTime !== null && (
                    <span className="text-xs font-mono text-gray-500">
                        {searchTime}ms
                    </span>
                )}
            </div>

            {!trained ? (
                <div className="border border-gray-200 rounded-lg p-8 text-center bg-gray-50">
                    <p className="text-sm text-gray-500">Not trained yet</p>
                </div>
            ) : results.length > 0 ? (
                <div className="space-y-3">
                    {results.map((result, idx) => (
                        <div
                            key={idx}
                            className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
                        >
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-mono text-gray-500">
                                    ID: {result.id}
                                </span>
                                <span className="text-xs font-mono text-gray-500">
                                    Distance: {result.distance.toFixed(4)}
                                </span>
                            </div>
                            <p className="text-sm text-gray-900 leading-relaxed">
                                {result.text}
                            </p>
                        </div>
                    ))}
                </div>
            ) : query ? (
                <div className="border border-gray-200 rounded-lg p-8 text-center bg-gray-50">
                    <p className="text-sm text-gray-500">No results found</p>
                </div>
            ) : null}
        </div>
    );

    return (
        <div className="min-h-screen bg-white">
            <div className="max-w-7xl mx-auto px-6 py-12">
                {/* Header */}
                <div className="mb-12 border-b border-gray-200 pb-8">
                    <h1 className="text-2xl font-light tracking-tight text-gray-900">
                        Lynx - Vector Search Comparison
                    </h1>
                    <p className="text-sm text-gray-500 mt-2">
                        Compare BruteForce vs IVF index performance
                    </p>
                </div>

                {/* Upload Section */}
                <div className="mb-12">
                    <h2 className="text-sm font-medium text-gray-900 mb-4">
                        Add Documents
                    </h2>
                    <div className="border border-gray-200 rounded-lg p-6 bg-gray-50">
                        <div className="flex gap-4 items-start">
                            <div className="flex-1">
                                <input
                                    type="file"
                                    accept=".txt"
                                    onChange={handleFileChange}
                                    className="block w-full text-sm text-gray-600
                                         file:mr-4 file:py-2 file:px-4
                                         file:rounded file:border file:border-gray-300
                                         file:text-sm file:font-medium
                                         file:bg-white file:text-gray-700
                                         hover:file:bg-gray-50
                                         file:cursor-pointer cursor-pointer"
                                />
                                <button
                                    onClick={handleUpload}
                                    disabled={loading || !file}
                                    className="mt-4 px-4 py-2 text-sm font-medium text-white bg-gray-900
                                         rounded hover:bg-gray-800 disabled:bg-gray-300
                                         disabled:cursor-not-allowed transition-colors"
                                >
                                    {loading ? 'Processing...' : 'Upload & Index'}
                                </button>
                            </div>

                            <div className="border-l border-gray-300 pl-4">
                                <p className="text-xs text-gray-500 mb-2">Train IVF Index</p>
                                <button
                                    onClick={handleTrain}
                                    disabled={training || ivfTrained}
                                    className="px-4 py-2 text-sm font-medium text-white bg-gray-900
                                         rounded hover:bg-gray-800 disabled:bg-gray-300
                                         disabled:cursor-not-allowed transition-colors"
                                >
                                    {training ? 'Training...' : ivfTrained ? '✓ Trained' : 'Train IVF'}
                                </button>
                            </div>
                        </div>

                        {message && (
                            <p className="mt-4 text-sm text-gray-600 border-l-2 border-gray-900 pl-3">
                                {message}
                            </p>
                        )}
                    </div>
                </div>

                {/* Search Section */}
                <div>
                    <h2 className="text-sm font-medium text-gray-900 mb-4">
                        Search Both Indexes
                    </h2>
                    <div className="space-y-6">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                placeholder="Enter search query..."
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                                className="flex-1 px-4 py-2 text-sm border border-gray-300 rounded
                                     focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900"
                            />
                            <input
                                type="number"
                                min={1}
                                max={1000}
                                value={k}
                                onChange={(e) => setK(Number(e.target.value))}
                                className="w-24 px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900"
                            />
                            <button
                                onClick={handleSearch}
                                disabled={loading}
                                className="px-6 py-2 text-sm font-medium text-white bg-gray-900
                                     rounded hover:bg-gray-800 disabled:bg-gray-300
                                     disabled:cursor-not-allowed transition-colors"
                            >
                                {loading ? 'Searching...' : 'Search Both'}
                            </button>
                        </div>

                        {/* Side by Side Results */}
                        <div className="flex gap-6">
                            <ResultsColumn
                                title="BruteForce Index"
                                results={bfResults.results}
                                searchTime={bfResults.searchTime}
                            />
                            <ResultsColumn
                                title="IVF Index"
                                results={ivfResults.results}
                                searchTime={ivfResults.searchTime}
                                trained={ivfTrained}
                            />
                        </div>

                        {/* Performance Summary */}
                        {bfResults.searchTime && ivfResults.searchTime && (
                            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                                <p className="text-sm text-gray-900">
                                    <span className="font-medium">Performance:</span> IVF is{' '}
                                    <span className="font-mono font-medium">
                                        {(bfResults.searchTime / ivfResults.searchTime).toFixed(2)}x
                                    </span>
                                    {' '}{bfResults.searchTime > ivfResults.searchTime ? 'faster' : 'slower'} than BruteForce
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default App;