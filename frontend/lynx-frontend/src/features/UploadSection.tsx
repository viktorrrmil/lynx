import React, {useState} from 'react';

const UploadSection = ({
                           loading,
                           setLoading
                       }: {
    loading: boolean;
    setLoading: (loading: boolean) => void;
}) => {
    const [file, setFile] = useState<File | null>(null);
    const [message, setMessage] = useState('');

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
            const bfResponse = await fetch('http://localhost:8080/vector_store/add_batch', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({batch: lines}),
            });

            if (bfResponse.ok) {
                const data = await bfResponse.json();
                setMessage(`✓ Added ${data.count} ${data.count > 1 ? "items" : "item"} to both indexes!`);
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

    return (
        <div className="w-full h-full cli-panel p-6">
            <div className="flex items-start justify-between gap-6 flex-wrap">
                <div className="flex-1 min-w-[220px]">
                    <p className="cli-header mb-3">Dataset Ingest</p>
                    <input
                        type="file"
                        accept=".txt"
                        onChange={handleFileChange}
                        className="block w-full text-xs text-slate-600 font-mono
                                         file:mr-4 file:py-2 file:px-4
                                         file:rounded file:border file:border-slate-300
                                         file:text-xs file:font-semibold
                                         file:bg-white file:text-slate-700
                                         hover:file:bg-slate-50
                                         file:cursor-pointer cursor-pointer"
                    />
                    <button
                        onClick={handleUpload}
                        disabled={loading || !file}
                        className="mt-4 cli-button-primary disabled:bg-slate-300 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Processing...' : 'Upload & Index'}
                    </button>
                </div>
                <div className="min-w-[200px]">
                    <p className="text-xs text-slate-500 font-mono leading-relaxed">
                        Upload plain text lines (one item per line), ".txt" files only.
                    </p>
                </div>
            </div>

            {message && (
                <p className="mt-4 text-xs text-slate-600 border-l-2 border-slate-900 pl-3 font-mono">
                    {message}
                </p>
            )}
        </div>
    )
}

export default UploadSection;
