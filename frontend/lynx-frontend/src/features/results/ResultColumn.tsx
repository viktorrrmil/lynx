import type {SearchResult} from "../../types/types.ts";


const ResultsColumn = ({query, title, results, searchTime, trained = true}: {
    query: string,
    title: string,
    results: SearchResult[],
    searchTime: number | null,
    trained?: boolean
}) => (
    <div className="flex-1">
        <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-semibold text-slate-500 font-mono uppercase tracking-[0.2em]">{title}</h3>
            {searchTime !== null && (
                <span className="text-xs font-mono text-slate-500">
                        {searchTime}ms
                    </span>
            )}
        </div>

        {!trained ? (
            <div className="cli-panel-muted p-8 text-center">
                <p className="text-sm text-slate-500 font-mono">Not trained yet</p>
            </div>
        ) : results.length > 0 ? (
            <div className="space-y-3 overflow-y-auto max-h-150">
                {results.map((result, idx) => (
                    <div
                        key={idx}
                        className="cli-panel-strong p-4 hover:border-slate-300 transition-colors"
                    >
                        <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-mono text-slate-500">
                                    ID: {result.id}
                                </span>
                            <span className="text-xs font-mono text-slate-500">
                                    Distance: {result.distance.toFixed(4)}
                                </span>
                        </div>
                        <p className="text-sm text-slate-900 leading-relaxed">
                            {result.text}
                        </p>
                    </div>
                ))}
            </div>
        ) : query ? (
            <div className="cli-panel-muted p-8 text-center">
                <p className="text-sm text-slate-500 font-mono">No results found</p>
            </div>
        ) : null}
    </div>
);

export default ResultsColumn;
