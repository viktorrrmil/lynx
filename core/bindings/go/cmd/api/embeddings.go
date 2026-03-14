package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
)

var embeddingServiceURL = os.Getenv("EMBEDDING_SERVICE_URL")

func getEmbeddings(text string) ([]float32, error) {
	if embeddingServiceURL == "" {
		return nil, fmt.Errorf("EMBEDDING_SERVICE_URL is not set")
	}

	request := EmbeddingRequest{Text: text}
	jsonData, err := json.Marshal(request)
	if err != nil {
		return nil, err
	}

	resp, err := http.Post(
		embeddingServiceURL+"/embed_text",
		"application/json",
		bytes.NewBuffer(jsonData))

	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("embedding service error (%d): %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}

	var result EmbeddingResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	if len(result.Embeddings) == 0 {
		return nil, fmt.Errorf("embedding service returned empty embedding")
	}

	return result.Embeddings, nil
}

func getBatchEmbeddings(textBatch []string) ([][]float32, error) {
	if embeddingServiceURL == "" {
		return nil, fmt.Errorf("EMBEDDING_SERVICE_URL is not set")
	}

	request := EmbeddingBatchRequest{
		Batch: textBatch,
	}

	jsonData, err := json.Marshal(request)
	if err != nil {
		return nil, err
	}

	resp, err := http.Post(
		embeddingServiceURL+"/embed_text_batch",
		"application/json",
		bytes.NewBuffer(jsonData))

	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("embedding service error (%d): %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}

	var result EmbeddingBatchResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	if len(result.BatchEmbeddings) != len(textBatch) {
		return nil, fmt.Errorf("embedding service returned %d embeddings, expected %d", len(result.BatchEmbeddings), len(textBatch))
	}

	return result.BatchEmbeddings, nil
}
