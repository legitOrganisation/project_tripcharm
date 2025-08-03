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

#include <Arduino.h>

// HardwareSerial for SIM7600 AT communication
HardwareSerial LTEGNSS(0); // UART0 for SIM7600

// Define button pin
#define BUTTON_A_PIN D10

// Define phone number to send SMS to
String phoneNumber = "+6582865626";  // Replace with your actual number

// Button state tracking
bool lastButtonState = HIGH;

void setup() {
  Serial.begin(115200);          // USB serial for debug

  delay(10000);

  LTEGNSS.begin(115200, SERIAL_8N1, -1, -1); // Use default UART0 pins for SIM7600

  pinMode(BUTTON_A_PIN, INPUT); // Assumes external pull-up

  Serial.println("Ready. Waiting for button A press...");
}

void sendSMS(String number, String message) {
  Serial.println("Sending SMS...");
  
  LTEGNSS.println("AT+CMGF=1"); // Set SMS mode to text
  delay(500);

  LTEGNSS.print("AT+CMGS=\"");
  LTEGNSS.print(number);
  LTEGNSS.println("\"");
  delay(500);

  LTEGNSS.print(message);
  LTEGNSS.write(26); // Ctrl+Z to send
  delay(1000);

  Serial.println("SMS sent.");
}

void loop() {
  bool buttonState = digitalRead(BUTTON_A_PIN);

  if (lastButtonState == HIGH && buttonState == LOW) {
    // Button A pressed (detected falling edge)
    sendSMS(phoneNumber, "SOS was pressed!");
  }

  lastButtonState = buttonState;

  // Print any responses from module
  while (LTEGNSS.available()) {
    Serial.write(LTEGNSS.read());
  }

  delay(100);
}
