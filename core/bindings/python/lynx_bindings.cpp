#include <pybind11/pybind11.h>
#include <pybind11/stl.h>
#include "../../include/lynx/bruteforce_index.h"
#include "../../include/lynx/index_loader.h"

namespace py = pybind11;

PYBIND11_MODULE(lynx, m) {
    m.doc() = "Lynx Vector Search Engine";

    py::enum_<DistanceMetric>(m, "DistanceMetric")
        .value("L2", DistanceMetric::L2)
        .value("COSINE", DistanceMetric::COSINE)
        .export_values();

    py::class_<BruteForceIndex>(m, "BruteForceIndex")
        .def(py::init<long, DistanceMetric>(),
            py::arg("dimension"),
            py::arg("metric") = DistanceMetric::L2)
        .def("add_vector", &BruteForceIndex::add_vector,
            py::arg("id"),
            py::arg("vector_data"))
        .def("search",
            &BruteForceIndex::search,
            py::arg("query"),
            py::arg("k"))
        .def("size", &BruteForceIndex::size)
        .def("save", &BruteForceIndex::save,
            py::arg("path"))
        .def("dimension", &BruteForceIndex::dimension)
        .def("metric", &BruteForceIndex::metric);

    m.def("load", &IndexLoader::load,
        py::arg("path"),
        "Load an index from file");
}