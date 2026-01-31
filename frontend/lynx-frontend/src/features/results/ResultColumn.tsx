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
            <div className="space-y-3 overflow-y-auto max-h-150">
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

export default ResultsColumn;