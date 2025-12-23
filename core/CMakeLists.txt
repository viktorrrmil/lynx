cmake_minimum_required(VERSION 4.1)
project(lynx)

set(CMAKE_CXX_STANDARD 14)

add_executable(lynx
        src/main.cpp
        include/lynx/bruteforce_index.h
        src/bruteforce_index.cpp
        src/index_loader.cpp
        src/index_registry.cpp
        src/serialization.cpp
        include/lynx/vector_index.h
        include/lynx/index_registry.h
        include/lynx/index_loader.h
        include/lynx/utils/metric.h
        src/utils/file_utils.cpp
        src/utils/math.cpp
        src/utils/metric.cpp
)
