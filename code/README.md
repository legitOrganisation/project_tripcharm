# Child Safety Device Firmware

## Structure

- `main.cpp` – Entry point (setup + loop)
- `imu.*` – IMU initialization and reading (LSM6DSL or BNO085)
- `gps_lte.*` – SIM7600 AT commands (LTE + GPS)
- `vibration.*` – Fall detection and vibration logic
- `constants.h` – Shared pin numbers, thresholds, and config

## Platform

- Seeed Studio XIAO ESP32-C3
- PlatformIO build system
- Libraries:
  - Adafruit BNO08x
  - TinyGPS++ [NOT CONFIRMED]
  - SoftwareSerial (if needed for LTE)

## Build

```bashz
pio run
pio upload
