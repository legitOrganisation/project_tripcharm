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