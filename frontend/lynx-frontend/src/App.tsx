import React, {useState} from 'react';
import './index.css';

function App() {
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<any[]>([]);

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

            const response = await fetch('http://localhost:8080/add_text_batch', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({batch: lines}),  // ✓ Correct format
            });

            if (response.ok) {
                const data = await response.json();
                setMessage(`Added ${data.added.length} items to index!`);
            } else {
                const error = await response.text();
                setMessage(`Error: ${error}`);
            }
        } catch (error) {
            setMessage(`Error: ${error}`);
        } finally {
            setLoading(false);
        }
    };

    // Search
    const handleSearch = async () => {
        if (!query.trim()) {
            return;
        }

        setLoading(true);

        try {
            const response = await fetch('http://localhost:8080/search', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({query, top_k: 3}),
            });

            if (response.ok) {
                const data = await response.json();
                setResults(data.results || []);
            }
        } catch (error) {
            console.error('Search error:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-darkgray-50">
            <div className="max-w-4xl mx-auto px-6 py-12">
                {/* Header */}
                <div className="mb-12 border-b border-gray-200 pb-8">
                    <h1 className="text-2xl font-light tracking-tight text-gray-900">
                        Lynx - Vector Search
                    </h1>
                </div>

                {/* Upload Section */}
                <div className="mb-12">
                    <h2 className="text-sm font-medium text-gray-900 mb-4">
                        Add Documents
                    </h2>
                    <div className="border border-gray-200 rounded-lg p-6 bg-gray-50">
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
                        Search
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
                            <button
                                onClick={handleSearch}
                                disabled={loading}
                                className="px-6 py-2 text-sm font-medium text-white bg-gray-900
                                     rounded hover:bg-gray-800 disabled:bg-gray-300
                                     disabled:cursor-not-allowed transition-colors"
                            >
                                Search
                            </button>
                        </div>

                        {/* Results */}
                        {results.length > 0 && (
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
                        )}

                        {query && results.length === 0 && !loading && (
                            <p className="text-sm text-gray-500 text-center py-8">
                                No results found
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default App;