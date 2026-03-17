import {useState} from 'react';

const InfoScreen = () => {
    const [size, setSize] = useState<number>(0);
    const [dimension, setDimension] = useState<number>(0);

    const fetchIndexInfo = async () => {
        try {
            const response = await fetch('http://localhost:8080/info');
            if (response.ok) {
                const data = await response.json();
                setSize(data.size);
                setDimension(data.dimension);
            } else {
                console.error('Failed to fetch index info');
            }
        } catch (error) {
            console.error('Error fetching index info:', error);
        }
    }

    return (
        <div className="w-full h-full cli-panel p-5">
            <div className="flex w-full m-auto items-center justify-between border-b border-slate-200 pb-2">
                <div>
                    <p className="cli-header">Index Snapshot</p>
                    <p className="text-xs text-slate-500 font-mono mt-1">On-demand metadata refresh</p>
                </div>
                <button
                    className="cli-button font-mono"
                    onClick={fetchIndexInfo}
                >
                    Refresh
                </button>
            </div>
            {size > 0 && dimension > 0 ? (
                <div className="index-info pt-4 flex flex-col space-y-3 text-sm text-slate-600">
                    <div className="flex items-center justify-between">
                        <span className="text-slate-700 font-mono">Index Size</span>
                        <span className="px-3 py-1 bg-slate-900 text-slate-50 rounded border border-slate-900 text-xs font-mono">
                            {size}
                        </span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-slate-700 font-mono">Vector Dimension</span>
                        <span className="px-3 py-1 bg-indigo-600 text-white rounded border border-indigo-600 text-xs font-mono">
                            {dimension}
                        </span>
                    </div>
                </div>
            ) : (
                <p className="mt-4 text-xs text-slate-500 font-mono">
                    Refresh to load current index metadata.
                </p>
            )}
        </div>
    )
}

export default InfoScreen;
