// #include <Arduino.h>

// HardwareSerial LTEGNSS(0);

// void setup() {
//   Serial.begin(115200);
//   LTEGNSS.begin(115200, SERIAL_8N1, -1, -1);
// }

// void loop() {
//   LTEGNSS.println("AT");
//   if (LTEGNSS.available()) {
//     String str  = LTEGNSS.readStringUntil('\r');
//     Serial.println(str);
//   }

//   // read from port 0, send to port 1:
//   if (Serial.available()) {
//     String str = Serial.readStringUntil('\r');
//     Serial.println(str);
//   }
// }

// #include <Arduino.h>
// #include <Wire.h>
// #include <Adafruit_LSM6DS3TRC.h>

// Adafruit_LSM6DS3TRC imu;

// void setup() {
//   Serial.begin(115200);

//   Wire.begin(D4, D5);

//   while (!imu.begin_I2C(0x6A, &Wire)) {
//     Serial.println("Failed to find LSM6DSL");
//   }

//   Serial.println("LSM6DSL initialized.");
// }

// void loop() {
//   Serial.println("test");

//   sensors_event_t accel, gyro, temp;
//   imu.getEvent(&accel, &gyro, &temp);

//   Serial.printf("Accel [m/s^2] X: %.2f Y: %.2f Z: %.2f\n", accel.acceleration.x, accel.acceleration.y, accel.acceleration.z);
//   Serial.printf("Gyro [rad/s]   X: %.2f Y: %.2f Z: %.2f\n\n", gyro.gyro.x, gyro.gyro.y, gyro.gyro.z);

//   delay(500);
// }

// #include <Arduino.h>
// #include <Wire.h>
// #include <Adafruit_BMP3XX.h>

// Adafruit_BMP3XX bmp;

// void setup() {
//   Serial.begin(115200);

//   Serial.println("BMP390 I2C Test");

//   while (!bmp.begin_I2C(0x76)) {  // Change to 0x77 if needed
//     Serial.println("Could not find a valid BMP390 sensor, check wiring!");
//   }

//   bmp.setTemperatureOversampling(BMP3_OVERSAMPLING_8X);
//   bmp.setPressureOversampling(BMP3_OVERSAMPLING_4X);
//   bmp.setIIRFilterCoeff(BMP3_IIR_FILTER_COEFF_3);
//   bmp.setOutputDataRate(BMP3_ODR_50_HZ);
// }

// void loop() {
//   if (!bmp.performReading()) {
//     Serial.println("Failed to perform reading :(");
//     return;
//   }
//   Serial.print("Temperature = ");
//   Serial.print(bmp.temperature);
//   Serial.println(" *C");

//   Serial.print("Pressure = ");
//   Serial.print(bmp.pressure / 100.0);
//   Serial.println(" hPa");

//   delay(1000);
// }


// void setup() {
//   Wire.begin();  // SDA = GPIO6, SCL = GPIO7 on XIAO ESP32C3
//   Serial.begin(115200);
  
//   delay(5000);

//   Serial.println("I2C Scanner:");
//   for (uint8_t address = 1; address < 127; ++address) {
//     Wire.beginTransmission(address);
//     Serial.println(address);
//     if (Wire.endTransmission() == 0) {
//       Serial.print("Found I2C device at 0x");
//       Serial.println(address, HEX);
//       delay(10);
//     }
//   }
//   Serial.println("Scan complete.");
// }

// void loop() {
//   for (uint8_t address = 1; address < 127; ++address) {
//     Wire.beginTransmission(address);
//     // Serial.println(address);
//     if (Wire.endTransmission() == 0) {
//       Serial.print("Found I2C device at 0x");
//       Serial.println(address, HEX);
//       delay(5);
//     }
//   }
//   Serial.println("passed");
// }

#include <Arduino.h>
#include <Wire.h>

#define PULSE_PIN D3  // D3 on XIAO ESP32-C3 = GPIO7

void setup() {
  pinMode(PULSE_PIN, OUTPUT);
}

void loop() {
  digitalWrite(PULSE_PIN, HIGH);
  delay(200);  // HIGH for 100 ms

  digitalWrite(PULSE_PIN, LOW);
  delay(200);  // LOW for 100 ms
}

// #include <Arduino.h>
// #include <Wire.h>

// // Customize these if needed (XIAO default I²C = D4/D5 → GPIO4/GPIO5)
// #define SDA_PIN 4
// #define SCL_PIN 5

// void scanI2C() {
//   byte address;
//   int count = 0;

//   for (address = 1; address < 127; address++) {
//     Wire.beginTransmission(address);
//     byte error = Wire.endTransmission();

//     if (error == 0) {
//       Serial.print("I2C device found at 0x");
//       if (address < 16) Serial.print("0");
//       Serial.println(address, HEX);
//       count++;
//     } else if (error == 4) {
//       Serial.print("Unknown error at 0x");
//       if (address < 16) Serial.print("0");
//       Serial.println(address, HEX);
//     }
//   }

//   if (count == 0) {
//     Serial.println("No I2C devices found.");
//   } else {
//     Serial.print("Scan complete. Devices found: ");
//     Serial.println(count);
//   }
// }

// void setup() {
//   Serial.begin(115200);
//   delay(5000); // Let Serial stabilize

//   Serial.println("Starting I2C Scanner...");
//   Wire.begin(SDA_PIN, SCL_PIN);
//   Wire.setClock(100000); // 100kHz for max compatibility

//   delay(100); // Let bus stabilize

//   scanI2C();
// }

// void loop() {
//   // Do nothing — scan once only
// }

// #include <Arduino.h>
// #include <Wire.h>
// #include <Adafruit_LSM6DS.h>

// Adafruit_LSM6DS lsm6ds;

// void setup() {
//   Serial.begin(115200);
//   delay(500);
//   Serial.println("LSM6DSL I2C Test");

//   // Use GPIO4 (SDA), GPIO5 (SCL) — XIAO ESP32C3
//   Wire.begin(4, 5);
//   Wire.setClock(100000);  // Optional: set I2C speed

//   // Try address 0x6A (SDO tied LOW). Use 0x6B if SDO is HIGH.
//   while (!lsm6ds.begin_I2C(0x6A)) {
//     Serial.println("Could not find LSM6DSL sensor, check wiring!");
//     delay(500);
//   }

//   Serial.println("LSM6DSL found!");

//   // Optional sensor config
//   lsm6ds.setAccelRange(LSM6DS_ACCEL_RANGE_4_G);
//   lsm6ds.setGyroRange(LSM6DS_GYRO_RANGE_250_DPS);
//   lsm6ds.setAccelDataRate(LSM6DS_RATE_104_HZ);
//   lsm6ds.setGyroDataRate(LSM6DS_RATE_104_HZ);
// }

// void loop() {
//   sensors_event_t accel, gyro, temp;

//   if (lsm6ds.getEvent(&accel, &gyro, &temp)) {
//     Serial.print("Temperature: ");
//     Serial.print(temp.temperature);
//     Serial.println(" °C");

//     Serial.print("Accel X: "); Serial.print(accel.acceleration.x);
//     Serial.print(" Y: "); Serial.print(accel.acceleration.y);
//     Serial.print(" Z: "); Serial.println(accel.acceleration.z);

//     Serial.print("Gyro X: "); Serial.print(gyro.gyro.x);
//     Serial.print(" Y: "); Serial.print(gyro.gyro.y);
//     Serial.print(" Z: "); Serial.println(gyro.gyro.z);

//     Serial.println();
//   } else {
//     Serial.println("Failed to read IMU data.");
//   }

//   delay(500);
// }
