export interface IndexResults {
    results: SearchResult[];
    searchTime: number | null;
    recall?: number;
}

export interface SearchResult {
    id: number;
    distance: number;
    text: string;
}