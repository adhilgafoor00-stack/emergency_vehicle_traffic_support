#include <ESP8266WiFi.h>
#include <ESP8266WebServer.h>

// Wi-Fi credentials
const char* ssid = "ag";
const char* password = "aglanddd";

// Motor pins (GPIO numbers)
int IN1 = 5;   // D1
int IN2 = 4;   // D2
int IN3 = 0;   // D3
int IN4 = 2;   // D4
int ENA = 14;  // D5
int ENB = 12;  // D6

ESP8266WebServer server(80);

void setup() {
  Serial.begin(115200);

  pinMode(IN1, OUTPUT);
  pinMode(IN2, OUTPUT);
  pinMode(IN3, OUTPUT);
  pinMode(IN4, OUTPUT);
  pinMode(ENA, OUTPUT);
  pinMode(ENB, OUTPUT);

  // Connect to Wi-Fi
  WiFi.begin(ssid, password);
  Serial.print("Connecting to Wi-Fi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nConnected!");
  Serial.println(WiFi.localIP());

  // Web server routes
  server.on("/", []() {
  server.send(200, "text/html",
    "<!DOCTYPE html>"
    "<html>"
    "<head>"
      "<meta name='viewport' content='width=device-width, initial-scale=1.0'>"
      "<title>ESP Car Control</title>"
      "<style>"
        "body { text-align:center; font-family: Arial; background:#111; color:#fff; }"
        "h1 { margin-top:20px; }"
        "button { width:100px; height:50px; margin:10px; font-size:18px; border:none; border-radius:10px; cursor:pointer; }"
        ".forward { background:green; color:white; }"
        ".backward { background:blue; color:white; }"
        ".left { background:orange; color:white; }"
        ".right { background:orange; color:white; }"
        ".stop { background:red; color:white; }"
        "@media(max-width:500px){ button { width:80px; height:40px; font-size:16px; } }"
      "</style>"
    "</head>"
    "<body>"
      "<h1>ESP Car Control</h1>"
      "<div>"
        "<button class='forward' onclick=\"fetch('/forward')\">Forward</button><br>"
        "<button class='left' onclick=\"fetch('/left')\">Left</button>"
        "<button class='stop' onclick=\"fetch('/stop')\">Stop</button>"
        "<button class='right' onclick=\"fetch('/right')\">Right</button><br>"
        "<button class='backward' onclick=\"fetch('/backward')\">Backward</button>"
      "</div>"
    "</body>"
    "</html>"
  );
});

  server.on("/forward", []() { moveForward(); server.send(200,"text/html","Moving Forward"); });
  server.on("/backward", []() { moveBackward(); server.send(200,"text/html","Moving Backward"); });
  server.on("/left", []() { turnLeft(); server.send(200,"text/html","Turning Left"); });
  server.on("/right", []() { turnRight(); server.send(200,"text/html","Turning Right"); });
  server.on("/stop", []() { stopCar(); server.send(200,"text/html","Stopped"); });

  server.begin();
}

void loop() {
  server.handleClient();
}

void moveForward() {
  digitalWrite(IN1,HIGH); digitalWrite(IN2,LOW);
  digitalWrite(IN3,HIGH); digitalWrite(IN4,LOW);
  analogWrite(ENA, 200); analogWrite(ENB, 200);
}

void moveBackward() {
  digitalWrite(IN1,LOW); digitalWrite(IN2,HIGH);
  digitalWrite(IN3,LOW); digitalWrite(IN4,HIGH);
  analogWrite(ENA, 200); analogWrite(ENB, 200);
}

void turnLeft() {
  digitalWrite(IN1,LOW); digitalWrite(IN2,LOW);
  digitalWrite(IN3,HIGH); digitalWrite(IN4,LOW);
  analogWrite(ENA, 0); analogWrite(ENB, 200);
}

void turnRight() {
  digitalWrite(IN1,HIGH); digitalWrite(IN2,LOW);
  digitalWrite(IN3,LOW); digitalWrite(IN4,LOW);
  analogWrite(ENA, 200); analogWrite(ENB, 0);
}

void stopCar() {
  digitalWrite(IN1,LOW); digitalWrite(IN2,LOW);
  digitalWrite(IN3,LOW); digitalWrite(IN4,LOW);
}
