// #include <Arduino.h>

// HardwareSerial LTEGNSS(0);

// void setup() {
//   Serial.begin(115200);

//   delay(10000);

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

// // HardwareSerial for SIM7600 AT communication
// HardwareSerial LTEGNSS(0); // UART0 for SIM7600

// // Define button pin
// #define BUTTON_A_PIN D10

// // Define phone number to send SMS to
// String phoneNumber = "+6582865626";  // Replace with your actual number

// // Button state tracking
// bool lastButtonState = HIGH;

// void setup() {
//   Serial.begin(115200);          // USB serial for debug

//   delay(10000);

//   LTEGNSS.begin(115200, SERIAL_8N1, -1, -1); // Use default UART0 pins for SIM7600

//   pinMode(BUTTON_A_PIN, INPUT); // Assumes external pull-up

//   Serial.println("Ready. Waiting for button A press...");
// }

// void sendSMS(String number, String message) {
//   Serial.println("Sending SMS...");
  
//   LTEGNSS.println("AT+CMGF=1"); // Set SMS mode to text
//   delay(500);

//   LTEGNSS.print("AT+CMGS=\"");
//   LTEGNSS.print(number);
//   LTEGNSS.println("\"");
//   delay(500);

//   LTEGNSS.print(message);
//   LTEGNSS.write(26); // Ctrl+Z to send
//   delay(1000);

//   Serial.println("SMS sent.");
// }

// void loop() {
//   bool buttonState = digitalRead(BUTTON_A_PIN);

//   if (lastButtonState == HIGH && buttonState == LOW) {
//     // Button A pressed (detected falling edge)
//     sendSMS(phoneNumber, "SOS was pressed!");
//   }

//   lastButtonState = buttonState;

//   // Print any responses from module
//   while (LTEGNSS.available()) {
//     Serial.write(LTEGNSS.read());
//   }

//   delay(100);
// }

#include <Arduino.h>

HardwareSerial LTEGNSS(0);  // UART0 for SIM7600

#define BUTTON_A_PIN D10
String phoneNumber = "+6582865626";  // Replace with your number

bool lastButtonState = HIGH;

void setup() {
  Serial.begin(115200);
  delay(10000);  // Allow USB upload to complete

  LTEGNSS.begin(115200, SERIAL_8N1, -1, -1);
  pinMode(BUTTON_A_PIN, INPUT);

  Serial.println("Ready. Enabling GPS...");

  LTEGNSS.println("AT+CGPS=1");  // Enable GPS
  delay(2000);
}

// Reads GPS location using AT+CGPSINFO
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

  // Parse the +CGPSINFO line
  int idx = response.indexOf("+CGPSINFO:");
  if (idx == -1 || response.indexOf(",,,,,,,,") != -1) {
    return "GPS not ready yet.";
  }

  int start = response.indexOf(":", idx) + 1;
  String gpsData = response.substring(start);
  gpsData.trim();

  // Split the GPS info fields
  int latEnd = gpsData.indexOf(',', 0);
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

void loop() {
  bool buttonState = digitalRead(BUTTON_A_PIN);

  if (lastButtonState == HIGH && buttonState == LOW) {
    Serial.println("Button A pressed!");
    String gpsMessage = getGPSInfo();
    Serial.println("Sending: " + gpsMessage);
    sendSMS(phoneNumber, gpsMessage);
  }

  lastButtonState = buttonState;
 
  while (LTEGNSS.available()) {
    Serial.write(LTEGNSS.read());
  }

  delay(100);
}
