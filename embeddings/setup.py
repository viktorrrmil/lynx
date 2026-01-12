from setuptools import setup, find_packages

setup(
    name='embeddings',
    version='0.1.0',
    packages=find_packages(),
    install_requires=[
        'sentence-transformers>=2.2.0',
        'torch>=2.0.0',
        'numpy>=1.24.0',
        'tqdm>=4.65.0',
    ],
)