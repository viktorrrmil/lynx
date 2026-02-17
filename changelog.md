### Up to February 15, 2025
(A really brief summary of the project development up to this point. A high-level overview of the key milestones and achievements in the project development.)

- Developed BruteForce (for baseline) and IVF indexing methods for efficient vector search and retrieval.
- Made the library scalable and efficient, having a shared memory architecture that allows multiple indexes to access the same data without duplication, reducing memory usage and improving performance.
- Implemented Go bindings for the vector search library, allowing seamless integration with the Go API.
- Go API connects embeddings to the vector search library, enabling efficient storage and retrieval of vector data.
- Created a simple frontend interface to demonstrate the capabilities of the vector search library and Go API for testing and showcasing purposes.

### February 16, 2025

- Created a new changelog file to document changes and updates in the project. This will help keep track of modifications and improvements over time.
- Added PostgreSQL + pgvector support for embedding persistence, avoiding the need for embedding datasets every time the application is restarted.
- Add index status panel to the frontend interface to track specs of indexes like size, nlist, nprobe, etc.
- Configurable nlist and nprobe parameters for IVF indexing, so that we can easily adjust the indexing and search parameters to optimize performance based on the specific use case and dataset characteristics. This allows for better control over the trade-off between search accuracy and speed.
- Add recall@k evaluation metric to the frontend interface.

### February 17, 2025

- Added benchmarking tool
- Optimized the IVF training process by implementing kmeans++ initialization and parallelizing the training process

[benchmark_screenshot](benchmark_screenshot.png)
