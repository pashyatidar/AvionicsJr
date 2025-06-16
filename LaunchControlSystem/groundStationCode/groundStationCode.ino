#include <SD.h>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>
#include <freertos/semphr.h>

SemaphoreHandle_t logMutex;


#define BUZZER_PIN 38 
#define RX_RYLR 44
#define TX_RYLR 43
#define ARM_SW  4
#define LCH_SW  5
#define SAFE_SW  6

#define ARM_LED  17
#define LAUNCH_LED 16
#define SAFE_LED 18

HardwareSerial RYLR(1);


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


bool allSwitchesLow() {
  return digitalRead(SAFE_SW) == LOW && digitalRead(ARM_SW) == LOW && digitalRead(LCH_SW) == LOW;
}

void buzz(void *pvParameters){
  pinMode(BUZZER_PIN,OUTPUT);
  for (int i=0;i<1;i++){
    digitalWrite(BUZZER_PIN,HIGH);
    vTaskDelay(pdMS_TO_TICKS(200)); 
    digitalWrite(BUZZER_PIN, LOW);
    vTaskDelay(pdMS_TO_TICKS(800));
  }
  vTaskDelete(NULL);
}

void fsm(void *pvParameters){
  
  for (;;){
    switch (currentState) {
    case OFF:
     digitalWrite(SAFE_LED, LOW);
     digitalWrite(ARM_LED, LOW);
     digitalWrite(LAUNCH_LED, LOW);
     if (digitalRead(SAFE_SW)==HIGH && digitalRead(ARM_SW) == LOW && digitalRead(LCH_SW) == LOW){
      sendState("SAFE");
      vTaskDelay(pdMS_TO_TICKS(500));
      currentState = SAFE;
      digitalWrite(SAFE_LED,HIGH);
      safeFlag = 0;
      armFlag = 0;
      launchFlag = 0;
     }
     break;

    case SAFE:
      if (digitalRead(SAFE_SW)==HIGH && digitalRead(ARM_SW) == HIGH && digitalRead(LCH_SW) == LOW) {
        if(safeFlag == 0) {
          sendState("ARM");
          vTaskDelay(pdMS_TO_TICKS(500));
          safeFlag = 1;
          armFlag = 0;
          digitalWrite(ARM_LED,HIGH);
          currentState = ARMED;
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
      else if(digitalRead(SAFE_SW)==HIGH && digitalRead(LCH_SW) == HIGH && digitalRead(ARM_SW) == HIGH  ) {
        if(launchFlag == 0) {
          sendState("LAUNCH");
          vTaskDelay(pdMS_TO_TICKS(500));
          launchFlag = 1;
          currentState = LAUNCHED;
          digitalWrite(LAUNCH_LED,HIGH);
                    
        }
      }
      break;
    case LAUNCHED : 
     for (int  i = 0 ;i<3 ; i++){
      digitalWrite(LAUNCH_LED,HIGH);
      digitalWrite(ARM_LED,HIGH);   
      digitalWrite(SAFE_LED,HIGH);  

      vTaskDelay(500);

      digitalWrite(LAUNCH_LED,LOW);
      digitalWrite(ARM_LED,LOW);   
      digitalWrite(SAFE_LED,LOW);
      
      vTaskDelay(500);
     }

      digitalWrite(LAUNCH_LED,LOW);
      digitalWrite(ARM_LED,LOW);   
      digitalWrite(SAFE_LED,LOW);
      
     break;
    default:
     Serial.println("ERROR: Unknown state. Resetting to OFF.");
     currentState = OFF;
     sendState("OFF");
     digitalWrite(SAFE_LED, LOW);
     digitalWrite(ARM_LED, LOW);
     digitalWrite(LAUNCH_LED, LOW);
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
          logFile = SD.open ("loadcell.txt",FILE_WRITE);
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
      //Serial.println(response);
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
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);


  logMutex = xSemaphoreCreateMutex();
  if (logMutex == NULL){
    Serial.println ("failed to create SD CARD Index ");
    while (1);    
  }
  xTaskCreate(fsm, "FSM", 512, NULL, 2, NULL);
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



