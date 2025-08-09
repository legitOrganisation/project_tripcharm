#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_LSM6DS.h>

Adafruit_LSM6DS lsm6ds;

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("LSM6DSL I2C Test");

  // Use GPIO4 (SDA), GPIO5 (SCL) — XIAO ESP32C3
  Wire.begin(4, 5);
  Wire.setClock(100000);  // Optional: set I2C speed

  // Try address 0x6A (SDO tied LOW). Use 0x6B if SDO is HIGH.
  while (!lsm6ds.begin_I2C(0x6A)) {
    Serial.println("Could not find LSM6DSL sensor, check wiring!");
    delay(500);
  }

  Serial.println("LSM6DSL found!");

  // Optional sensor config
  lsm6ds.setAccelRange(LSM6DS_ACCEL_RANGE_4_G);
  lsm6ds.setGyroRange(LSM6DS_GYRO_RANGE_250_DPS);
  lsm6ds.setAccelDataRate(LSM6DS_RATE_104_HZ);
  lsm6ds.setGyroDataRate(LSM6DS_RATE_104_HZ);
}

void loop() {
  sensors_event_t accel, gyro, temp;

  if (lsm6ds.getEvent(&accel, &gyro, &temp)) {
    Serial.print("Temperature: ");
    Serial.print(temp.temperature);
    Serial.println(" °C");

    Serial.print("Accel X: "); Serial.print(accel.acceleration.x);
    Serial.print(" Y: "); Serial.print(accel.acceleration.y);
    Serial.print(" Z: "); Serial.println(accel.acceleration.z);

    Serial.print("Gyro X: "); Serial.print(gyro.gyro.x);
    Serial.print(" Y: "); Serial.print(gyro.gyro.y);
    Serial.print(" Z: "); Serial.println(gyro.gyro.z);

    Serial.println();
  } else {
    Serial.println("Failed to read IMU data.");
  }

  delay(500);
}