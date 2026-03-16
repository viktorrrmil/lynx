export interface IvfSuggestion {
    nlist: number;
    nprobe: number;
}

export interface IvfPqSuggestion extends IvfSuggestion {
    m: number;
    codebookSize: number;
}

export interface HnswSuggestion {
    m: number;
    efConstruction: number;
    efSearch: number;
}

const clampNumber = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const recommendIvfParams = (vectorCount: number): IvfSuggestion | null => {
    if (vectorCount <= 0) {
        return null;
    }
    const maxNlist = Math.min(10000, Math.max(1, vectorCount));
    const minNlist = Math.min(16, maxNlist);
    const nlist = clampNumber(Math.round(4 * Math.sqrt(vectorCount)), minNlist, maxNlist);
    const nprobe = clampNumber(Math.round(Math.sqrt(nlist)), 1, Math.min(128, nlist));
    return { nlist, nprobe };
};

export const recommendIvfPqParams = (vectorCount: number): IvfPqSuggestion | null => {
    const ivfBase = recommendIvfParams(vectorCount);
    if (!ivfBase) {
        return null;
    }
    let m = 8;
    let codebookSize = 128;
    if (vectorCount >= 200000) {
        m = 32;
        codebookSize = 256;
    } else if (vectorCount >= 50000) {
        m = 16;
        codebookSize = 256;
    }
    m = clampNumber(m, 1, 128);
    codebookSize = clampNumber(codebookSize, 1, 1024);
    return { ...ivfBase, m, codebookSize };
};

export const recommendHnswParams = (vectorCount: number): HnswSuggestion | null => {
    if (vectorCount <= 0) {
        return null;
    }
    let m = 16;
    let efConstruction = 200;
    let efSearch = 50;
    if (vectorCount >= 200000) {
        m = 32;
        efConstruction = 400;
        efSearch = 100;
    } else if (vectorCount >= 50000) {
        m = 24;
        efConstruction = 300;
        efSearch = 75;
    }
    return {
        m: clampNumber(m, 2, 128),
        efConstruction: clampNumber(efConstruction, 1, 1000),
        efSearch: clampNumber(efSearch, 1, 1000),
    };
};
