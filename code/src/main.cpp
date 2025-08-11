#include <Arduino.h>

// SIM7600
HardwareSerial LTEGNSS(0);  // UART0 for SIM7600

// Helper: send AT and read reply
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

// Parse GPS and return lat/lon
bool getGPSCoords(float &latDec, float &lonDec) {
  String resp = sendAT("AT+CGPSINFO", 1000);
  int idx = resp.indexOf("+CGPSINFO:");
  if (idx == -1 || resp.indexOf(",,,,,,,,") != -1) {
    return false;
  }
  String gpsData = resp.substring(resp.indexOf(":") + 1);
  gpsData.trim();

  int latEnd = gpsData.indexOf(',');
  int nsEnd  = gpsData.indexOf(',', latEnd + 1);
  int lonEnd = gpsData.indexOf(',', nsEnd + 1);
  int ewEnd  = gpsData.indexOf(',', lonEnd + 1);

  String lat = gpsData.substring(0, latEnd);
  String ns  = gpsData.substring(latEnd + 1, nsEnd);
  String lon = gpsData.substring(nsEnd + 1, lonEnd);
  String ew  = gpsData.substring(lonEnd + 1, ewEnd);

  if (lat.length() < 3 || lon.length() < 3) return false;

  // Convert from DDDMM.MMMM to decimal degrees
  float latF = lat.substring(0, lat.length() - 7).toFloat() +
               (lat.substring(lat.length() - 7).toFloat() / 60.0);
  if (ns == "S") latF = -latF;

  float lonF = lon.substring(0, lon.length() - 7).toFloat() +
               (lon.substring(lon.length() - 7).toFloat() / 60.0);
  if (ew == "W") lonF = -lonF;

  latDec = latF;
  lonDec = lonF;
  return true;
}

// Upload GPS using SIM7600 HTTP POST
void uploadGPS(float lat, float lon) {
  sendAT("AT+HTTPTERM", 500);
  sendAT("AT+HTTPINIT", 500);
  sendAT("AT+HTTPPARA=\"CID\",1", 500);
  sendAT("AT+HTTPPARA=\"URL\",\"http://ma8w.ddns.net:3000/api/upload/gps\"", 500);
  sendAT("AT+HTTPPARA=\"CONTENT\",\"application/json\"", 500);

  String json = "{\"gps\":{\"lat\":" + String(lat, 6) + ",\"lon\":" + String(lon, 6) + "}}";
  sendAT("AT+HTTPDATA=" + String(json.length()) + ",10000", 200);
  LTEGNSS.print(json);
  delay(500);

  sendAT("AT+HTTPACTION=1", 6000); // POST
  sendAT("AT+HTTPREAD", 1000);
  sendAT("AT+HTTPTERM", 500);
}

void setup() {
  Serial.begin(115200);
  delay(2000);
  LTEGNSS.begin(115200, SERIAL_8N1, -1, -1);
  delay(2000);

  Serial.println("=== SIM7600G-H Assisted GPS + HTTP Upload ===");

  sendAT("AT");
  sendAT("AT+CFUN=1", 1000);
  sendAT("AT+NETCLOSE", 1000);
  delay(500);
  sendAT("AT+NETOPEN", 3000);
  delay(500);

  sendAT("AT+CGPS=0", 1000);
  delay(500);
  sendAT("AT+CGPS=1,2", 1000); // MS-based A-GPS
  Serial.println("Waiting for GPS lock...");
}

void loop() {
  float lat, lon;
  if (getGPSCoords(lat, lon)) {
    Serial.printf("Got GPS: %.6f, %.6f\n", lat, lon);
    uploadGPS(lat, lon);
  } else {
    Serial.println("GPS not ready yet.");
  }
  delay(10000); // every 10 seconds
}
