cmake_minimum_required(VERSION 4.1)
project(lynx)

set(CMAKE_CXX_STANDARD 14)

add_executable(lynx
        src/main.cpp
        include/lynx/bruteforce_index.h
        src/bruteforce_index.cpp
        src/serialization.cpp
        include/lynx/vector_index.h
        include/lynx/serialization.h
        include/lynx/index_registry.h
        include/lynx/index_loader.h
        src/index_loader.cpp
        src/index_registry.cpp
        include/lynx/utils/metric.h
        src/utils/metric.cpp
)
