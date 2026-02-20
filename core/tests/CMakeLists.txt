add_executable(lynx_core_tests
        test_vector_store.cpp
        test_bruteforce.cpp
        test_ivf.cpp
)

target_link_libraries(lynx_core_tests
        lynx_core
        gtest
        gtest_main
)

include(GoogleTest)
gtest_discover_tests(lynx_core_tests)