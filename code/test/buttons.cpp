#include <Arduino.h>

// Button test sketch for D10 (Button A) and D0 (Button B)

#define BUTTON_A_PIN D10  // D10
#define BUTTON_B_PIN D0   // D0

void setup() {
  Serial.begin(115200);

  // Set both pins as inputs (no need for INPUT_PULLUP since external pullups are assumed)
  pinMode(BUTTON_A_PIN, INPUT);
  pinMode(BUTTON_B_PIN, INPUT);

  Serial.println("Button test ready.");
}

void loop() {
    bool buttonAState = digitalRead(BUTTON_A_PIN);  // HIGH when not pressed, LOW when pressed
    bool buttonBState = digitalRead(BUTTON_B_PIN);

    Serial.print(buttonAState);
    Serial.print(" ");
    Serial.println(buttonBState);

    if (!buttonAState) {
        Serial.println("Button A pressed");
    }
    if (!buttonBState) {
        Serial.println("Button B pressed");
    }

    delay(200); // debounce-ish delay
}
