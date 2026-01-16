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
	$(SRC_DIR)/serialization.cpp \
	$(SRC_DIR)/index_loader.cpp \
	$(SRC_DIR)/index_registry.cpp \
	$(SRC_DIR)/utils/metric.cpp

WRAPPER_SOURCE = $(WRAPPER_DIR)/bruteforce_index_wrapper.cpp

.PHONY: build-wrapper build-go test run clean

build-wrapper:
	@echo "Building C++ wrapper library for $(UNAME_S)..."
	mkdir -p $(LIB_DIR)
	g++ -std=c++20 -shared -fPIC \
		-I$(INCLUDE_DIR) \
		-o $(LIB_DIR)/$(LIB_NAME) \
		$(WRAPPER_SOURCE) \
		$(CORE_SOURCES)
ifeq ($(UNAME_S),Darwin)
	install_name_tool -id @rpath/$(LIB_NAME) $(LIB_DIR)/$(LIB_NAME)
endif
	@echo "✓ Library built: $(LIB_DIR)/$(LIB_NAME)"

test: build-wrapper
	@echo "Running Go tests..."
ifeq ($(UNAME_S),Darwin)
	CGO_CFLAGS="-I$(INCLUDE_DIR)" \
	CGO_LDFLAGS="-L$(LIB_DIR) -llynx_go -lstdc++ -Wl,-rpath,$(shell pwd)/$(LIB_DIR)" \
	go test -v ./lynx/...
else
	CGO_CFLAGS="-I$(INCLUDE_DIR)" \
	CGO_LDFLAGS="-L$(LIB_DIR) -llynx_go -lstdc++" \
	LD_LIBRARY_PATH="$(shell pwd)/$(LIB_DIR)" \
	go test -v ./lynx/...
endif

clean:
	rm -f $(LIB_DIR)/liblynx_go.*
	@echo "✓ Cleaned"