// #include <Arduino.h>
// #include <Wire.h>
// #include <Adafruit_BNO08x.h>

#include <Arduino.h>
#include <Adafruit_BNO08x.h>

// SIM7600
HardwareSerial LTEGNSS(0);  // UART0 for SIM7600
String phoneNumber = "+6582865626";

// Button
#define BUTTON_A_PIN D10
bool lastButtonState = HIGH;

// BNO08x
#define BNO08X_RESET -1
Adafruit_BNO08x bno08x(BNO08X_RESET);
sh2_SensorValue_t sensorValue;
#define IMPACT_THRESHOLD_G 40

// Flags
bool messageSentRecently = false;
unsigned long lastTriggerTime = 0;
const unsigned long triggerCooldown = 10000;  // ms

void setup() {
  Serial.begin(115200);
  delay(10000);  // Let USB settle

  // Button setup
  pinMode(BUTTON_A_PIN, INPUT);

  // SIM7600 init
  LTEGNSS.begin(115200, SERIAL_8N1, -1, -1);
  Serial.println("Initializing GPS...");
  LTEGNSS.println("AT+CGPS=1");  // Enable GPS
  delay(2000);

  // BNO08x init
  Serial.println("Initializing BNO08x...");
  if (!bno08x.begin_I2C()) {
    Serial.println("Failed to find BNO08x");
    while (1) delay(10);
  }
  Serial.println("BNO08x Found!");
  bno08x.enableReport(SH2_ACCELEROMETER);
}

String getGPSInfo() {
  LTEGNSS.println("AT+CGPSINFO");
  delay(1000);

  String response = "";
  unsigned long timeout = millis();
  while (millis() - timeout < 2000) {
    if (LTEGNSS.available()) {
      char c = LTEGNSS.read();
      response += c;
    }
  }

  Serial.println("GPS response:");
  Serial.println(response);

  int idx = response.indexOf("+CGPSINFO:");
  if (idx == -1 || response.indexOf(",,,,,,,,") != -1) {
    return "GPS not ready yet.";
  }

  int start = response.indexOf(":", idx) + 1;
  String gpsData = response.substring(start);
  gpsData.trim();

  int latEnd = gpsData.indexOf(',');
  int nsEnd = gpsData.indexOf(',', latEnd + 1);
  int lonEnd = gpsData.indexOf(',', nsEnd + 1);
  int ewEnd = gpsData.indexOf(',', lonEnd + 1);

  String lat = gpsData.substring(0, latEnd);
  String ns = gpsData.substring(latEnd + 1, nsEnd);
  String lon = gpsData.substring(nsEnd + 1, lonEnd);
  String ew = gpsData.substring(lonEnd + 1, ewEnd);

  if (lat.length() < 3 || lon.length() < 3) return "Invalid GPS fix.";

  return "SOS triggered. GPS: " + lat + " " + ns + ", " + lon + " " + ew;
}

void sendSMS(String number, String message) {
  Serial.println("Sending SMS...");
  LTEGNSS.println("AT+CMGF=1");
  delay(500);
  LTEGNSS.print("AT+CMGS=\"");
  LTEGNSS.print(number);
  LTEGNSS.println("\"");
  delay(500);
  LTEGNSS.print(message);
  LTEGNSS.write(26);  // Ctrl+Z
  delay(3000);
  Serial.println("SMS sent.");
}

void checkImpact() {
  if (bno08x.wasReset()) {
    Serial.println("BNO08x was reset");
    bno08x.enableReport(SH2_ACCELEROMETER);
  }

  if (bno08x.getSensorEvent(&sensorValue) && sensorValue.sensorId == SH2_ACCELEROMETER) {
    float ax = sensorValue.un.accelerometer.x;
    float ay = sensorValue.un.accelerometer.y;
    float az = sensorValue.un.accelerometer.z;
    float accTotal = sqrt(ax * ax + ay * ay + az * az);

    if (accTotal > IMPACT_THRESHOLD_G && millis() - lastTriggerTime > triggerCooldown) {
      Serial.print("Impact detected: ");
      Serial.println(accTotal, 2);
      lastTriggerTime = millis();
      String msg = getGPSInfo();
      sendSMS(phoneNumber, "Impact detected! " + msg);
    }
  }
}

void loop() {
  // Check button
  bool buttonState = digitalRead(BUTTON_A_PIN);
  if (lastButtonState == HIGH && buttonState == LOW && millis() - lastTriggerTime > triggerCooldown) {
    Serial.println("Button A pressed!");
    lastTriggerTime = millis();
    String msg = getGPSInfo();
    sendSMS(phoneNumber, msg);
  }
  lastButtonState = buttonState;

  // Check for impact
  checkImpact();

  // Clear LTEGNSS buffer
  while (LTEGNSS.available()) {
    Serial.write(LTEGNSS.read());
  }

  delay(50);
}
