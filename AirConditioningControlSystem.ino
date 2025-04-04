#include <SPI.h>  // SPI library
int thermistorPin = A0;
#define led_pin 13 
#define heater_pin 14
float resistance ;
float Kp = 2.0;
float Kd = 3.0;
float Ki = 4.0; 

float previousError = 0;
float integral = 0 ;
float controlSignal = 0;

int usertemp = Serial.parseInt();
void setup() {
  
  pinMode (led_pin , OUTPUT);
  pinMode (heater_pin,OUTPUT);
  
}


void loop() {  
  int sV = analogRead(thermistorPin);   
  float ratio = (1023/sV) - 1;
  resistance = 10000 / ratio ;   
  float temperature = 1.0 / (0.001129148 + (0.000234125 * log(resistance)) + (0.0000000876741 * pow(log(resistance), 3))) - 273.15;
  // R fixed = 10 kilo ohms 
  float error = usertemp - temperature ; 
  float P = Kp * error;
  float slope = error / 10 ;
  float derivative = error - previousError ; 
  float D = Kd * derivative ; 
  integral = integral + error ;
  float I = Ki * integral ;

  controlSignal = P + I + D ;
  

  if (controlSignal > 0 ){
    digitalWrite (led_pin,HIGH);
    digitalWrite(heater_pin,LOW) ;  
  }
  else if(controlSignal < 0) {
    digitalWrite (led_pin,LOW);
    digitalWrite(heater_pin,HIGH) ;   
  }    
  else {
    digitalWrite (led_pin,LOW);
    digitalWrite(heater_pin,LOW ) ;   
  }
  



  previousError = error;
  delay(1000);
}