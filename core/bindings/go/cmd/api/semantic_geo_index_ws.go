package main

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

type SemanticGeoIndexSocketMessage struct {
	Action  string                   `json:"action"`
	Request *SemanticGeoIndexRequest `json:"request,omitempty"`
}

var semanticGeoIndexUpgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		origin := r.Header.Get("Origin")
		return origin == "" || origin == "http://localhost:5173"
	},
}

func (api *API) semanticGeoSearchIndexWebSocket(c *gin.Context) {
	conn, err := semanticGeoIndexUpgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}
	defer conn.Close()

	if api == nil || api.jobHub == nil {
		_ = conn.WriteJSON(IndexingJobEvent{Kind: "error", Message: "job hub is not initialized"})
		return
	}

	subscriberID, events, snapshot := api.jobHub.subscribe()
	defer api.jobHub.unsubscribe(subscriberID)

	if err := conn.WriteJSON(IndexingJobEvent{Kind: "snapshot", Jobs: snapshot}); err != nil {
		return
	}

	go func() {
		for event := range events {
			if err := conn.WriteJSON(event); err != nil {
				break
			}
		}
	}()

	for {
		var message SemanticGeoIndexSocketMessage
		if err := conn.ReadJSON(&message); err != nil {
			break
		}

		if message.Action != "start" || message.Request == nil {
			_ = conn.WriteJSON(IndexingJobEvent{Kind: "error", Message: "invalid request payload"})
			continue
		}

		if err := validateSemanticGeoIndexRequest(message.Request); err != nil {
			_ = conn.WriteJSON(IndexingJobEvent{Kind: "error", Message: err.Error()})
			continue
		}

		requests, err := resolveSemanticGeoIndexRequests(*message.Request)
		if err != nil {
			_ = conn.WriteJSON(IndexingJobEvent{Kind: "error", Message: err.Error()})
			continue
		}

		for _, jobRequest := range requests {
			job := api.jobHub.createJob("semantic_geo_index", jobRequest.S3Path)
			requestCopy := jobRequest
			go func(jobID string, request SemanticGeoIndexRequest) {
				_, _ = api.runSemanticGeoIndexJob(request, jobID)
			}(job.ID, requestCopy)
		}
	}

}
