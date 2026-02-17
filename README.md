# Lynx - Vector Search Engine

A prototype vector search engine with support for multiple indexing algorithms. This project implements core vector search functionality with a shared index architecture where vectors are viewed by indexes rather than owned by them.

> **Note:** This is a prototype version focused on core algorithms and vector engine business logic. No application layer has been implemented yet.

[search_screenshot](search_screenshot.png)

## Overview

This is an experimental vector search engine built to explore different indexing and search algorithms. The current implementation includes:

- **Brute Force**: Baseline exhaustive search for accuracy comparison
- **IVF (Inverted File Index)**: Efficient approximate nearest neighbor search using clustering

## Current Status

🚧 **Prototype Phase** 🚧

Currently implemented:
- IVF indexing algorithm
- Brute force search (baseline)
- Core vector storage and retrieval
- Shared index architecture

Not yet implemented:
- Application layer
- Additional indexing algorithms (e.g., HNSW, PQ)
- Performance optimizations
- More optimized embedding pipelines and embedding storage

## Prerequisites

- Docker
- Docker Compose

## Getting Started

### Running the Project

```bash
# Build and start all services
docker compose up

# Or if you need to rebuild
docker compose build
docker compose up
```

### Stopping the Project

```bash
# Stop all services
docker compose down

# Stop and remove volumes
docker compose down -v
```

### Saving/Loading Database State

```bash
# To backup the database state to a file
docker compose exec postgres pg_dump -U lynx lynx > backup.sql

# To restore the database state from a file
docker compose exec -T postgres psql -U lynx lynx < backup.sql
```

## Algorithms

### Brute Force
Exhaustive search comparing query vectors against all stored vectors. Used as a baseline for accuracy comparison and for small datasets.

### IVF (Inverted File Index)
Clusters vectors into partitions (Voronoi cells) for efficient approximate nearest neighbor search. Queries only search relevant partitions, significantly reducing search space.

## Architecture

The engine uses a shared index model where:
- Vectors are stored independently
- Multiple indexes can reference the same vectors
- Indexes provide different search strategies over the same data
