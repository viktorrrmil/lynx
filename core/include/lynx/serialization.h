//
// Created by viktor on 12/10/25.
//

#ifndef LYNX_SERIALIZATION_H
#define LYNX_SERIALIZATION_H
#include <iosfwd>
#include <string>
#include <vector>

std::string const MAGIC_HEADER = "LYNXVEC";
int64_t const VERSION = 1;

// Write functions

bool write_int64(std::ofstream& out, int64_t value);
bool write_float(std::ofstream& out, float value);
bool write_float_vector(std::ofstream& out, const std::vector<float>& vector);

bool write_magic(std::ofstream& out);

// Read functions

bool read_int64(std::ifstream& in, int64_t& value);
bool read_float(std::ifstream& in, float& value);
bool read_float_vector(std::ifstream& in, std::vector<float>& vector, size_t dimension);

bool read_magic(std::ifstream& in);

#endif //LYNX_SERIALIZATION_H