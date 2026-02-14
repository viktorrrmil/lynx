package data_store

import (
	"encoding/binary"
	"fmt"
	"io"
	"os"
)

type VectorCache struct {
	filepath string
}

const magicNumber uint32 = 0x4C594E58
const fileVersion uint32 = 1

func NewVectorCache(filepath string) *VectorCache {
	return &VectorCache{filepath: filepath}
}

func (vc *VectorCache) FilePath() string {
	return vc.filepath
}

func (vc *VectorCache) Exists() bool {
	_, err := os.Stat(vc.filepath)
	return err == nil
}

func (vc *VectorCache) Save(vector [][]float32) error {
	if len(vector) == 0 {
		return nil
	}

	f, err := os.Create(vc.filepath)
	if err != nil {
		return fmt.Errorf("could not create vector file: %v", err)
	}
	defer f.Close()

	count := int64(len(vector))
	dims := int32(len(vector[0]))

	if err := binary.Write(f, binary.LittleEndian, magicNumber); err != nil {
		return fmt.Errorf("failed to write magic number: %v", err)
	}

	if err := binary.Write(f, binary.LittleEndian, fileVersion); err != nil {
		return fmt.Errorf("failed to write file version: %v", err)
	}

	if err := binary.Write(f, binary.LittleEndian, count); err != nil {
		return fmt.Errorf("failed to write vector count: %v", err)
	}

	if err := binary.Write(f, binary.LittleEndian, dims); err != nil {
		return fmt.Errorf("failed to write vector dimensions: %v", err)
	}

	totalFloats := count * int64(dims)
	flatData := make([]float32, totalFloats)

	idx := 0
	for _, vec := range vector {
		if len(vec) != int(dims) {
			return fmt.Errorf("vector size mismatch: %d vector(s) expected %d", len(vec), dims)
		}
		copy(flatData[idx:], vec)
		idx += int(dims)
	}

	if err := binary.Write(f, binary.LittleEndian, flatData); err != nil {
		return fmt.Errorf("failed to write vector data: %v", err)
	}

	fmt.Printf("Saved %d vectors with dimension %d to cache\n", count, dims)

	return nil
}

func (vc *VectorCache) Load() ([][]float32, error) {
	f, err := os.Open(vc.filepath)
	if err != nil {
		return nil, fmt.Errorf("could not open vector file: %v", err)
	}
	defer f.Close()

	var magic, version uint32
	var count int64
	var dims int32

	if err := binary.Read(f, binary.LittleEndian, &magic); err != nil {
		return nil, fmt.Errorf("failed to read magic number: %v", err)
	}

	if magic != magicNumber {
		return nil, fmt.Errorf("invalid magic number: expected 0x%X, got 0x%X", magicNumber, magic)
	}

	if err := binary.Read(f, binary.LittleEndian, &version); err != nil {
		return nil, fmt.Errorf("failed to read version: %v", err)
	}

	if version != fileVersion {
		return nil, fmt.Errorf("unsupported file version: expected %d, got %d", fileVersion, version)
	}

	if err := binary.Read(f, binary.LittleEndian, &count); err != nil {
		return nil, fmt.Errorf("failed to read count: %v", err)
	}

	if err := binary.Read(f, binary.LittleEndian, &dims); err != nil {
		return nil, fmt.Errorf("failed to read dimension: %v", err)
	}

	totalFloats := int(count) * int(dims)
	flatData := make([]float32, totalFloats)

	if err := binary.Read(f, binary.LittleEndian, flatData); err != nil {
		if err == io.EOF {
			return nil, fmt.Errorf("unexpected end of file (file might be corrupted)")
		}
		return nil, fmt.Errorf("failed to read vector data: %w", err)
	}

	vectors := make([][]float32, count)
	for i := range vectors {
		start := i * int(dims)
		end := start + int(dims)
		vectors[i] = flatData[start:end]
	}

	fmt.Printf("Loaded %d vectors with dimension %d from cache\n", count, dims)

	return vectors, nil
}

func (vc *VectorCache) GetInfo() (count int64, dims int32, err error) {
	f, err := os.Open(vc.filepath)
	if err != nil {
		return 0, 0, fmt.Errorf("could not open vector file: %v", err)
	}
	defer f.Close()

	var magic, version uint32
	binary.Read(f, binary.LittleEndian, &magic)
	binary.Read(f, binary.LittleEndian, &version)
	binary.Read(f, binary.LittleEndian, &count)
	binary.Read(f, binary.LittleEndian, &dims)

	return count, dims, nil
}
