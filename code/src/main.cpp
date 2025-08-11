#include <Arduino.h>

// ----------------------- Battery config -----------------------
#define BATT_PIN        D1          // D1 on XIAO ESP32C3
#define DIVIDER_RATIO   11.0f      // 10k : 1k divider  -> 11x
#define BATT_MIN_VOLT   3.0f
#define BATT_MAX_VOLT   4.2f

// ----------------------- SIM7600 on UART0 ---------------------
HardwareSerial LTEGNSS(0);  // UART0 for SIM7600

// ----------------------- AT helper ----------------------------
String sendAT(const String& cmd, uint32_t wait_ms = 500) {
  LTEGNSS.println(cmd);
  delay(wait_ms);
  String response;
  while (LTEGNSS.available()) response += char(LTEGNSS.read());
  response.trim();
  Serial.println("> " + cmd);
  Serial.println(response);
  return response;
}

// ----------------------- GPS helpers --------------------------
bool getGPSCoords(float &latDec, float &lonDec) {
  String resp = sendAT("AT+CGPSINFO", 1000);
  int idx = resp.indexOf("+CGPSINFO:");
  if (idx == -1 || resp.indexOf(",,,,,,,,") != -1) return false;

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

  // Latitude: DDMM.MMMM
  float lat_deg = lat.substring(0, 2).toFloat();
  float lat_min = lat.substring(2).toFloat();
  latDec = lat_deg + (lat_min / 60.0f);
  if (ns == "S") latDec = -latDec;

  // Longitude: DDDMM.MMMM
  float lon_deg = lon.substring(0, 3).toFloat();
  float lon_min = lon.substring(3).toFloat();
  lonDec = lon_deg + (lon_min / 60.0f);
  if (ew == "W") lonDec = -lonDec;

  return true;
}

void uploadGPS(float lat, float lon) {
  sendAT("AT+HTTPTERM", 300);
  sendAT("AT+HTTPINIT", 500);
  sendAT("AT+HTTPPARA=\"CID\",1", 300);
  sendAT("AT+HTTPPARA=\"URL\",\"http://ma8w.ddns.net:3000/api/upload/gps\"", 300);
  sendAT("AT+HTTPPARA=\"CONTENT\",\"application/json\"", 300);

  String json = "{\"gps\":{\"lat\":" + String(lat, 6) + ",\"lon\":" + String(lon, 6) + "}}";
  sendAT("AT+HTTPDATA=" + String(json.length()) + ",10000", 200);
  LTEGNSS.print(json);
  delay(400);

  sendAT("AT+HTTPACTION=1", 6000); // POST
  sendAT("AT+HTTPREAD", 800);
  sendAT("AT+HTTPTERM", 300);
}

// ----------------------- Battery helpers ----------------------
float readBatteryVoltage() {
  // voltage at pin (in V)
  float v_pin = analogReadMilliVolts(BATT_PIN) / 1000.0f;
  // scaled to pack voltage
  return v_pin * DIVIDER_RATIO;
}

int batteryPercentLinear() {
  float v_batt = readBatteryVoltage();
  float percent = (v_batt - BATT_MIN_VOLT) * 100.0f / (BATT_MAX_VOLT - BATT_MIN_VOLT);
  if (percent < 0) percent = 0;
  if (percent > 100) percent = 100;
  return (int)roundf(percent);
}

void uploadBatteryPercentage(int pct) {
  sendAT("AT+HTTPTERM", 300);
  sendAT("AT+HTTPINIT", 500);
  sendAT("AT+HTTPPARA=\"CID\",1", 300);
  sendAT("AT+HTTPPARA=\"URL\",\"http://ma8w.ddns.net:3000/api/upload/batt-percentage\"", 300);
  sendAT("AT+HTTPPARA=\"CONTENT\",\"application/json\"", 300);

  String json = "{\"percentage\":" + String(pct) + "}";
  sendAT("AT+HTTPDATA=" + String(json.length()) + ",10000", 200);
  LTEGNSS.print(json);
  delay(400);

  sendAT("AT+HTTPACTION=1", 6000); // POST
  sendAT("AT+HTTPREAD", 800);
  sendAT("AT+HTTPTERM", 300);
}

// ----------------------- Setup/Loop ---------------------------
void setup() {
  Serial.begin(115200);
  delay(2000);

  analogReadResolution(12);

  LTEGNSS.begin(115200, SERIAL_8N1, -1, -1);
  delay(2000);

  Serial.println("=== SIM7600G-H: GPS + Battery Uploader ===");

  sendAT("AT");
  sendAT("AT+CFUN=1", 800);
  sendAT("AT+NETCLOSE", 800);
  delay(300);
  sendAT("AT+NETOPEN", 3000);
  delay(300);

  // Start GPS (MS-based A-GPS)
  sendAT("AT+CGPS=0", 800);
  delay(300);
  sendAT("AT+CGPS=1,2", 800);
  Serial.println("Waiting for GPS lock...");
}

unsigned long lastPostMs = 0;
const unsigned long POST_PERIOD_MS = 10000; // 10s: matches your GPS cadence

void loop() {
  // Print local battery reading to Serial each second for visibility
  float v_pin = analogReadMilliVolts(BATT_PIN) / 1000.0f;
  float v_batt = v_pin * DIVIDER_RATIO;
  int pct = batteryPercentLinear();
  Serial.printf("Vpin: %.3f V | Vbatt: %.3f V | %d%%\n", v_pin, v_batt, pct);

  // Upload every POST_PERIOD_MS
  if (millis() - lastPostMs >= POST_PERIOD_MS) {
    lastPostMs = millis();

    // GPS first (if available)
    float lat, lon;
    if (getGPSCoords(lat, lon)) {
      Serial.printf("Got GPS: %.6f, %.6f\n", lat, lon);
      uploadGPS(lat, lon);
    } else {
      Serial.println("GPS not ready yet.");
    }

    // Then battery percentage
    uploadBatteryPercentage(pct);
  }

  delay(1000);
}