import React, {useState} from 'react';

const UploadSection = ({
                           loading,
                           setLoading,
                           ivfTrained,
                           setIvfTrained,
                       }: {
    loading: boolean;
    setLoading: (loading: boolean) => void;
    ivfTrained: boolean;
    setIvfTrained: (trained: boolean) => void;
}) => {
    const [file, setFile] = useState<File | null>(null);
    const [message, setMessage] = useState('');
    const [training, setTraining] = useState(false);

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

                // If IVF is trained, also add there
                // if (ivfTrained) {
                //     await fetch('http://localhost:8080/ivf_add_text_batch', {
                //         method: 'POST',
                //         headers: {'Content-Type': 'application/json'},
                //         body: JSON.stringify({batch: lines}),
                //     });
                // }
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
                    num_clusters: 10,
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

    return (
        <div className="mb-12">
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
                            disabled={true}
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
    )
}

export default UploadSection;