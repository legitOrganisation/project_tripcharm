#include <Arduino.h>

// SIM7600
HardwareSerial LTEGNSS(0);  // UART0 for SIM7600

// Send AT command and wait for a response
String sendAT(String cmd, uint32_t wait_ms = 500) {
  LTEGNSS.println(cmd);
  delay(wait_ms);
  String response = "";
  while (LTEGNSS.available()) {
    response += char(LTEGNSS.read());
  }
  response.trim();
  Serial.println("> " + cmd);
  Serial.println(response);
  return response;
}

// Get GPS info
String getGPSInfo() {
  String resp = sendAT("AT+CGPSINFO", 1000);
  int idx = resp.indexOf("+CGPSINFO:");
  if (idx == -1 || resp.indexOf(",,,,,,,,") != -1) {
    return "GPS not ready yet.";
  }

  // Extract and format lat/lon
  int start = resp.indexOf(":", idx) + 1;
  String gpsData = resp.substring(start);
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

  return "GPS: " + lat + " " + ns + ", " + lon + " " + ew;
}

void setup() {
  Serial.begin(115200);
  delay(2000);
  LTEGNSS.begin(115200, SERIAL_8N1, -1, -1); // RX/TX pins configured by your board's default UART0
  delay(2000);

  Serial.println("=== SIM7600G-H GPS Assisted Mode Test ===");

  sendAT("AT");            // Basic check
  sendAT("AT+CFUN=1", 1000); // Full functionality

  // Open and close network to ensure clean state
  sendAT("AT+NETCLOSE", 1000);
  delay(1000);
  sendAT("AT+NETOPEN", 3000); // Open data connection
  delay(1000);

  sendAT("AT+CGPS=0", 1000);   // Ensure GPS is off
  delay(1000);
  sendAT("AT+CGPS=1,2", 1000); // Enable GPS in MS-based A-GPS mode
  Serial.println("Waiting for GPS lock...");
}

void loop() {
  String gps = getGPSInfo();
  Serial.println(gps);
  delay(5000); // Poll every 5 seconds
}
