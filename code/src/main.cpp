// #include <Arduino.h>
// #include <Wire.h>
// #include <Adafruit_BNO08x.h>

#include <Arduino.h>

HardwareSerial LTEGNSS(0);

void setup() {
  Serial.begin(115200);
  LTEGNSS.begin(115200, SERIAL_8N1, -1, -1);
}

void loop() {
  LTEGNSS.println("AT+CREG?");
  if (LTEGNSS.available()) {
    String str  = LTEGNSS.readStringUntil('\r');
    Serial.println(str);
  }

  // read from port 0, send to port 1:
  if (Serial.available()) {
    String str = Serial.readStringUntil('\r');
    Serial.println(str);
  }
}