package main

import (
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"
)

var ingestionAllowedTypes = map[string]bool{
	"parquet": true,
	"txt":     true,
}

func normalizeIngestionType(rawType, name string) string {
	normalized := strings.ToLower(strings.TrimSpace(rawType))
	normalized = strings.TrimPrefix(normalized, ".")
	if strings.Contains(normalized, "/") {
		if strings.Contains(normalized, "parquet") {
			return "parquet"
		}
		if strings.Contains(normalized, "text") {
			return "txt"
		}
	}
	if normalized != "" && normalized != "unknown" {
		return normalized
	}
	ext := strings.ToLower(strings.TrimPrefix(filepath.Ext(name), "."))
	if ext != "" {
		return ext
	}
	return "unknown"
}

func (api *API) evaluateIngestionFolder(c *gin.Context) {
	var request IngestionEvaluateRequest
	if err := c.BindJSON(&request); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	results := make([]IngestionEvaluateResult, 0, len(request.Files))
	for _, file := range request.Files {
		fileType := normalizeIngestionType(file.Type, file.Name)
		available := ingestionAllowedTypes[fileType]
		result := IngestionEvaluateResult{
			Name:      file.Name,
			Type:      fileType,
			SizeBytes: file.SizeBytes,
			Available: available,
		}
		if !available {
			result.Reason = "unsupported type"
		}
		results = append(results, result)
	}

	c.JSON(200, IngestionEvaluateResponse{
		Files:               results,
		SupportedExtensions: []string{".parquet", ".txt"},
	})
}
