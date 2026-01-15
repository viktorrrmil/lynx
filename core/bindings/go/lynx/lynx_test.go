package lynx

import "testing"

func TestNewBruteForceIndex(t *testing.T) {
	index := NewBruteforceIndex(3, L2)
	defer index.Delete()

	if index.Dimension() != 3 {
		t.Errorf("Expected dimension 3, got %d", index.Dimension())
	}

	if index.Metric() != L2 {
		t.Errorf("Expected L2 metric, got %d", index.Metric())
	}
}

func TestAddAndSearch(t *testing.T) {
	index := NewBruteforceIndex(3, L2)
	defer index.Delete()

	// Add some vectors
	vec1 := []float32{1.0, 0.0, 0.0}
	vec2 := []float32{0.0, 1.0, 0.0}

	if err := index.Add(1, vec1); err != nil {
		t.Fatalf("Failed to add vector 1: %v", err)
	}

	if err := index.Add(2, vec2); err != nil {
		t.Fatalf("Failed to add vector 2: %v", err)
	}

	if index.Size() != 2 {
		t.Errorf("Expected size 2, got %d", index.Size())
	}

	// Search
	query := []float32{1.0, 0.0, 0.0}
	results, err := index.Search(query, 1)

	if err != nil {
		t.Fatalf("Search failed: %v", err)
	}

	if len(results) != 1 {
		t.Fatalf("Expected 1 result, got %d", len(results))
	}

	if results[0].ID != 1 {
		t.Errorf("Expected ID 1, got %d", results[0].ID)
	}
}
