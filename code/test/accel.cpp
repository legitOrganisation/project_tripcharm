#include <Arduino.h>
#include <Adafruit_BNO08x.h>

#define BNO08X_RESET -1
Adafruit_BNO08x bno08x(BNO08X_RESET);
sh2_SensorValue_t sensorValue;

// threshold in Gs for impact (e.g. hit, bump, shake)
#define IMPACT_THRESHOLD_G 40

void setup() {
  Serial.begin(115200);
  while (!Serial) delay(10);
  Serial.println("BNO08x Accelerometer Impact Detection");

  if (!bno08x.begin_I2C()) {
    Serial.println("Failed to find BNO08x");
    while (1) delay(10);
  }

  Serial.println("BNO08x Found!");

  if (!bno08x.enableReport(SH2_ACCELEROMETER)) {
    Serial.println("Could not enable accelerometer");
  }

  delay(100);
}

void loop() {
  if (bno08x.wasReset()) {
    Serial.println("Sensor was reset");
    bno08x.enableReport(SH2_ACCELEROMETER);
  }

  if (!bno08x.getSensorEvent(&sensorValue)) return;

  if (sensorValue.sensorId == SH2_ACCELEROMETER) {
    float ax = sensorValue.un.accelerometer.x;
    float ay = sensorValue.un.accelerometer.y;
    float az = sensorValue.un.accelerometer.z;

    float accTotal = sqrt(ax * ax + ay * ay + az * az);

    Serial.print("Accel (g): X=");
    Serial.print(ax, 2); Serial.print(" Y=");
    Serial.print(ay, 2); Serial.print(" Z=");
    Serial.print(az, 2); Serial.print(" | Total=");
    Serial.println(accTotal, 2);

    if (accTotal > IMPACT_THRESHOLD_G) {
      Serial.print("Impact detected! Total Acceleration = ");
      Serial.print(accTotal, 2); Serial.println(" g");
      delay(500);  // debounce
    }
  }
}
