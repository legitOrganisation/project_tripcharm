#include <Arduino.h>
#include <Wire.h>

// Customize these if needed (XIAO default I²C = D4/D5 → GPIO4/GPIO5)
#define SDA_PIN 4
#define SCL_PIN 5

void scanI2C() {
  byte address;
  int count = 0;

  for (address = 1; address < 127; address++) {
    Wire.beginTransmission(address);
    byte error = Wire.endTransmission();

    if (error == 0) {
      Serial.print("I2C device found at 0x");
      if (address < 16) Serial.print("0");
      Serial.println(address, HEX);
      count++;
    } else if (error == 4) {
      Serial.print("Unknown error at 0x");
      if (address < 16) Serial.print("0");
      Serial.println(address, HEX);
    }
  }

  if (count == 0) {
    Serial.println("No I2C devices found.");
  } else {
    Serial.print("Scan complete. Devices found: ");
    Serial.println(count);
  }
}

void setup() {
  Serial.begin(115200);
  delay(5000); // Let Serial stabilize

  Serial.println("Starting I2C Scanner...");
  Wire.begin(SDA_PIN, SCL_PIN);
  Wire.setClock(100000); // 100kHz for max compatibility

  delay(100); // Let bus stabilize

  scanI2C();
}

void loop() {
  // Do nothing — scan once only
}