package main

import (
	"time"

	"github.com/gin-gonic/gin"
)

func (api *API) getIndexedAreas(c *gin.Context) {
	if api == nil || api.pgGeoStore == nil {
		c.JSON(503, gin.H{"error": "geo store is not initialized"})
		return
	}

	if _, err := api.pgGeoStore.DeleteEmptyIndexedAreas(); err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}

	areas, err := api.pgGeoStore.ListIndexedAreas()
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}

	response := make([]IndexedArea, 0, len(areas))
	for _, area := range areas {
		percent := 0.0
		if area.TotalPoints > 0 {
			percent = (float64(area.IndexedPoints) / float64(area.TotalPoints)) * 100
		}

		response = append(response, IndexedArea{
			Source: area.Source,
			BBox: IndexedAreaBBox{
				MinX: area.BBoxMinX,
				MaxX: area.BBoxMaxX,
				MinY: area.BBoxMinY,
				MaxY: area.BBoxMaxY,
			},
			TotalPoints:    area.TotalPoints,
			IndexedPoints:  area.IndexedPoints,
			IndexedPercent: percent,
			IndexedAt:      area.IndexedAt.UTC().Format(time.RFC3339),
		})
	}

	c.IndentedJSON(200, IndexedAreasResponse{Areas: response})
}
