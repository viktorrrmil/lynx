package main

import (
	"fmt"
	"sync"
	"time"
)

type IndexingJob struct {
	ID            string `json:"id"`
	Type          string `json:"type"`
	Status        string `json:"status"`
	TotalPoints   int    `json:"total_points"`
	IndexedPoints int    `json:"indexed_points"`
	Source        string `json:"source"`
	StartedAt     string `json:"started_at"`
	FinishedAt    string `json:"finished_at,omitempty"`
	Error         string `json:"error,omitempty"`
}

type IndexingJobEvent struct {
	Kind    string        `json:"kind"`
	Job     *IndexingJob  `json:"job,omitempty"`
	Jobs    []IndexingJob `json:"jobs,omitempty"`
	Message string        `json:"message,omitempty"`
}

type indexingJobHub struct {
	mu               sync.RWMutex
	jobs             map[string]*IndexingJob
	subscribers      map[int]chan IndexingJobEvent
	nextSubscriberID int
}

func newIndexingJobHub() *indexingJobHub {
	return &indexingJobHub{
		jobs:        make(map[string]*IndexingJob),
		subscribers: make(map[int]chan IndexingJobEvent),
	}
}

func (hub *indexingJobHub) subscribe() (int, <-chan IndexingJobEvent, []IndexingJob) {
	hub.mu.Lock()
	defer hub.mu.Unlock()

	id := hub.nextSubscriberID
	hub.nextSubscriberID++
	ch := make(chan IndexingJobEvent, 64)
	hub.subscribers[id] = ch

	snapshot := hub.snapshotLocked()
	return id, ch, snapshot
}

func (hub *indexingJobHub) unsubscribe(id int) {
	hub.mu.Lock()
	ch, ok := hub.subscribers[id]
	if ok {
		delete(hub.subscribers, id)
		close(ch)
	}
	hub.mu.Unlock()
}

func (hub *indexingJobHub) createJob(jobType string, source string) *IndexingJob {
	job := &IndexingJob{
		ID:            fmt.Sprintf("geo-%d", time.Now().UnixNano()),
		Type:          jobType,
		Status:        "queued",
		TotalPoints:   0,
		IndexedPoints: 0,
		Source:        source,
		StartedAt:     time.Now().UTC().Format(time.RFC3339),
	}

	hub.mu.Lock()
	hub.jobs[job.ID] = job
	snapshot := copyIndexingJob(job)
	hub.mu.Unlock()

	hub.broadcast(IndexingJobEvent{Kind: "update", Job: &snapshot})
	return job
}

func (hub *indexingJobHub) updateJob(id string, update func(*IndexingJob)) {
	hub.mu.Lock()
	job := hub.jobs[id]
	if job == nil {
		hub.mu.Unlock()
		return
	}
	update(job)
	snapshot := copyIndexingJob(job)
	hub.mu.Unlock()

	hub.broadcast(IndexingJobEvent{Kind: "update", Job: &snapshot})
}

func (hub *indexingJobHub) snapshotLocked() []IndexingJob {
	snapshot := make([]IndexingJob, 0, len(hub.jobs))
	for _, job := range hub.jobs {
		snapshot = append(snapshot, copyIndexingJob(job))
	}
	return snapshot
}

func (hub *indexingJobHub) broadcast(event IndexingJobEvent) {
	hub.mu.RLock()
	defer hub.mu.RUnlock()

	for _, ch := range hub.subscribers {
		select {
		case ch <- event:
		default:
			select {
			case <-ch:
			default:
			}
			select {
			case ch <- event:
			default:
			}
		}
	}
}

func copyIndexingJob(job *IndexingJob) IndexingJob {
	if job == nil {
		return IndexingJob{}
	}
	return IndexingJob{
		ID:            job.ID,
		Type:          job.Type,
		Status:        job.Status,
		TotalPoints:   job.TotalPoints,
		IndexedPoints: job.IndexedPoints,
		Source:        job.Source,
		StartedAt:     job.StartedAt,
		FinishedAt:    job.FinishedAt,
		Error:         job.Error,
	}
}
