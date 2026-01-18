import React, { useState } from 'react';
import './App.css';

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
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ batch: lines }),  // ✓ Correct format
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
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query, top_k: 3 }),
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
        <div className="App">
            <h1>Vector Search</h1>

            {/* Upload Section */}
            <div className="section">
                <h2>Feed the Index</h2>
                <input
                    type="file"
                    accept=".txt"
                    onChange={handleFileChange}
                />
                <button
                    onClick={handleUpload}
                    disabled={loading || !file}
                >
                    {loading ? 'Uploading...' : 'Upload & Add to Index'}
                </button>
                {message && <p className="message">{message}</p>}
            </div>

            {/* Search Section */}
            <div className="section">
                <h2>Search</h2>
                <input
                    type="text"
                    placeholder="Enter your search query..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                />
                <button onClick={handleSearch} disabled={loading}>
                    Search
                </button>

                {/* Results */}
                <div className="results">
                    {results.map((result, idx) => (
                        <div key={idx} className="result">
                            <div className="distance">Distance: {result.distance.toFixed(4)}</div>
                            <div className="text">{result.text}</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default App;