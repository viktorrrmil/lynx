import React, {useState} from 'react';

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
        <div className="w-full h-full border border-slate-200 rounded-lg p-6 bg-gradient-to-br from-slate-50 to-blue-50/30">
            <div className={"flex w-full m-auto align-middle justify-between border-b border-slate-200 pb-2"}>
                <h2 className={"text-lg text-slate-800"}>Index Info</h2>
                <button
                    className="px-2 py-1 border text-sm rounded bg-white transition-colors"
                    onClick={fetchIndexInfo}
                >
                    Refresh
                </button>
            </div>
            {size > 0 && dimension > 0 && (
                <div className="index-info pt-3 flex flex-col space-y-2 text-sm text-slate-600">
                    <div className="flex items-center justify-between">
                        <span className="text-slate-700">Index Size:</span>
                        <span className="px-3 py-1 bg-blue-50 rounded border border-blue-200 text-blue-900">{size}</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-slate-700">Vector Dimension:</span>
                        <span className="px-3 py-1 bg-indigo-50 rounded border border-indigo-200 text-indigo-900">{dimension}</span>
                    </div>
                </div>
            )}
        </div>
    )
}

export default InfoScreen;