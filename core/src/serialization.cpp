//
// Created by viktor on 12/10/25.
//

#include "../include/lynx/serialization.h"

#include <fstream>


// Write functions

bool write_int64(std::ofstream &out, int64_t value) {
    out.write(reinterpret_cast<const char*>(&value), sizeof(value));
    return out.good();
}

bool write_float(std::ofstream &out, float value) {
    out.write(reinterpret_cast<const char*>(&value), sizeof(value));
    return out.good();
}

bool write_float_vector(std::ofstream &out, const std::vector<float> &vector) {
    for (float value : vector) {
        if (!write_float(out, value)) {
            return false;
        }
    }
    return true;
}

bool write_magic(std::ofstream &out) {
    out.write(MAGIC_HEADER.c_str(), MAGIC_HEADER.size());
    return out.good();
}


// Read functions

bool read_int64(std::ifstream &in, int64_t &value) {
    in.read(reinterpret_cast<char*>(&value), sizeof(value));
    return in.good();
}

bool read_float(std::ifstream &in, float &value) {
    in.read(reinterpret_cast<char*>(&value), sizeof(value));
    return in.good();
}

bool read_float_vector(std::ifstream &in, std::vector<float> &vector, size_t dimension) {
    vector.resize(dimension);
    for (size_t i = 0; i < dimension; ++i) {
        if (!read_float(in, vector[i])) {
            return false;
        }
    }
    return true;
}

bool read_magic(std::ifstream &in) {
    std::string buffer(MAGIC_HEADER.size(), '\0');
    in.read(&buffer[0], buffer.size());
    return in.good() && buffer == MAGIC_HEADER;
}
