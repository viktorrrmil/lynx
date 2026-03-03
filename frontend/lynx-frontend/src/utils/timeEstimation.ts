/**
 * Time estimation utilities for parameter sweeps
 * These calculations mirror the backend estimates but run entirely in the frontend
 */

export interface TimeEstimate {
  totalEstimateMs: number;
  totalEstimateSeconds: number;
  totalEstimateMinutes: number;
  breakdown: {
    embeddingMs: number;
    bfSearchMs: number;
    trainingMs: number;
    searchMs: number;
  };
  numConfigurations: number;
  numQueries: number;
  warning?: string;
}

/**
 * Estimate time for IVF parameter sweep
 * @param numQueries - Number of test queries
 * @param nlistValues - Array of nlist values to test
 * @param nprobeValues - Array of nprobe values to test
 * @param vectorCount - Current number of vectors in the store
 * @returns Time estimate breakdown
 */
export function estimateIVFParamSweepTime(
  numQueries: number,
  nlistValues: number[],
  nprobeValues: number[],
  vectorCount: number
): TimeEstimate {
  // Time components (all in milliseconds):
  // 1. Embedding time: ~50ms per query (can vary based on embedding service)
  const embeddingMs = numQueries * 50.0;

  // 2. Brute-force searches: ~0.001ms per vector per query (linear scan)
  const bfSearchMs = numQueries * vectorCount * 0.001;

  // 3. IVF training time: ~2ms per vector per nlist value (k-means clustering)
  // Training is done once per nlist value
  const trainingMs = nlistValues.length * vectorCount * 2.0;

  // 4. Valid configurations: count pairs where nprobe <= nlist
  let validConfigs = 0;
  for (const nlist of nlistValues) {
    for (const nprobe of nprobeValues) {
      if (nprobe <= nlist) {
        validConfigs++;
      }
    }
  }

  // 5. IVF search time per query: roughly proportional to nprobe/nlist ratio
  // Typical: 0.5ms per query on average
  const avgSearchTimePerQuery = 0.5;
  const searchMs = validConfigs * numQueries * avgSearchTimePerQuery;

  const totalMs = embeddingMs + bfSearchMs + trainingMs + searchMs;

  return {
    totalEstimateMs: totalMs,
    totalEstimateSeconds: totalMs / 1000.0,
    totalEstimateMinutes: totalMs / 60000.0,
    breakdown: {
      embeddingMs,
      bfSearchMs,
      trainingMs,
      searchMs,
    },
    numConfigurations: validConfigs,
    numQueries,
  };
}

/**
 * Estimate time for IVFPQ parameter sweep
 * IVFPQ has additional complexity from Product Quantization training
 * @param numQueries - Number of test queries
 * @param nlistValues - Array of nlist values to test
 * @param nprobeValues - Array of nprobe values to test
 * @param mValues - Array of M values (subquantizers) to test
 * @param codebookSizeValues - Array of codebook sizes to test
 * @param vectorCount - Current number of vectors in the store
 * @returns Time estimate breakdown
 */
export function estimateIVFPQParamSweepTime(
  numQueries: number,
  nlistValues: number[],
  nprobeValues: number[],
  mValues: number[],
  codebookSizeValues: number[],
  vectorCount: number
): TimeEstimate {
  // 1. Embedding time: ~50ms per query
  const embeddingMs = numQueries * 50.0;

  // 2. Brute-force searches: ~0.001ms per vector per query
  const bfSearchMs = numQueries * vectorCount * 0.001;

  // 3. IVFPQ training time: More expensive than IVF due to PQ codebook training
  // Training is done once per (nlist, M, codebookSize) combination
  // Combined IVF + PQ training: ~5ms per vector
  const numTrainingConfigs = nlistValues.length * mValues.length * codebookSizeValues.length;
  const trainingTimePerConfig = vectorCount * 5.0;
  const trainingMs = numTrainingConfigs * trainingTimePerConfig;

  // 4. Valid search configurations: for each training config, test all valid nprobe values
  let validSearchConfigs = 0;
  for (const nlist of nlistValues) {
    for (const nprobe of nprobeValues) {
      if (nprobe <= nlist) {
        // For each valid (nlist, nprobe) pair, we test all (M, codebook_size) combos
        validSearchConfigs += mValues.length * codebookSizeValues.length;
      }
    }
  }

  // 5. IVFPQ search is typically faster than IVF due to quantized representations
  // Typical: 0.3ms per query
  const avgSearchTimePerQuery = 0.3;
  const searchMs = validSearchConfigs * numQueries * avgSearchTimePerQuery;

  const totalMs = embeddingMs + bfSearchMs + trainingMs + searchMs;

  return {
    totalEstimateMs: totalMs,
    totalEstimateSeconds: totalMs / 1000.0,
    totalEstimateMinutes: totalMs / 60000.0,
    breakdown: {
      embeddingMs,
      bfSearchMs,
      trainingMs,
      searchMs,
    },
    numConfigurations: validSearchConfigs,
    numQueries,
    warning: trainingMs > 60000
      ? "⚠️ IVFPQ training is significantly more expensive than IVF. This will take a while!"
      : undefined,
  };
}

/**
 * Format time estimate into a human-readable string
 * @param estimate - Time estimate object
 * @returns Formatted string
 */
export function formatTimeEstimate(estimate: TimeEstimate): string {
  const { totalEstimateMinutes, totalEstimateSeconds } = estimate;

  if (totalEstimateMinutes >= 1) {
    return `~${totalEstimateMinutes.toFixed(1)} minutes`;
  } else if (totalEstimateSeconds >= 1) {
    return `~${totalEstimateSeconds.toFixed(1)} seconds`;
  } else {
    return `~${estimate.totalEstimateMs.toFixed(0)} ms`;
  }
}

/**
 * Get a color indicator based on estimated time
 * @param estimate - Time estimate object
 * @returns Tailwind color class
 */
export function getTimeEstimateColor(estimate: TimeEstimate): string {
  const minutes = estimate.totalEstimateMinutes;

  if (minutes < 0.5) {
    return 'text-green-600'; // < 30 seconds - fast
  } else if (minutes < 2) {
    return 'text-yellow-600'; // 30s - 2min - moderate
  } else if (minutes < 5) {
    return 'text-orange-600'; // 2-5 min - slow
  } else {
    return 'text-red-600'; // > 5 min - very slow
  }
}

/**
 * Parse comma-separated values from input string
 * @param input - Comma-separated string
 * @returns Array of numbers
 */
export function parseCommaSeparatedNumbers(input: string): number[] {
  return input
    .split(',')
    .map(s => s.trim())
    .filter(s => s.length > 0)
    .map(s => parseFloat(s))
    .filter(n => !isNaN(n));
}

