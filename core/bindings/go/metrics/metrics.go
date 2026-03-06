package metrics

import (
	"lynx/lynx"
	"math"
	"sort"
)

type BenchmarkResult struct {
	Query     string  `json:"query"`
	RecallAtK float64 `json:"recall_at_k"`
	SpeedupX  float64 `json:"speedup_x"`
	IVFTimeMs float64 `json:"ivf_time_ms"`
	BFTimeMs  float64 `json:"bf_time_ms"`
}

type BenchmarkSummary struct {
	NumQueries   int               `json:"num_queries"`
	MeanRecall   float64           `json:"mean_recall"`
	MedianRecall float64           `json:"median_recall"`
	MinRecall    float64           `json:"min_recall"`
	MaxRecall    float64           `json:"max_recall"`
	StdDevRecall float64           `json:"stddev_recall"`
	MeanSpeedup  float64           `json:"mean_speedup"`
	Results      []BenchmarkResult `json:"results"`
}

// MultiIndexBenchmarkResult represents benchmark results for a single query across all indexes
type MultiIndexBenchmarkResult struct {
	Query        string  `json:"query"`
	BFTimeNs     int64   `json:"bf_time_ns"`
	IVFTimeNs    int64   `json:"ivf_time_ns"`
	IVFPQTimeNs  int64   `json:"ivfpq_time_ns"`
	HNSWTimeNs   int64   `json:"hnsw_time_ns"`
	IVFRecall    float64 `json:"ivf_recall"`
	IVFPQRecall  float64 `json:"ivfpq_recall"`
	HNSWRecall   float64 `json:"hnsw_recall"`
	IVFSpeedup   float64 `json:"ivf_speedup"`
	IVFPQSpeedup float64 `json:"ivfpq_speedup"`
	HNSWSpeedup  float64 `json:"hnsw_speedup"`
}

// MultiIndexBenchmarkSummary contains aggregated statistics for all indexes
type MultiIndexBenchmarkSummary struct {
	NumQueries int                         `json:"num_queries"`
	BF         IndexSummary                `json:"bruteforce"`
	IVF        IndexSummary                `json:"ivf"`
	IVFPQ      IndexSummary                `json:"ivfpq"`
	HNSW       IndexSummary                `json:"hnsw"`
	Results    []MultiIndexBenchmarkResult `json:"results"`
}

// IndexSummary contains statistics for a single index
type IndexSummary struct {
	MeanLatencyNs int64   `json:"mean_latency_ns"`
	MinLatencyNs  int64   `json:"min_latency_ns"`
	MaxLatencyNs  int64   `json:"max_latency_ns"`
	MeanRecall    float64 `json:"mean_recall"`
	MedianRecall  float64 `json:"median_recall"`
	MinRecall     float64 `json:"min_recall"`
	MaxRecall     float64 `json:"max_recall"`
	StdDevRecall  float64 `json:"stddev_recall"`
	MeanSpeedup   float64 `json:"mean_speedup"`
}

func CalculateRecall(bfResults, optimizedResults []lynx.SearchResult, k int64) float64 {
	bfSet := make(map[int64]bool)
	for _, r := range bfResults {
		bfSet[r.ID] = true
	}

	matches := 0
	for _, r := range optimizedResults {
		if bfSet[r.ID] {
			matches++
		}
	}
	return float64(matches) / float64(k)
}

func CalculateSummary(results []BenchmarkResult) BenchmarkSummary {
	var sum, sumSq float64
	recalls := make([]float64, len(results))
	var speedupSum float64

	for i, r := range results {
		sum += r.RecallAtK
		sumSq += r.RecallAtK * r.RecallAtK
		recalls[i] = r.RecallAtK
		speedupSum += r.SpeedupX
	}

	sort.Float64s(recalls)

	mean := sum / float64(len(results))
	variance := (sumSq / float64(len(results))) - (mean * mean)
	stddev := math.Sqrt(variance)
	median := recalls[len(recalls)/2]

	return BenchmarkSummary{
		NumQueries:   len(results),
		MeanRecall:   mean,
		MedianRecall: median,
		MinRecall:    recalls[0],
		MaxRecall:    recalls[len(recalls)-1],
		StdDevRecall: stddev,
		MeanSpeedup:  speedupSum / float64(len(results)),
		Results:      results,
	}
}

func CalculateMultiIndexSummary(results []MultiIndexBenchmarkResult) MultiIndexBenchmarkSummary {
	n := len(results)
	if n == 0 {
		return MultiIndexBenchmarkSummary{}
	}

	// Helper to calculate index-specific summary
	calcIndexSummary := func(latencies []int64, recalls []float64, speedups []float64) IndexSummary {
		sort.Slice(latencies, func(i, j int) bool { return latencies[i] < latencies[j] })
		sort.Float64s(recalls)

		var sumLatency int64
		var sumRecall, sumSqRecall, sumSpeedup float64

		for i := 0; i < n; i++ {
			sumLatency += latencies[i]
			sumRecall += recalls[i]
			sumSqRecall += recalls[i] * recalls[i]
			sumSpeedup += speedups[i]
		}

		meanLatency := sumLatency / int64(n)
		meanRecall := sumRecall / float64(n)
		variance := (sumSqRecall / float64(n)) - (meanRecall * meanRecall)
		stddev := math.Sqrt(variance)
		median := recalls[n/2]

		return IndexSummary{
			MeanLatencyNs: meanLatency,
			MinLatencyNs:  latencies[0],
			MaxLatencyNs:  latencies[n-1],
			MeanRecall:    meanRecall,
			MedianRecall:  median,
			MinRecall:     recalls[0],
			MaxRecall:     recalls[n-1],
			StdDevRecall:  stddev,
			MeanSpeedup:   sumSpeedup / float64(n),
		}
	}

	// Extract data for each index
	bfLatencies := make([]int64, n)
	ivfLatencies := make([]int64, n)
	ivfpqLatencies := make([]int64, n)
	hnswLatencies := make([]int64, n)

	ivfRecalls := make([]float64, n)
	ivfpqRecalls := make([]float64, n)
	hnswRecalls := make([]float64, n)

	ivfSpeedups := make([]float64, n)
	ivfpqSpeedups := make([]float64, n)
	hnswSpeedups := make([]float64, n)

	for i, r := range results {
		bfLatencies[i] = r.BFTimeNs
		ivfLatencies[i] = r.IVFTimeNs
		ivfpqLatencies[i] = r.IVFPQTimeNs
		hnswLatencies[i] = r.HNSWTimeNs

		ivfRecalls[i] = r.IVFRecall
		ivfpqRecalls[i] = r.IVFPQRecall
		hnswRecalls[i] = r.HNSWRecall

		ivfSpeedups[i] = r.IVFSpeedup
		ivfpqSpeedups[i] = r.IVFPQSpeedup
		hnswSpeedups[i] = r.HNSWSpeedup
	}

	// BF has 100% recall and 1x speedup
	bfRecalls := make([]float64, n)
	bfSpeedups := make([]float64, n)
	for i := 0; i < n; i++ {
		bfRecalls[i] = 1.0
		bfSpeedups[i] = 1.0
	}

	return MultiIndexBenchmarkSummary{
		NumQueries: n,
		BF:         calcIndexSummary(bfLatencies, bfRecalls, bfSpeedups),
		IVF:        calcIndexSummary(ivfLatencies, ivfRecalls, ivfSpeedups),
		IVFPQ:      calcIndexSummary(ivfpqLatencies, ivfpqRecalls, ivfpqSpeedups),
		HNSW:       calcIndexSummary(hnswLatencies, hnswRecalls, hnswSpeedups),
		Results:    results,
	}
}
