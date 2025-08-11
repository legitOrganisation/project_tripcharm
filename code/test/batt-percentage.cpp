#include <Arduino.h>

#define BATT_PIN 1 // D1 on XIAO ESP32C3
#define DIVIDER_RATIO 11.0f
#define BATT_MIN_VOLT 3.0f
#define BATT_MAX_VOLT 4.2f

void setup() {
  Serial.begin(115200);
  analogReadResolution(12);
}

void loop() {
  // Get ADC voltage at the pin
  float v_pin = analogReadMilliVolts(BATT_PIN) / 1000.0f;

  // Scale up to battery voltage
  float v_batt = v_pin * DIVIDER_RATIO;

  // Linear % mapping
  float percent = (v_batt - BATT_MIN_VOLT) * 100.0f / (BATT_MAX_VOLT - BATT_MIN_VOLT);
  percent = constrain(percent, 0, 100);

  Serial.printf("Vpin: %.3f V | Vbatt: %.3f V | %.1f%%\n", v_pin, v_batt, percent);

  delay(1000);
}