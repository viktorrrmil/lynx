export interface IndexResults {
    results: SearchResult[];
    searchTime: number | null;
}

export interface SearchResult {
    id: number;
    distance: number;
    text: string;
}