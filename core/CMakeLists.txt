cmake_minimum_required(VERSION 3.20)
project(lynx LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

enable_testing()

add_library(lynx_core
        src/bruteforce_index.cpp
        src/utils/metric.cpp
        src/index_loader.cpp
        src/index_registry.cpp
        src/serialization.cpp
)

target_include_directories(lynx_core
        PUBLIC ${PROJECT_SOURCE_DIR}/include
)

add_executable(lynx
        src/main.cpp
        bindings/python/lynx_bindings.cpp
        bindings/go/bruteforce_index_wrapper.cpp
        bindings/go/bruteforce_index_wrapper.h
)

target_link_libraries(lynx
        lynx_core
)

include(FetchContent)

FetchContent_Declare(
        googletest
        URL https://github.com/google/googletest/archive/03597a01ee50ed33e9dfd640b249b4be3799d395.zip
)

FetchContent_MakeAvailable(googletest)

add_subdirectory(tests)