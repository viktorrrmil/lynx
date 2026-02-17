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
