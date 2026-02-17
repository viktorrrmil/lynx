package metrics

import (
	"lynx/lynx"
	_ "lynx/lynx"
)

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
