//
// Created by viktor on 2/6/26.
//

#include <ctime>
#include <fstream>
#include <iostream>
#include <ostream>
#include <string>

void debug_log(const std::string &message) {
    long timestamp = std::time(nullptr);

    long hour = (timestamp / 3600) % 24;
    long minute = (timestamp / 60) % 60;
    long second = timestamp % 60;

    std::string formatted_message = "DEBUG [" + std::to_string(hour) + ":" + std::to_string(minute) + ":" +
                                    std::to_string(second) + "]: " + message;

    std::cerr << message << std::endl;

    std::ofstream f("/tmp/lynx_debug.log", std::ios::app);
    if (f.is_open()) {
        f << formatted_message << std::endl;
    }
    f.close();
}
