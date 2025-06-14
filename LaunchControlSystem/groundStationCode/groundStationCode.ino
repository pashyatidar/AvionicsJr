#include <SD.h>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>
#include <freertos/semphr.h>

SemaphoreHandle_t logMutex;

#define BUZZER_PIN 14 
#define RX_RYLR 44
#define TX_RYLR 43
#define ARM_SW  4
#define LCH_SW  5
#define SAFE_SW  6

#define ARM_LED  42
#define LAUNCH_LED 41
#define SAFE_LED 40

HardwareSerial RYLR(1);
TaskHandle_t buzzhandle= NULL;

typedef enum {
  OFF,
  SAFE,
  ARMED,
  LAUNCHED
} STATE;
STATE currentState = OFF;

File logFile;
String message, response;
static int safeFlag = 0, armFlag = 0, launchFlag = 0;

String parseRYLR(String input) {
  int start = input.indexOf(',') + 1;
  start = input.indexOf(',', start) + 1;
  int end = input.indexOf(',', start);
  String parsed = input.substring(start, end);
  parsed.trim();
  return parsed;  
}

void sendState (String data){
  Serial.println("TRANSMIT: " + data);
  message = "AT+SEND=0," + String(data.length()) + "," + data + "\r\n";
  RYLR.flush();
  RYLR.print(message);
  vTaskDelay(10);
}

void buzz(void *pvParameters){
  pinMode(BUZZER_PIN,OUTPUT);
  for (int i=0;i<1;i++){
    digitalWrite(BUZZER_PIN,HIGH);
    vTaskDelay(pdMS_TO_TICKS(200)); 
    digitalWrite(BUZZER_PIN, LOW);
    vTaskDelay(pdMS_TO_TICKS(800));
  }
  buzzhandle = NULL;
  vTaskDelete(NULL);
}

void fsm(void *pvParameters){
  
  for (;;){
    if (digitalRead(SAFE_SW) == LOW && digitalRead(ARM_SW) == LOW && digitalRead(LCH_SW) == LOW) {
      currentState = OFF;
      digitalWrite(SAFE_LED, LOW);
      digitalWrite(ARM_LED, LOW);
      digitalWrite(LAUNCH_LED, LOW);
}
    switch (currentState) {
    case OFF:
     if (digitalRead(SAFE_SW)==HIGH && digitalRead(ARM_SW) == LOW && digitalRead(LCH_SW) == LOW){
      sendState("SAFE");
      vTaskDelay(pdMS_TO_TICKS(500));
      currentState = SAFE;
      digitalWrite(SAFE_LED,HIGH);
      if (buzzhandle == NULL) {xTaskCreate(buzz, "Buzzer", 256, NULL, 1, &buzzhandle);}
     }
     break;

    case SAFE:
      if (digitalRead(ARM_SW) == HIGH && digitalRead(LCH_SW) == LOW) {
        if(safeFlag == 0) {
          sendState("ARM");
          vTaskDelay(pdMS_TO_TICKS(500));
          safeFlag = 1;
          armFlag = 0;
          digitalWrite(ARM_LED,HIGH);
          currentState = ARMED;
          if (buzzhandle == NULL) {xTaskCreate(buzz, "Buzzer", 256, NULL, 1, &buzzhandle);}
        }
      }
      break;
    case ARMED:
      if (digitalRead(ARM_SW) == LOW) {
        if(armFlag == 0) {
          sendState("DISARM");
          vTaskDelay(pdMS_TO_TICKS(500));
          armFlag = 1;
          safeFlag = 0;
          
        }
      }
      else if(digitalRead(LCH_SW) == HIGH) {
        if(launchFlag == 0) {
          sendState("LAUNCH");
          vTaskDelay(pdMS_TO_TICKS(500));
          launchFlag = 1;
          currentState = LAUNCHED;
          digitalWrite(LAUNCH_LED,HIGH);
          if (buzzhandle  == NULL) {xTaskCreate(buzz, "Buzzer", 256, NULL, 1, &buzzhandle);}
        }
      }
      break;
    default:
      break;
  }
  vTaskDelay(pdMS_TO_TICKS(50));
  }
}

void checkTestBed (void *pvParameters){
  for(;;){
    if (RYLR.available()){
      response  = RYLR.readStringUntil('\n');
      response = parseRYLR(response);
      if(response.length() > 3){
        Serial.println(response);
        if(xSemaphoreTake(logMutex,portMAX_DELAY)){
          File logFile = SD.open ("loadcell.txt",FILE_WRITE);
          if (logFile){
            logFile.println(response);
            logFile.close();
          }
          xSemaphoreGive(logMutex);
        }
      }
    }
    if (response.equals("TESTBED STATE: SAFE")) {
      currentState = SAFE;
      Serial.println("GROUND STATE: SAFE");
    }
    else if (response.equals("TESTBED STATE: ARMED")) {
      currentState = ARMED;
      Serial.println("GROUND STATE: ARMED");
    }
    else if (response.equals("TESTBED STATE: LAUNCHED")) {
      currentState = LAUNCHED;
      Serial.println("GROUND STATE: LAUNCHED");
    }
    if (response.length() > 3) {
      Serial.println(response);
    }
  vTaskDelay(pdMS_TO_TICKS(100));
  }
 
}

void setup(){
  Serial.begin(9600);
  RYLR.begin(57600, SERIAL_8N1, RX_RYLR, TX_RYLR);
  pinMode(ARM_LED, OUTPUT);
  pinMode(SAFE_LED, OUTPUT);
  pinMode(LAUNCH_LED, OUTPUT);
  pinMode(ARM_SW, INPUT);
  pinMode(LCH_SW, INPUT);
  pinMode(SAFE_SW, INPUT);
  digitalWrite(ARM_SW, LOW);
  digitalWrite(SAFE_SW, LOW);
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);
  digitalWrite(LCH_SW, LOW);

  logMutex = xSemaphoreCreateMutex();
  if (logMutex == NULL){
    Serial.println ("failed to create SD CARD Index ");
    while (1);    
  }
  xTaskCreate(fsm, "FSM", 512, NULL, 1, NULL);
  xTaskCreate(checkTestBed, "CheckTestbed", 1024, NULL, 1, NULL);
  Serial.println("\nSerial Comm. Initialised.");
  if (!SD.begin()) {
    Serial.println("SD card initialisation failed.");
  }

  logFile = SD.open("loadcell.txt", FILE_WRITE);
  if (!logFile) {
    Serial.println("Couldn't open log file");
  } else {
    Serial.println("Logging to SD card...");
    logFile.close();
  }

  Serial.println("GROUNDSTATION SET UP COMPLETE.");

}




void loop(){}



