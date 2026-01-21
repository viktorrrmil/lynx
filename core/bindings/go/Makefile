# Paths relative to core/bindings/go/
CORE_DIR = ../..
WRAPPER_DIR = wrapper
INCLUDE_DIR = $(CORE_DIR)/include
SRC_DIR = $(CORE_DIR)/src
LIB_DIR = $(CORE_DIR)/lib

# Detect OS
UNAME_S := $(shell uname -s)
ifeq ($(UNAME_S),Linux)
    LIB_EXT = so
    LIB_NAME = liblynx_go.$(LIB_EXT)
    LDFLAGS_EXTRA = -Wl,-rpath,$(shell pwd)/$(LIB_DIR)
endif
ifeq ($(UNAME_S),Darwin)
    LIB_EXT = dylib
    LIB_NAME = liblynx_go.$(LIB_EXT)
    LDFLAGS_EXTRA = -Wl,-rpath,@loader_path/$(LIB_DIR)
endif

# Source files needed
CORE_SOURCES = \
	$(SRC_DIR)/bruteforce_index.cpp \
	$(SRC_DIR)/ivf_index.cpp \
	$(SRC_DIR)/serialization.cpp \
	$(SRC_DIR)/index_loader.cpp \
	$(SRC_DIR)/index_registry.cpp \
	$(SRC_DIR)/utils/metric.cpp \
	$(SRC_DIR)/utils/k_means/kmeans.cpp

.PHONY: build-wrapper build-go test run clean

WRAPPER_SOURCES = \
	$(BRUTEFORCE_WRAPPER_SOURCE) \
	$(IVF_WRAPPER_SOURCE)

build-wrapper:
	@echo "Building C++ wrapper library for $(UNAME_S)..."
	mkdir -p $(LIB_DIR)
	g++ -std=c++20 -shared -fPIC \
		-I$(INCLUDE_DIR) \
		-o $(LIB_DIR)/$(LIB_NAME) \
		$(WRAPPER_SOURCES) \
		$(CORE_SOURCES)
ifeq ($(UNAME_S),Darwin)
	install_name_tool -id @rpath/$(LIB_NAME) $(LIB_DIR)/$(LIB_NAME)
endif
	@echo "[OK] Library built: $(LIB_DIR)/$(LIB_NAME)"

build-api: build-wrapper
	@echo "Building API server..."
ifeq ($(UNAME_S),Darwin)
	CGO_CFLAGS="-I$(INCLUDE_DIR)" \
	CGO_LDFLAGS="-L$(LIB_DIR) -llynx_go -lstdc++ -Wl,-rpath,$(shell pwd)/$(LIB_DIR)" \
	go build -o bin/lynx-api cmd/api/main.go
else
	CGO_CFLAGS="-I$(INCLUDE_DIR)" \
	CGO_LDFLAGS="-L$(LIB_DIR) -llynx_go -lstdc++" \
	go build -o bin/lynx-api cmd/api/main.go
endif
	@echo "✓ API built: bin/lynx-api"

run: build-api
	@echo "Starting API server on :8080..."
ifeq ($(UNAME_S),Darwin)
	DYLD_LIBRARY_PATH="$(shell pwd)/$(LIB_DIR)" ./bin/lynx-api
else
	LD_LIBRARY_PATH="$(shell pwd)/$(LIB_DIR)" ./bin/lynx-api
endif

clean:
	rm -f $(LIB_DIR)/liblynx_go.*
	@echo "[OK] Cleaned"