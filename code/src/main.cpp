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

#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_LSM6DS3TRC.h>

Adafruit_LSM6DS3TRC imu;

void setup() {
  Serial.begin(115200);

  Wire.begin(D4, D5);

  while (!imu.begin_I2C(0x6A, &Wire)) {
    Serial.println("Failed to find LSM6DSL");
  }

  Serial.println("LSM6DSL initialized.");
}

void loop() {
  Serial.println("test");

  sensors_event_t accel, gyro, temp;
  imu.getEvent(&accel, &gyro, &temp);

  Serial.printf("Accel [m/s^2] X: %.2f Y: %.2f Z: %.2f\n", accel.acceleration.x, accel.acceleration.y, accel.acceleration.z);
  Serial.printf("Gyro [rad/s]   X: %.2f Y: %.2f Z: %.2f\n\n", gyro.gyro.x, gyro.gyro.y, gyro.gyro.z);

  delay(500);
}

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
  
//   delay(10000);

//   Serial.println("I2C Scanner:");
//   for (uint8_t address = 1; address < 127; ++address) {
//     Wire.beginTransmission(address);
//     if (Wire.endTransmission() == 0) {
//       Serial.print("Found I2C device at 0x");
//       Serial.println(address, HEX);
//       delay(10);
//     }
//   }
//   Serial.println("Scan complete.");
// }

// void loop() {}