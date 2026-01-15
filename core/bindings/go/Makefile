CORE_DIR = ../..
WRAPPER_DIR = wrapper
INCLUDE_DIR = $(CORE_DIR)/include
SRC_DIR = $(CORE_DIR)/src
LIB_DIR = $(CORE_DIR)/lib

CORE_SOURCES = \
	$(SRC_DIR)/bruteforce_index.cpp \
	$(SRC_DIR)/serialization.cpp \
	$(SRC_DIR)/index_loader.cpp \
	$(SRC_DIR)/index_registry.cpp \
	$(SRC_DIR)/utils/metric.cpp

WRAPPER_SOURCE = $(WRAPPER_DIR)/bruteforce_index_wrapper.cpp

.PHONY: build-wrapper clean

build-wrapper:
	@echo "Building C++ wrapper library..."
	mkdir -p $(LIB_DIR)
	g++ -std=c++20 -shared -fPIC \
		-I$(INCLUDE_DIR) \
		-o $(LIB_DIR)/liblynx_go.so \
		$(WRAPPER_SOURCE) \
		$(CORE_SOURCES)
	@echo "✓ Library built: $(LIB_DIR)/liblynx_go.so"

clean:
	rm -f $(LIB_DIR)/liblynx_go.so
	@echo "✓ Cleaned"

test: build-wrapper
	@echo "Running Go tests..."
	CGO_CFLAGS="-I$(INCLUDE_DIR)" \
	CGO_LDFLAGS="-L$(LIB_DIR) -llynx_go -lstdc++" \
	LD_LIBRARY_PATH="$(shell pwd)/$(LIB_DIR)" go test -v ./lynx/...
