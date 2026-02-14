# Binary file format for vector store (.bin)

This document describes the on-disk binary layout used to store vectors in a compact .bin file for the LYNX project.

## Summary
- Endianness: little-endian (x86/x86_64).
- Float format: IEEE-754 float32 for vector components.
- Header size: fixed 20 bytes.

## File layout (byte offsets)

| Offset (bytes) | Size (bytes) | Type    | Name    | Description                             |
|:--------------:|:------------:|:--------|:--------|:----------------------------------------|
|       0        |      4       | char[4] | magic   | ASCII magic: "LYNX" (4 bytes)           |
|       4        |      4       | uint32  | version | Format version (currently 1)            |
|       8        |      8       | uint64  | count   | Number of vectors stored                |
|       16       |      4       | uint32  | dims    | Number of dimensions per vector         |
|       20       |      N       | float32 | vectors | count × dims float32 values (row-major) |

## Notes
- The header occupies bytes 0..19 (20 bytes). The data section starts at offset 20.
- Each vector is stored contiguously as dims float32 values. Order: vector0[0..dims-1], vector1[0..dims-1], ...
- Total file size in bytes = 20 + (count × dims × 4).

## Example
- dims = 128, count = 1000
- Data bytes = 1000 × 128 × 4 = 512000
- File size = 20 + 512000 = 512020 bytes