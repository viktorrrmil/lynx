add_executable(lynx_core_tests
        testing_test.cpp
        test_bruteforce.cpp
        test_serialization.cpp
        test_utils.cpp
)

target_link_libraries(lynx_core_tests
        lynx_core
        gtest
        gtest_main
)

include(GoogleTest)
gtest_discover_tests(lynx_core_tests)