#include <Arduino.h>

// ----------------------- Pins -----------------------
#define BATT_PIN        D1      // Battery voltage divider input
#define BUTTON_A_PIN    D10     // SOS A
#define BUTTON_B_PIN    D0      // SOS B
#define VIBRATION_PIN   D3      // vibration motor control

#define DIVIDER_RATIO   11.0f
#define BATT_MIN_VOLT   3.0f
#define BATT_MAX_VOLT   4.2f

// Vibration PWM config (ESP32C3 LEDC)
#define VIB_PWM_CH      0
#define VIB_PWM_FREQ    2000
#define VIB_PWM_BITS    8
#define VIB_DUTY        80      // 0..255 steady strength
#define VIB_RAMP_MS     400      // soft-start to reduce inrush
#define VIB_TAP_DUTY    220      // for 200ms tap
#define VIB_TAP_RAMP    60

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
  if (resp.indexOf("+CGPSINFO:") == -1 || resp.indexOf(",,,,,,,,") != -1) return false;

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

  float lat_deg = lat.substring(0, 2).toFloat();
  float lat_min = lat.substring(2).toFloat();
  latDec = lat_deg + (lat_min / 60.0f);
  if (ns == "S") latDec = -latDec;

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

  sendAT("AT+HTTPACTION=1", 6000);
  sendAT("AT+HTTPREAD", 800);
  sendAT("AT+HTTPTERM", 300);
}

// ----------------------- Event uploader -----------------------
void uploadEvent(const String& type) {
  sendAT("AT+HTTPTERM", 300);
  sendAT("AT+HTTPINIT", 500);
  sendAT("AT+HTTPPARA=\"CID\",1", 300);
  sendAT("AT+HTTPPARA=\"URL\",\"http://ma8w.ddns.net:3000/api/upload/event\"", 300);
  sendAT("AT+HTTPPARA=\"CONTENT\",\"application/json\"", 300);

  String json = "{\"type\":\"" + type + "\"}";
  sendAT("AT+HTTPDATA=" + String(json.length()) + ",10000", 200);
  LTEGNSS.print(json);
  delay(400);

  sendAT("AT+HTTPACTION=1", 6000);
  sendAT("AT+HTTPREAD", 800);
  sendAT("AT+HTTPTERM", 300);
}

// ----------------------- Battery helpers ----------------------
float readBatteryVoltage() {
  return (analogReadMilliVolts(BATT_PIN) / 1000.0f) * DIVIDER_RATIO;
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

  sendAT("AT+HTTPACTION=1", 6000);
  sendAT("AT+HTTPREAD", 800);
  sendAT("AT+HTTPTERM", 300);
}

// ----------------------- Vibration (PWM) ----------------------
static inline void vibWrite(uint8_t duty) {
  ledcWrite(VIB_PWM_CH, duty);
}

void vibrateContinuous_ms(unsigned long total_ms, uint8_t duty = VIB_DUTY, unsigned long ramp_ms = VIB_RAMP_MS) {
  // soft-start
  unsigned long t0 = millis();
  if (ramp_ms > 0 && duty > 0) {
    while (true) {
      unsigned long dt = millis() - t0;
      if (dt >= ramp_ms) break;
      float frac = (float)dt / (float)ramp_ms;
      uint8_t d = (uint8_t)(duty * frac);
      vibWrite(d);
      delay(10);
    }
  }
  vibWrite(duty);
  // hold steady
  unsigned long start = millis();
  while (millis() - start < total_ms) {
    delay(50);
  }
  // stop
  vibWrite(0);
}

void vibrate200ms() {
  vibrateContinuous_ms(200, VIB_TAP_DUTY, VIB_TAP_RAMP);
}

// ----------------------- Setup ---------------------------
unsigned long lastPostMs = 0;
const unsigned long POST_PERIOD_MS = 10000;

void setup() {
  Serial.begin(115200);
  delay(2000);

  pinMode(BUTTON_A_PIN, INPUT_PULLUP);
  pinMode(BUTTON_B_PIN, INPUT_PULLUP);

  // PWM setup for vibration
  ledcAttachPin(VIBRATION_PIN, VIB_PWM_CH);
  ledcSetup(VIB_PWM_CH, VIB_PWM_FREQ, VIB_PWM_BITS);
  vibWrite(0);

  analogReadResolution(12);

  LTEGNSS.begin(115200, SERIAL_8N1, -1, -1);
  delay(2000);

  Serial.println("=== SIM7600G-H: GPS + Battery + SOS + Vibration (steady) ===");

  sendAT("AT");
  sendAT("AT+CFUN=1", 800);
  sendAT("AT+NETCLOSE", 800);
  delay(300);
  sendAT("AT+NETOPEN", 3000);
  delay(300);

  sendAT("AT+CGPS=0", 800);
  delay(300);
  sendAT("AT+CGPS=1,2", 800);
  Serial.println("Waiting for GPS lock...");
}

// ======================= Command handling =======================
const unsigned long VIBRATION_ALERT_MS = 1UL * 60UL * 1000UL; // 5 minutes

// ---- Clear commands on server ----
static void sendClearToServer() {
  // Close any previous HTTP session
  sendAT("AT+HTTPTERM", 300);

  // Init HTTP and point to the correct endpoint
  sendAT("AT+HTTPINIT", 500);
  sendAT("AT+HTTPPARA=\"CID\",1", 300);
  sendAT("AT+HTTPPARA=\"URL\",\"http://ma8w.ddns.net:3000/api/upload/command\"", 300);
  sendAT("AT+HTTPPARA=\"CONTENT\",\"application/json\"", 300);

  // Body: {"command":"clear"}
  String json = "{\"command\":\"clear\"}";
  sendAT("AT+HTTPDATA=" + String(json.length()) + ",10000", 200);
  LTEGNSS.print(json);
  delay(400);

  // POST + read response + tidy up
  sendAT("AT+HTTPACTION=1", 6000);  // 1 = POST
  sendAT("AT+HTTPREAD", 800);
  sendAT("AT+HTTPTERM", 300);
}

void checkAndExecuteCommand() {
  sendAT("AT+HTTPTERM", 300);
  sendAT("AT+HTTPINIT", 500);
  sendAT("AT+HTTPPARA=\"CID\",1", 300);
  sendAT("AT+HTTPPARA=\"URL\",\"http://ma8w.ddns.net:3000/api/download/command\"", 300);

  String actionResp = sendAT("AT+HTTPACTION=0", 6000);

  int idx = actionResp.indexOf("+HTTPACTION:");
  if (idx == -1) {
    Serial.println("No HTTPACTION in response");
    sendAT("AT+HTTPTERM", 300);
    return;
  }
  int comma2 = actionResp.indexOf(',', idx + 13);
  int comma3 = actionResp.indexOf(',', comma2 + 1);
  if (comma3 == -1) {
    Serial.println("Failed to parse HTTPACTION length");
    sendAT("AT+HTTPTERM", 300);
    return;
  }
  int len = actionResp.substring(comma3 + 1).toInt();
  if (len <= 0) {
    Serial.println("No data to read");
    sendAT("AT+HTTPTERM", 300);
    return;
  }

  String readCmd = "AT+HTTPREAD=0," + String(len);
  String readResp = sendAT(readCmd, 2000);

  if (readResp.indexOf("\"command\":\"vibrate\"") != -1) {
    Serial.println("Command received: vibrate (steady)");
    // CONTINUOUS vibration with soft-start to lower battery stress
    sendClearToServer();
    vibrateContinuous_ms(VIBRATION_ALERT_MS, VIB_DUTY, VIB_RAMP_MS);
    // Optionally clear command on server
  }

  sendAT("AT+HTTPTERM", 300);
}

// ----------------------- Loop ---------------------------
void loop() {
  static bool lastA = HIGH, lastB = HIGH;
  bool curA = digitalRead(BUTTON_A_PIN);
  bool curB = digitalRead(BUTTON_B_PIN);

  if (lastA == HIGH && curA == LOW) {
    Serial.println("Button A pressed");
    vibrate200ms();
    uploadEvent("SOS Button A Pressed");
  }
  if (lastB == HIGH && curB == LOW) {
    Serial.println("Button B pressed");
    vibrate200ms();
    uploadEvent("SOS Button B Pressed");
  }
  lastA = curA;
  lastB = curB;

  float v_pin = analogReadMilliVolts(BATT_PIN) / 1000.0f;
  float v_batt = v_pin * DIVIDER_RATIO;
  int pct = batteryPercentLinear();
  Serial.printf("Vpin: %.3f V | Vbatt: %.3f V | %d%%\n", v_pin, v_batt, pct);

  if (millis() - lastPostMs >= POST_PERIOD_MS) {
    lastPostMs = millis();

    float lat, lon;
    if (getGPSCoords(lat, lon)) {
      Serial.printf("Got GPS: %.6f, %.6f\n", lat, lon);
      uploadGPS(lat, lon);
    } else {
      Serial.println("GPS not ready yet.");
    }

    uploadBatteryPercentage(pct);

    // Poll for command and act if needed
    checkAndExecuteCommand();
  }

  delay(100);
}
