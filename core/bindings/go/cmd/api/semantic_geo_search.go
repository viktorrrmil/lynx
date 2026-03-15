package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"lynx/storage"
	"net/http"
	"os"
	"regexp"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"

	_ "github.com/marcboeker/go-duckdb"
)

var s3RegionPattern = regexp.MustCompile(`^[a-z0-9-]+$`)

func (api *API) semanticGeoSearchIndex(c *gin.Context) {
	if websocket.IsWebSocketUpgrade(c.Request) {
		api.semanticGeoSearchIndexWebSocket(c)
		return
	}

	if c.Request.Method != http.MethodPost {
		c.JSON(http.StatusMethodNotAllowed, gin.H{"error": "method not allowed"})
		return
	}

	var request SemanticGeoIndexRequest
	if err := c.BindJSON(&request); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	if err := validateSemanticGeoIndexRequest(&request); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	if api == nil || api.pgGeoStore == nil {
		c.JSON(503, gin.H{"error": "geo store is not initialized"})
		return
	}

	requests, err := resolveSemanticGeoIndexRequests(request)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}

	if len(requests) == 1 {
		jobID := ""
		if api.jobHub != nil {
			job := api.jobHub.createJob("semantic_geo_index", requests[0].S3Path)
			jobID = job.ID
		}

		result, err := api.runSemanticGeoIndexJob(requests[0], jobID)
		if err != nil {
			c.JSON(500, gin.H{"error": err.Error()})
			return
		}

		c.IndentedJSON(200, gin.H{
			"count":   result.Count,
			"indexed": result.Indexed,
			"status":  "finished",
			"items":   result.Items,
			"job_id":  jobID,
		})
		return
	}

	jobResults := make(chan semanticGeoIndexJobResult, len(requests))
	jobIDs := make([]string, 0, len(requests))

	for _, jobRequest := range requests {
		jobID := ""
		if api.jobHub != nil {
			job := api.jobHub.createJob("semantic_geo_index", jobRequest.S3Path)
			jobID = job.ID
			jobIDs = append(jobIDs, jobID)
		}
		requestCopy := jobRequest
		go func(jobID string, request SemanticGeoIndexRequest) {
			result, err := api.runSemanticGeoIndexJob(request, jobID)
			jobResults <- semanticGeoIndexJobResult{Result: result, Err: err}
		}(jobID, requestCopy)
	}

	aggregate := SemanticGeoIndexResult{Items: []SemanticGeoIndexItem{}}
	var firstErr error
	for i := 0; i < len(requests); i++ {
		jobResult := <-jobResults
		if jobResult.Err != nil && firstErr == nil {
			firstErr = jobResult.Err
		}
		aggregate.Count += jobResult.Result.Count
		aggregate.Indexed += jobResult.Result.Indexed
		aggregate.Items = append(aggregate.Items, jobResult.Result.Items...)
	}

	if firstErr != nil {
		c.JSON(500, gin.H{
			"error":   firstErr.Error(),
			"job_ids": jobIDs,
		})
		return
	}

	c.IndentedJSON(200, gin.H{
		"count":   aggregate.Count,
		"indexed": aggregate.Indexed,
		"status":  "finished",
		"items":   aggregate.Items,
		"job_id":  firstJobID(jobIDs),
		"job_ids": jobIDs,
	})
}

type SemanticGeoIndexResult struct {
	Count   int
	Indexed int
	Items   []SemanticGeoIndexItem
}

type semanticGeoIndexJobResult struct {
	Result SemanticGeoIndexResult
	Err    error
}

func validateSemanticGeoIndexRequest(request *SemanticGeoIndexRequest) error {
	if request == nil {
		return fmt.Errorf("request is required")
	}

	if request.S3Path == "" {
		return fmt.Errorf("s3_path is required")
	}

	if request.Region == "" {
		return fmt.Errorf("region is required")
	}

	if !s3RegionPattern.MatchString(request.Region) {
		return fmt.Errorf("region has invalid format")
	}

	if request.BBoxMinX > request.BBoxMaxX || request.BBoxMinY > request.BBoxMaxY {
		return fmt.Errorf("bbox min values must be less than or equal to max values")
	}

	if !request.All {
		if request.Count == nil || *request.Count <= 0 {
			return fmt.Errorf("count is required when all is false")
		}
	}

	return nil
}

func (api *API) runSemanticGeoIndexJob(request SemanticGeoIndexRequest, jobID string) (SemanticGeoIndexResult, error) {
	result := SemanticGeoIndexResult{Items: []SemanticGeoIndexItem{}}
	failJob := func(err error) (SemanticGeoIndexResult, error) {
		if api != nil && api.jobHub != nil && jobID != "" {
			api.jobHub.updateJob(jobID, func(job *IndexingJob) {
				job.Status = "failed"
				job.Error = err.Error()
				job.FinishedAt = time.Now().UTC().Format(time.RFC3339)
			})
		}
		return result, err
	}

	if api == nil || api.pgGeoStore == nil {
		return failJob(fmt.Errorf("geo store is not initialized"))
	}

	if api.jobHub != nil && jobID != "" {
		api.jobHub.updateJob(jobID, func(job *IndexingJob) {
			job.Status = "running"
		})
	}

	db, err := sql.Open("duckdb", "")
	if err != nil {
		return failJob(fmt.Errorf("failed to open DuckDB: %w", err))
	}
	defer db.Close()

	if err := initDuckDBS3(db, request.Region); err != nil {
		return failJob(fmt.Errorf("failed to initialize DuckDB S3 access: %w", err))
	}

	totalAvailable, err := countSemanticGeoItemsTotal(db, request)
	if err != nil {
		return failJob(err)
	}

	countToIndex := totalAvailable
	if !request.All && request.Count != nil && *request.Count < totalAvailable {
		countToIndex = *request.Count
	}

	result.Count = int(countToIndex)
	result.Indexed = 0
	result.Items = make([]SemanticGeoIndexItem, 0, result.Count)

	if api.jobHub != nil && jobID != "" {
		api.jobHub.updateJob(jobID, func(job *IndexingJob) {
			job.TotalPoints = result.Count
		})
	}

	if result.Count == 0 {
		if _, err := api.pgGeoStore.DeleteEmptyIndexedAreas(); err != nil {
			return failJob(fmt.Errorf("failed to delete empty indexed areas: %w", err))
		}

		if api.jobHub != nil && jobID != "" {
			api.jobHub.updateJob(jobID, func(job *IndexingJob) {
				job.Status = "completed"
				job.FinishedAt = time.Now().UTC().Format(time.RFC3339)
			})
		}
		return result, nil
	}

	query := `
		SELECT
			id,
			names.primary AS name,
			categories.primary AS category_primary,
			to_json(categories.alternate) AS category_alternate_json,
			taxonomy.primary AS taxonomy_primary,
			to_json(taxonomy.hierarchy) AS taxonomy_hierarchy_json,
			addresses[1].locality AS locality,
			addresses[1].country AS country,
			bbox.xmin AS bbox_min_x,
			bbox.xmax AS bbox_max_x,
			bbox.ymin AS bbox_min_y,
			bbox.ymax AS bbox_max_y
		FROM read_parquet(?)
		WHERE bbox.xmin >= ? AND bbox.xmax <= ? AND bbox.ymin >= ? AND bbox.ymax <= ?
	`

	args := []interface{}{
		request.S3Path,
		request.BBoxMinX,
		request.BBoxMaxX,
		request.BBoxMinY,
		request.BBoxMaxY,
	}

	if !request.All {
		query += " LIMIT ?"
		args = append(args, *request.Count)
	}

	rows, err := db.Query(query, args...)
	if err != nil {
		return failJob(fmt.Errorf("failed to query DuckDB: %w", err))
	}
	defer rows.Close()

	batchSize := 128
	batchRows := make([]semanticGeoRow, 0, batchSize)
	batchItems := make([]SemanticGeoIndexItem, 0, batchSize)
	batchTexts := make([]string, 0, batchSize)
	processed := 0

	processBatch := func() error {
		if len(batchTexts) == 0 {
			return nil
		}

		embeddings, err := getBatchEmbeddings(batchTexts)
		if err != nil {
			return err
		}

		if len(embeddings) != len(batchItems) {
			return fmt.Errorf("embedding count mismatch")
		}

		places := make([]storage.GeoPlace, len(batchItems))
		for i, row := range batchRows {
			raw, err := buildSemanticGeoRaw(row)
			if err != nil {
				return err
			}

			lon, lat := centroidFromBBox(row.BboxMinX, row.BboxMaxX, row.BboxMinY, row.BboxMaxY)
			places[i] = storage.GeoPlace{
				ID:         row.ID,
				EmbedText:  batchItems[i].Text,
				Embedding:  embeddings[i],
				Longitude:  lon,
				Latitude:   lat,
				Category:   stringOrNil(row.CategoryPrimary),
				Country:    stringOrNil(row.Country),
				Confidence: nil,
				Raw:        raw,
			}
		}

		if err := api.pgGeoStore.AddPlaces(places); err != nil {
			return err
		}

		processed += len(batchItems)
		result.Indexed = processed

		if api.jobHub != nil && jobID != "" {
			api.jobHub.updateJob(jobID, func(job *IndexingJob) {
				job.IndexedPoints = processed
				job.Status = "running"
			})
		}

		batchRows = batchRows[:0]
		batchItems = batchItems[:0]
		batchTexts = batchTexts[:0]
		return nil
	}

	for rows.Next() {
		row, item, err := scanSemanticGeoRow(rows)
		if err != nil {
			return failJob(err)
		}

		result.Items = append(result.Items, item)
		batchRows = append(batchRows, row)
		batchItems = append(batchItems, item)
		batchTexts = append(batchTexts, item.Text)

		if len(batchTexts) >= batchSize {
			if err := processBatch(); err != nil {
				return failJob(fmt.Errorf("failed to index batch: %w", err))
			}
		}
	}

	if err := rows.Err(); err != nil {
		return failJob(fmt.Errorf("DuckDB row iteration failed: %w", err))
	}

	if err := processBatch(); err != nil {
		return failJob(fmt.Errorf("failed to index batch: %w", err))
	}

	if err := api.pgGeoStore.UpsertIndexedArea(storage.GeoIndexedArea{
		Source:        request.S3Path,
		BBoxMinX:      request.BBoxMinX,
		BBoxMaxX:      request.BBoxMaxX,
		BBoxMinY:      request.BBoxMinY,
		BBoxMaxY:      request.BBoxMaxY,
		TotalPoints:   totalAvailable,
		IndexedPoints: int64(processed),
		IndexedAt:     time.Now().UTC(),
	}); err != nil {
		return failJob(fmt.Errorf("failed to upsert indexed area: %w", err))
	}

	if api.jobHub != nil && jobID != "" {
		api.jobHub.updateJob(jobID, func(job *IndexingJob) {
			job.Status = "completed"
			job.IndexedPoints = processed
			job.FinishedAt = time.Now().UTC().Format(time.RFC3339)
		})
	}

	return result, nil
}

func countSemanticGeoItemsTotal(db *sql.DB, request SemanticGeoIndexRequest) (int64, error) {
	query := `
		SELECT COUNT(*)
		FROM read_parquet(?)
		WHERE bbox.xmin >= ? AND bbox.xmax <= ? AND bbox.ymin >= ? AND bbox.ymax <= ?
	`

	args := []interface{}{
		request.S3Path,
		request.BBoxMinX,
		request.BBoxMaxX,
		request.BBoxMinY,
		request.BBoxMaxY,
	}

	var count int64
	if err := db.QueryRow(query, args...).Scan(&count); err != nil {
		return 0, fmt.Errorf("failed to count DuckDB rows: %w", err)
	}

	return count, nil
}

func scanSemanticGeoRow(rows *sql.Rows) (semanticGeoRow, SemanticGeoIndexItem, error) {
	var (
		id                sql.NullString
		name              sql.NullString
		categoryPrimary   sql.NullString
		categoryAlternate any
		taxonomyPrimary   sql.NullString
		taxonomyHierarchy any
		locality          sql.NullString
		country           sql.NullString
		bboxMinX          sql.NullFloat64
		bboxMaxX          sql.NullFloat64
		bboxMinY          sql.NullFloat64
		bboxMaxY          sql.NullFloat64
	)

	if err := rows.Scan(
		&id,
		&name,
		&categoryPrimary,
		&categoryAlternate,
		&taxonomyPrimary,
		&taxonomyHierarchy,
		&locality,
		&country,
		&bboxMinX,
		&bboxMaxX,
		&bboxMinY,
		&bboxMaxY,
	); err != nil {
		return semanticGeoRow{}, SemanticGeoIndexItem{}, fmt.Errorf("failed to read DuckDB rows: %w", err)
	}

	alternateCategories, err := parseDuckDBStringList(categoryAlternate)
	if err != nil {
		return semanticGeoRow{}, SemanticGeoIndexItem{}, fmt.Errorf("failed to parse category list: %w", err)
	}

	taxonomyHierarchyList, err := parseDuckDBStringList(taxonomyHierarchy)
	if err != nil {
		return semanticGeoRow{}, SemanticGeoIndexItem{}, fmt.Errorf("failed to parse taxonomy list: %w", err)
	}

	row := semanticGeoRow{
		ID:                id.String,
		Name:              name.String,
		CategoryPrimary:   categoryPrimary.String,
		CategoryAlternate: alternateCategories,
		TaxonomyPrimary:   taxonomyPrimary.String,
		TaxonomyHierarchy: taxonomyHierarchyList,
		Locality:          locality.String,
		Country:           country.String,
		BboxMinX:          bboxMinX,
		BboxMaxX:          bboxMaxX,
		BboxMinY:          bboxMinY,
		BboxMaxY:          bboxMaxY,
	}

	item := SemanticGeoIndexItem{
		ID:                row.ID,
		Text:              buildSemanticText(row),
		Name:              row.Name,
		CategoryPrimary:   row.CategoryPrimary,
		CategoryAlternate: row.CategoryAlternate,
		TaxonomyHierarchy: row.TaxonomyHierarchy,
		Locality:          row.Locality,
		Country:           row.Country,
	}

	return row, item, nil
}

type semanticGeoRow struct {
	ID                string
	Name              string
	CategoryPrimary   string
	CategoryAlternate []string
	TaxonomyPrimary   string
	TaxonomyHierarchy []string
	Locality          string
	Country           string
	BboxMinX          sql.NullFloat64
	BboxMaxX          sql.NullFloat64
	BboxMinY          sql.NullFloat64
	BboxMaxY          sql.NullFloat64
}

type semanticGeoBBox struct {
	MinX float64 `json:"min_x"`
	MaxX float64 `json:"max_x"`
	MinY float64 `json:"min_y"`
	MaxY float64 `json:"max_y"`
}

type semanticGeoRaw struct {
	ID                string           `json:"id"`
	Name              string           `json:"name,omitempty"`
	CategoryPrimary   string           `json:"category_primary,omitempty"`
	CategoryAlternate []string         `json:"category_alternate,omitempty"`
	TaxonomyPrimary   string           `json:"taxonomy_primary,omitempty"`
	TaxonomyHierarchy []string         `json:"taxonomy_hierarchy,omitempty"`
	Locality          string           `json:"locality,omitempty"`
	Country           string           `json:"country,omitempty"`
	BBox              *semanticGeoBBox `json:"bbox,omitempty"`
}

func initDuckDBS3(db *sql.DB, region string) error {
	if _, err := db.Exec("INSTALL httpfs; LOAD httpfs;"); err != nil {
		return err
	}

	if err := setDuckDBConfig(db, "s3_region", region); err != nil {
		return err
	}

	if accessKey := os.Getenv("AWS_ACCESS_KEY_ID"); accessKey != "" {
		if err := setDuckDBConfig(db, "s3_access_key_id", accessKey); err != nil {
			return err
		}
	}

	if secret := os.Getenv("AWS_SECRET_ACCESS_KEY"); secret != "" {
		if err := setDuckDBConfig(db, "s3_secret_access_key", secret); err != nil {
			return err
		}
	}

	if token := os.Getenv("AWS_SESSION_TOKEN"); token != "" {
		if err := setDuckDBConfig(db, "s3_session_token", token); err != nil {
			return err
		}
	}

	if endpoint := os.Getenv("AWS_ENDPOINT_URL"); endpoint != "" {
		if err := setDuckDBConfig(db, "s3_endpoint", endpoint); err != nil {
			return err
		}
	}

	return nil
}

func setDuckDBConfig(db *sql.DB, key string, value string) error {
	escaped := strings.ReplaceAll(value, "'", "''")
	_, err := db.Exec(fmt.Sprintf("SET %s='%s'", key, escaped))
	return err
}

func parseJSONStringList(value sql.NullString) ([]string, error) {
	if !value.Valid {
		return nil, nil
	}
	raw := strings.TrimSpace(value.String)
	if raw == "" || raw == "null" {
		return nil, nil
	}

	var parsed []string
	if err := json.Unmarshal([]byte(raw), &parsed); err != nil {
		return nil, err
	}

	for i, item := range parsed {
		parsed[i] = strings.TrimSpace(item)
	}

	return parsed, nil
}

func parseDuckDBStringList(value any) ([]string, error) {
	if value == nil {
		return nil, nil
	}

	switch typed := value.(type) {
	case []interface{}:
		parsed := make([]string, 0, len(typed))
		for _, item := range typed {
			if item == nil {
				continue
			}
			switch element := item.(type) {
			case string:
				element = strings.TrimSpace(element)
				if element != "" {
					parsed = append(parsed, element)
				}
			case []byte:
				trimmed := strings.TrimSpace(string(element))
				if trimmed != "" {
					parsed = append(parsed, trimmed)
				}
			default:
				return nil, fmt.Errorf("unsupported list element type %T", item)
			}
		}
		return parsed, nil
	case string:
		return parseJSONStringList(sql.NullString{String: typed, Valid: true})
	case []byte:
		return parseJSONStringList(sql.NullString{String: string(typed), Valid: true})
	default:
		return nil, fmt.Errorf("unsupported list type %T", value)
	}
}

func resolveSemanticGeoIndexRequests(request SemanticGeoIndexRequest) ([]SemanticGeoIndexRequest, error) {
	if !shouldSplitByFile(request.S3Path) {
		return []SemanticGeoIndexRequest{request}, nil
	}

	db, err := sql.Open("duckdb", "")
	if err != nil {
		return nil, fmt.Errorf("failed to open DuckDB for file discovery: %w", err)
	}
	defer db.Close()

	if err := initDuckDBS3(db, request.Region); err != nil {
		return nil, fmt.Errorf("failed to initialize DuckDB S3 access: %w", err)
	}

	files, err := listSemanticGeoFileCounts(db, request)
	if err != nil {
		return nil, err
	}

	if len(files) <= 1 {
		return []SemanticGeoIndexRequest{request}, nil
	}

	requests := make([]SemanticGeoIndexRequest, 0, len(files))
	if request.All || request.Count == nil {
		for _, file := range files {
			if strings.TrimSpace(file.Path) == "" || file.Count == 0 {
				continue
			}
			jobRequest := request
			jobRequest.S3Path = file.Path
			requests = append(requests, jobRequest)
		}
	} else {
		remaining := *request.Count
		for _, file := range files {
			if remaining <= 0 {
				break
			}
			if strings.TrimSpace(file.Path) == "" || file.Count == 0 {
				continue
			}
			fileLimit := file.Count
			if fileLimit > remaining {
				fileLimit = remaining
			}
			limit := fileLimit
			jobRequest := request
			jobRequest.S3Path = file.Path
			jobRequest.Count = &limit
			requests = append(requests, jobRequest)
			remaining -= fileLimit
		}
	}

	if len(requests) == 0 {
		return []SemanticGeoIndexRequest{request}, nil
	}

	return requests, nil
}

type semanticGeoFileCount struct {
	Path  string
	Count int64
}

func listSemanticGeoFileCounts(db *sql.DB, request SemanticGeoIndexRequest) ([]semanticGeoFileCount, error) {
	query := `
		SELECT filename, COUNT(*) AS file_count
		FROM read_parquet(?, filename=true)
		WHERE bbox.xmin >= ? AND bbox.xmax <= ? AND bbox.ymin >= ? AND bbox.ymax <= ?
		GROUP BY filename
		ORDER BY filename
	`

	args := []interface{}{
		request.S3Path,
		request.BBoxMinX,
		request.BBoxMaxX,
		request.BBoxMinY,
		request.BBoxMaxY,
	}

	rows, err := db.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to list DuckDB parquet files: %w", err)
	}
	defer rows.Close()

	files := make([]semanticGeoFileCount, 0)
	for rows.Next() {
		var (
			filename sql.NullString
			count    sql.NullInt64
		)
		if err := rows.Scan(&filename, &count); err != nil {
			return nil, fmt.Errorf("failed to read DuckDB file list: %w", err)
		}
		if filename.Valid {
			files = append(files, semanticGeoFileCount{
				Path:  filename.String,
				Count: count.Int64,
			})
		}
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("DuckDB file list iteration failed: %w", err)
	}

	return files, nil
}

func shouldSplitByFile(path string) bool {
	return strings.ContainsAny(path, "*?[]{}")
}

func firstJobID(jobIDs []string) string {
	if len(jobIDs) == 0 {
		return ""
	}
	return jobIDs[0]
}

func buildSemanticText(row semanticGeoRow) string {
	parts := make([]string, 0, 4)

	name := strings.TrimSpace(row.Name)
	if name != "" {
		parts = append(parts, name)
	}

	categories := make([]string, 0, 2)
	if row.CategoryPrimary != "" {
		categories = append(categories, normalizeLabel(row.CategoryPrimary))
	}
	for _, alt := range row.CategoryAlternate {
		alt = normalizeLabel(strings.TrimSpace(alt))
		if alt == "" || containsString(categories, alt) {
			continue
		}
		categories = append(categories, alt)
	}
	if len(categories) > 0 {
		parts = append(parts, fmt.Sprintf("category: %s", strings.Join(categories, ", ")))
	}

	taxonomy := ""
	if len(row.TaxonomyHierarchy) > 0 {
		normalized := make([]string, 0, len(row.TaxonomyHierarchy))
		for _, item := range row.TaxonomyHierarchy {
			item = normalizeLabel(strings.TrimSpace(item))
			if item != "" {
				normalized = append(normalized, item)
			}
		}
		if len(normalized) > 0 {
			taxonomy = strings.Join(normalized, " > ")
		}
	}
	if taxonomy == "" && row.TaxonomyPrimary != "" {
		taxonomy = normalizeLabel(row.TaxonomyPrimary)
	}
	if taxonomy != "" {
		parts = append(parts, fmt.Sprintf("type: %s", taxonomy))
	}

	locationParts := make([]string, 0, 2)
	if row.Locality != "" {
		locationParts = append(locationParts, strings.TrimSpace(row.Locality))
	}
	if row.Country != "" {
		locationParts = append(locationParts, strings.TrimSpace(row.Country))
	}
	if len(locationParts) > 0 {
		parts = append(parts, fmt.Sprintf("location: %s", strings.Join(locationParts, ", ")))
	}

	return strings.Join(parts, ". ")
}

func buildSemanticGeoRaw(row semanticGeoRow) (json.RawMessage, error) {
	raw := semanticGeoRaw{
		ID:                row.ID,
		Name:              strings.TrimSpace(row.Name),
		CategoryPrimary:   strings.TrimSpace(row.CategoryPrimary),
		CategoryAlternate: row.CategoryAlternate,
		TaxonomyPrimary:   strings.TrimSpace(row.TaxonomyPrimary),
		TaxonomyHierarchy: row.TaxonomyHierarchy,
		Locality:          strings.TrimSpace(row.Locality),
		Country:           strings.TrimSpace(row.Country),
	}

	if row.BboxMinX.Valid && row.BboxMaxX.Valid && row.BboxMinY.Valid && row.BboxMaxY.Valid {
		raw.BBox = &semanticGeoBBox{
			MinX: row.BboxMinX.Float64,
			MaxX: row.BboxMaxX.Float64,
			MinY: row.BboxMinY.Float64,
			MaxY: row.BboxMaxY.Float64,
		}
	}

	payload, err := json.Marshal(raw)
	if err != nil {
		return nil, err
	}

	return payload, nil
}

func centroidFromBBox(minX, maxX, minY, maxY sql.NullFloat64) (*float64, *float64) {
	if !minX.Valid || !maxX.Valid || !minY.Valid || !maxY.Valid {
		return nil, nil
	}

	if minX.Float64 > maxX.Float64 || minY.Float64 > maxY.Float64 {
		return nil, nil
	}

	lon := (minX.Float64 + maxX.Float64) / 2
	lat := (minY.Float64 + maxY.Float64) / 2

	return &lon, &lat
}

func stringOrNil(value string) *string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}

func batchEmbedTexts(texts []string, batchSize int) ([][]float32, error) {
	if len(texts) == 0 {
		return nil, nil
	}

	if batchSize <= 0 || batchSize > len(texts) {
		batchSize = len(texts)
	}

	embeddings := make([][]float32, 0, len(texts))
	for start := 0; start < len(texts); start += batchSize {
		end := start + batchSize
		if end > len(texts) {
			end = len(texts)
		}

		batchEmbeddings, err := getBatchEmbeddings(texts[start:end])
		if err != nil {
			return nil, err
		}

		if len(batchEmbeddings) != end-start {
			return nil, fmt.Errorf("embedding batch returned %d embeddings, expected %d", len(batchEmbeddings), end-start)
		}

		embeddings = append(embeddings, batchEmbeddings...)
	}

	return embeddings, nil
}

func normalizeLabel(value string) string {
	return strings.ReplaceAll(strings.TrimSpace(value), "_", " ")
}

func containsString(values []string, target string) bool {
	for _, value := range values {
		if value == target {
			return true
		}
	}
	return false
}
