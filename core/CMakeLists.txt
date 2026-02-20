cmake_minimum_required(VERSION 3.20)
project(lynx LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Enable OpenMP for parallel k-means
find_package(OpenMP)
if(OpenMP_CXX_FOUND)
    message(STATUS "OpenMP found, enabling parallel k-means")
else()
    message(STATUS "OpenMP not found, using single-threaded k-means")
endif()

enable_testing()

add_library(lynx_core
        src/bruteforce_index.cpp
        src/in_memory_vector_store.cpp
        src/ivf_index.cpp
        src/utils/metric.cpp
        src/utils/file_utils.cpp
        src/utils/math.cpp
        src/utils/k_means/kmeans.cpp
        src/index_loader.cpp
        src/index_registry.cpp
        src/serialization.cpp
        src/utils/logging.cpp
)

target_include_directories(lynx_core
        PUBLIC ${PROJECT_SOURCE_DIR}/include
)

add_executable(lynx
        src/main.cpp
        bindings/python/lynx_bindings.cpp
        bindings/go/wrapper/bruteforce_index_wrapper.cpp
        bindings/go/wrapper/bruteforce_index_wrapper.h
        src/utils/k_means/__main__.cpp
        src/utils/k_means/kmeans.cpp
        include/lynx/ivf_index.h
        src/ivf_index.cpp
        bindings/go/wrapper/ivf_index_wrapper.cpp
        bindings/go/wrapper/ivf_index_wrapper.h
        include/lynx/vector_store.h
        src/in_memory_vector_store.cpp
        include/lynx/in_memory_vector_store.h
        bindings/go/wrapper/in_memory_vector_store_wrapper.h
        bindings/go/wrapper/in_memory_vector_store_wrapper.cpp
        include/lynx/utils/logging.h
)

target_link_libraries(lynx
        lynx_core
        $<$<BOOL:${OpenMP_CXX_FOUND}>:OpenMP::OpenMP_CXX>
)

include(FetchContent)

FetchContent_Declare(
        googletest
        URL https://github.com/google/googletest/archive/03597a01ee50ed33e9dfd640b249b4be3799d395.zip
)

FetchContent_MakeAvailable(googletest)

add_subdirectory(tests)