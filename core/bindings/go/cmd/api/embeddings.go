package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"os"
)

var embeddingServiceURL = os.Getenv("EMBEDDING_SERVICE_URL")

func getEmbeddings(text string) ([]float32, error) {
	request := EmbeddingRequest{Text: text}
	jsonData, _ := json.Marshal(request)

	resp, err := http.Post(
		embeddingServiceURL+"/embed_text",
		"application/json",
		bytes.NewBuffer(jsonData))

	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result EmbeddingResponse
	json.NewDecoder(resp.Body).Decode(&result)

	return result.Embeddings, nil
}

func getBatchEmbeddings(textBatch []string) ([][]float32, error) {
	request := EmbeddingBatchRequest{
		Batch: textBatch,
	}

	jsonData, _ := json.Marshal(request)

	resp, err := http.Post(
		embeddingServiceURL+"/embed_text_batch",
		"application/json",
		bytes.NewBuffer(jsonData))

	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result EmbeddingBatchResponse
	json.NewDecoder(resp.Body).Decode(&result)

	return result.BatchEmbeddings, nil
}
