#include <WiFi.h>
#include <HTTPClient.h>

const char* ssid = "realme";
const char* password = "12345678";

const char* ledServer = "http://10.111.110.131:3000/api/led";

int ledPin = 15;

void setup() {

  Serial.begin(115200);

  pinMode(ledPin, OUTPUT);

  WiFi.begin(ssid, password);

  Serial.print("Connecting WiFi");

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\n✅ WiFi Connected");
}

void loop() {

  if (WiFi.status() == WL_CONNECTED) {

    HTTPClient http;
    http.begin(ledServer);

    Serial.println("📡 Checking server...");

    int httpCode = http.GET();

    Serial.print("HTTP Response Code: ");
    Serial.println(httpCode);

    if (httpCode == 200) {

      String payload = http.getString();

      Serial.print("Server Response: ");
      Serial.println(payload);

      // Check LED state from server
      if (payload.indexOf("\"led\":true") >= 0) {

        Serial.println("🟢 LED ON (Stable)");
        digitalWrite(ledPin, HIGH);

      } else {

        Serial.println("🔴 LED OFF (Stable)");
        digitalWrite(ledPin, LOW);
      }
    }

    http.end();
  }

  delay(500); // Check server twice per second
}