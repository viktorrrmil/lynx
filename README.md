# Lynx - Vector Search Engine

A prototype vector search engine with support for multiple indexing algorithms. This project implements core vector search functionality with a shared index architecture where vectors are viewed by indexes rather than owned by them.

> **Note:** This is a prototype version focused on core algorithms and vector engine business logic. No application layer has been implemented yet.

![search_screenshot](search_screenshot.png)

## Overview

This is an experimental vector search engine built to explore different indexing and search algorithms. The current implementation includes:

- **Brute Force**: Baseline exhaustive search for accuracy comparison
- **IVF (Inverted File Index)**: Efficient approximate nearest neighbor search using clustering
- **IVF-PQ (Inverted File Index with Product Quantization)**: Memory-efficient variant of IVF that compresses vectors using product quantization for reduced memory footprint

## Current Status

🚧 **Prototype Phase** 🚧

Currently implemented:
- Brute force search (baseline)
- IVF indexing algorithm
- IVF-PQ indexing algorithm (IVF with Product Quantization)
- HNSW indexing algorithm (Hierarchical Navigable Small World Graphs)
- Benchmarking tools for performance analysis and parameter optimization
- Core vector storage and retrieval
- Shared index architecture

Not yet implemented:
- Application layer (APIs, UI, etc.)
- More optimized embedding pipelines

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


> **Note:** Currently only .txt files are supported for the file upload, and it is ingested row by row.

## Algorithms

### Brute Force
Exhaustive search comparing query vectors against all stored vectors. Used as a baseline for accuracy comparison and for small datasets.

### IVF (Inverted File Index)
Clusters vectors into partitions (Voronoi cells) for efficient approximate nearest neighbor search. Queries only search relevant partitions, significantly reducing search space.

### IVF-PQ (Inverted File Index with Product Quantization)
Combines IVF clustering with product quantization for memory-efficient vector search. Vectors are compressed using learned codebooks while maintaining search accuracy, making it suitable for large-scale deployments with memory constraints.

### HNSW (Hierarchical Navigable Small World Graphs)
A graph-based indexing algorithm that builds a multi-layer navigable small world graph for efficient approximate nearest neighbor search. HNSW provides high recall and low latency, making it suitable for large datasets and high-dimensional vector spaces.

## Benchmarking

The engine includes powerful benchmarking tools to evaluate and optimize algorithm performance across all indexing methods.

### Comprehensive Cross-Index Benchmarking
The comprehensive benchmark compares **all four indexing algorithms** (BruteForce, IVF, IVF-PQ, and HNSW) using the same queries, providing detailed performance metrics for each:

- **Multi-Index Comparison**: Run identical queries across all indexes simultaneously
- **Statistical Analysis**: Mean, median, min, max, and standard deviation for recall and latency
- **Per-Index Summaries**: Detailed breakdowns of recall, latency, and speedup for each algorithm
- **Decision Support**: Make data-driven choices for index selection based on your specific requirements
  - High recall needed? → Compare HNSW vs IVF metrics
  - Maximum speed required? → Compare IVF-PQ vs IVF speedup
  - Balanced performance? → Analyze recall-latency tradeoffs across all indexes

> **Note**: The following benchmark is from a dataset of 125k 384-dimensional vectors.

![Comprehensive Benchmark](comprehensive_benchmark.png)

### Algorithm-Specific Parameter Optimization

#### IVF Parameter Sweep
- **Parameter Sweep**: Automated testing of different `nlist` (number of clusters) and `nprobe` (clusters to search) combinations
- **Multi-dimensional Analysis**: Evaluate trade-offs between recall, latency, and memory usage
- **Smart Recommendations**: Algorithm suggests optimal parameter combinations based on:
  - **Best Speedup**: Maximum performance improvement
  - **Best Recall**: Highest search accuracy 
  - **Best Latency**: Fastest search times
  - **Balanced**: Optimal trade-off between recall and speed using elbow curve analysis

![IVF Parameter Sweep](ivf_param_sweep_screenshot.png)

#### IVF-PQ Parameter Sweep
- **Extended Parameter Space**: Test combinations of `nlist`, `nprobe`, `m` (subquantizers), and `codebook_size`
- **Compression Analysis**: Understand the impact of product quantization parameters on recall and memory
- **Production Optimization**: Find the sweet spot between memory efficiency and search quality

## Architecture

The engine uses a shared index model where:
- Vectors are stored independently
- Multiple indexes can reference the same vectors
- Indexes provide different search strategies over the same data
