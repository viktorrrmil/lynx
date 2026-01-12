from setuptools import setup, Extension
from setuptools.command.build_ext import build_ext
import sys


# Helper class to determine the pybind11 include path
class get_pybind_include:
    def __init__(self, user=False):
        self.user = user

    def __str__(self):
        import pybind11
        return pybind11.get_include(self.user)

ext_modules = [
    Extension(
        'lynx',
        sources=[
            'lynx_bindings.cpp',
            '../../src/bruteforce_index.cpp',
            '../../src/index_loader.cpp',
            '../../src/index_registry.cpp',
            '../../src/serialization.cpp',
            '../../src/utils/file_utils.cpp',
            '../../src/utils/math.cpp',
            '../../src/utils/metric.cpp',
        ],
        include_dirs=[
            get_pybind_include(),
            get_pybind_include(user=True),
            '../../include',
        ],
        language='c++',
        extra_compile_args=['-std=c++17'],
    ),
]

setup(
    name='lynx',
    version='0.0.1',
    author='Viktor',
    description='Lynx Vector Search Engine',
    ext_modules=ext_modules,
    setup_requires=['pybind11>=2.6.0'],
    install_requires=['pybind11>=2.6.0'],
    zip_safe=False,
    python_requires='>=3.7',
)