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
                setMessage(`✓ Added ${data.added.length} items to both indexes!`);
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
        <div className="w-full h-full border border-slate-200 rounded-lg p-6 bg-gradient-to-br from-slate-50 to-blue-50/30">
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
            </div>

            {message && (
                <p className="mt-4 text-sm text-gray-600 border-l-2 border-gray-900 pl-3">
                    {message}
                </p>
            )}
        </div>
    )
}

export default UploadSection;