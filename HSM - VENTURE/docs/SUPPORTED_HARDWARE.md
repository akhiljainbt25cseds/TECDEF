# Supported Hardware Reference Guide

## 1. Apple Silicon & macOS (MacBook Pro / MacBook Air / Mac mini / Studio)
* **Apple M-Series**: M1, M2, M3, M4, M5 (Base, Pro, Max, Ultra).
* **Telemetry**: Native `sysctl`, `ioreg`, `vm_stat`, and `pmset` integration.
* **Apple Smart Battery**: Real-time battery percentage, cycle count, battery health %, cell temperature, and charging status via MagSafe / USB-C.
* **Unified Memory**: Real-time unified LPDDR5X allocation and memory headroom.
* **Storage**: APFS flash storage capacity and real read/write throughput.

## 2. Processors (CPU - Windows & Linux)
* **AMD Ryzen Desktop & Mobile**: 3000, 5000, 7000, 9000 Series (per-core usage, package temp via k10temp / LHM).
* **Intel Core**: 10th - 14th Gen Desktop & Core Ultra (package power, core clocks, thermal throttling flags).

## 3. Graphics Cards (GPU)
* **Apple Silicon Integrated GPU**: Unified architecture GPU with dynamic MetalFX allocation.
* **NVIDIA GeForce**: GTX 10-Series, RTX 20/30/40/50 Series via PyNVML / `nvidia-smi` (core temp, hotspot temp, VRAM MB, wattage, fan speed %).
* **AMD Radeon**: RX 5000/6000/7000 Series via LibreHardwareMonitor JSON server.

## 4. Fans & Coolers
* **MacBook Active Cooling**: Apple Silicon quiet blowers (Left/Right) with zero-RPM silent idle state.
* **Motherboard Headers**: ASUS, MSI, Gigabyte, ASRock (via LibreHardwareMonitor).
* **AIO Liquid Coolers**: NZXT Kraken, Corsair iCUE Commander, Arctic Liquid Freezer.
* **Safety Limits**: Minimum fan speed hardcoded to 40% under gaming load to prevent stall.
