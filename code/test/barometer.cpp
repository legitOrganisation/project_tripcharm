#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_BMP3XX.h>

Adafruit_BMP3XX bmp;

void setup() {
  Serial.begin(115200);

  Serial.println("BMP390 I2C Test");

  while (!bmp.begin_I2C(0x76)) {  // Change to 0x77 if needed
    Serial.println("Could not find a valid BMP390 sensor, check wiring!");
  }

  bmp.setTemperatureOversampling(BMP3_OVERSAMPLING_8X);
  bmp.setPressureOversampling(BMP3_OVERSAMPLING_4X);
  bmp.setIIRFilterCoeff(BMP3_IIR_FILTER_COEFF_3);
  bmp.setOutputDataRate(BMP3_ODR_50_HZ);
}

void loop() {
  if (!bmp.performReading()) {
    Serial.println("Failed to perform reading :(");
    return;
  }
  Serial.print("Temperature = ");
  Serial.print(bmp.temperature);
  Serial.println(" *C");

  Serial.print("Pressure = ");
  Serial.print(bmp.pressure / 100.0);
  Serial.println(" hPa");

  delay(1000);
}