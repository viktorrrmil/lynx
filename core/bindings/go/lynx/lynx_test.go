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

func TestNewIVFPQIndex(t *testing.T) {
	index := NewIVFPQIndex(L2, 4, 2, 2, 8)
	defer index.Delete()

	if index.Metric() != L2 {
		t.Errorf("Expected L2 metric, got %d", index.Metric())
	}

	if index.NList() != 4 {
		t.Errorf("Expected nlist 4, got %d", index.NList())
	}

	if index.NProbe() != 2 {
		t.Errorf("Expected nprobe 2, got %d", index.NProbe())
	}

	if index.M() != 2 {
		t.Errorf("Expected m 2, got %d", index.M())
	}

	if index.CodebookSize() != 8 {
		t.Errorf("Expected codebook_size 8, got %d", index.CodebookSize())
	}
}

func TestIVFPQIndexWithVectorStore(t *testing.T) {
	store := NewInMemoryVectorStore()
	defer store.Delete()

	// Add vectors (8-dimensional for m=2 subspaces)
	for i := 0; i < 50; i++ {
		vec := make([]float32, 8)
		for j := 0; j < 8; j++ {
			vec[j] = float32(i*8+j) / 400.0
		}
		store.AddVector(vec)
	}

	index := NewIVFPQIndex(L2, 4, 2, 2, 8)
	defer index.Delete()

	if !index.SetVectorStore(store) {
		t.Fatal("Failed to set vector store")
	}

	if !index.IsInitialized() {
		t.Error("Index should be initialized after setting vector store with data")
	}

	if index.Size() != 50 {
		t.Errorf("Expected size 50, got %d", index.Size())
	}

	if index.Dimension() != 8 {
		t.Errorf("Expected dimension 8, got %d", index.Dimension())
	}

	// Test search
	query := []float32{0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1}
	results, err := index.Search(query, 5)

	if err != nil {
		t.Fatalf("Search failed: %v", err)
	}

	if len(results) == 0 {
		t.Error("Expected search results, got none")
	}

	if len(results) > 5 {
		t.Errorf("Expected at most 5 results, got %d", len(results))
	}
}

func TestIVFPQIndexSetNProbe(t *testing.T) {
	index := NewIVFPQIndex(L2, 4, 2, 2, 8)
	defer index.Delete()

	index.SetNProbe(3)
	if index.NProbe() != 3 {
		t.Errorf("Expected nprobe 3, got %d", index.NProbe())
	}
}
