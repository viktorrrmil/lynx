const DatasetIngestionCard = ({ onOpen }: { onOpen: () => void }) => {
    return (
        <button
            type="button"
            onClick={onOpen}
            className="cli-panel p-5 text-left hover:border-slate-300 transition-colors"
        >
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                    <p className="cli-header">Dataset Ingestion</p>
                    <p className="text-xs text-slate-500 font-mono mt-2">
                        Click to open the ingestion workflow and configure dataset sources.
                    </p>
                </div>
                <span className="cli-button font-mono">Open</span>
            </div>
        </button>
    );
};

export default DatasetIngestionCard;
