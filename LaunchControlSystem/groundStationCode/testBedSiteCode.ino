#include <Adafruit_MCP9600.h>
#include <Wire.h>
#include <HX711.h>
#include <HardwareSerial.h>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>
#include <freertos/semphr.h>

Adafruit_MCP9600 thermocouple;
HX711 load_cell;
HardwareSerial LoRaSerial(1);

const int pressure_pin = 34;
const int mosfet_pin = 6;
const int d4184_pwm1_pin = 8;
const int d4184_pwm2_pin = 9;
const int lora_rx = 16;
const int lora_tx = 17;
const int load_cell_dout = 2;
const int load_cell_sck = 3;

typedef enum {
  OFF,
  SAFE,
  ARMED,
  LAUNCHED
} STATE;
STATE currentState = OFF;

bool armed = false;
unsigned long ignition_duration = 1000;
unsigned long sample_interval = 100;
unsigned long last_sample = 0;
unsigned long test_start_time = 0;
unsigned long last_ignition_attempt = 0;
int ignition_state = 0;
SemaphoreHandle_t sensorMutex;

float read_thermocouple() {
    if (xSemaphoreTake(sensorMutex, portMAX_DELAY)) {
        float temp = thermocouple.readThermocoupleTemperature();
        xSemaphoreGive(sensorMutex);
        return temp;
    }
    return 0.0;
}

float read_load_cell() {
    if (xSemaphoreTake(sensorMutex, portMAX_DELAY)) {
        float load = load_cell.get_units(10);
        xSemaphoreGive(sensorMutex);
        return load;
    }
    return 0.0;
}

float read_pressure() {
    if (xSemaphoreTake(sensorMutex, portMAX_DELAY)) {
        float pressure = (analogRead(pressure_pin) * 5.0 / 4095.0) * 100.0;
        xSemaphoreGive(sensorMutex);
        return pressure;
    }
    return 0.0;
}

void ignite_primary() {
    if (armed && ignition_state == 0) {
        digitalWrite(mosfet_pin, HIGH);
        vTaskDelay(pdMS_TO_TICKS(ignition_duration));
        digitalWrite(mosfet_pin, LOW);
        last_ignition_attempt = millis();
        ignition_state = 1;
    }
}

void ignite_redundant1() {
    if (armed && ignition_state == 1) {
        digitalWrite(d4184_pwm1_pin, HIGH);
        vTaskDelay(pdMS_TO_TICKS(ignition_duration));
        digitalWrite(d4184_pwm1_pin, LOW);
        last_ignition_attempt = millis();
        ignition_state = 2;
    }
}

void ignite_redundant2() {
    if (armed && ignition_state == 2) {
        digitalWrite(d4184_pwm2_pin, HIGH);
        vTaskDelay(pdMS_TO_TICKS(ignition_duration));
        digitalWrite(d4184_pwm2_pin, LOW);
        last_ignition_attempt = millis();
        ignition_state = 3;
        armed = false;
    }
}

void send_lora_data(float temp, float load, float pressure, unsigned long timestamp) {
    char buffer[120];
    String state_str = (currentState == OFF) ? "OFF" : (currentState == SAFE) ? "SAFE" : (currentState == ARMED) ? "ARMED" : "LAUNCHED";
    snprintf(buffer, sizeof(buffer), "+RCV=0,%d,TESTBED STATE:%s,T:%.2f,L:%.2f,P:%.2f,IS:%d,TS:%lu,0",
             39, state_str.c_str(), temp, load, pressure, ignition_state, timestamp);
    LoRaSerial.println(buffer);
}

void update_test_mode(float load, float pressure) {
    if (load > 1.0 && pressure < 50.0) {
        currentState = SAFE;
        ignition_state = 0;
    } else if (pressure >= 50.0) {
        currentState = ARMED;
        armed = true;
    } else {
        currentState = OFF;
        armed = false;
        ignition_state = 0;
    }
}

void sensor_task(void *pvParameters) {
    for (;;) {
        unsigned long current_time = millis();
        if (current_time - last_sample >= sample_interval) {
            float temp = read_thermocouple();
            float load = read_load_cell();
            float pressure = read_pressure();
            update_test_mode(load, pressure);
            send_lora_data(temp, load, pressure, current_time - test_start_time);
            last_sample = current_time;
        }
        vTaskDelay(pdMS_TO_TICKS(10));
    }
}

void ignition_task(void *pvParameters) {
    for (;;) {
        unsigned long current_time = millis();
        if (currentState == ARMED && armed && current_time - last_ignition_attempt > 5000) {
            ignite_primary();
            currentState = LAUNCHED;
        }
        if (currentState == LAUNCHED && armed && ignition_state == 1 && current_time - last_ignition_attempt > 2000) {
            float pressure = read_pressure();
            if (pressure >= 50.0) {
                ignite_redundant1();
            }
        }
        if (currentState == LAUNCHED && armed && ignition_state == 2 && current_time - last_ignition_attempt > 2000) {
            float pressure = read_pressure();
            if (pressure >= 50.0) {
                ignite_redundant2();
            }
        }
        vTaskDelay(pdMS_TO_TICKS(50));
    }
}

void setup() {
    Wire.begin();
    if (!thermocouple.begin()) {
        Serial.println("Could not initialize MCP9600!");
        while (1);
    }
    thermocouple.setADCresolution(MCP9600_ADC_14BIT);
    thermocouple.setThermocoupleType(MCP9600_TYPE_K);
    thermocouple.setFilterCoefficient(3);

    LoRaSerial.begin(115200, SERIAL_8N1, lora_rx, lora_tx);
    load_cell.begin(load_cell_dout, load_cell_sck);
    load_cell.set_scale(2280.f);
    load_cell.tare();
    pinMode(mosfet_pin, OUTPUT);
    pinMode(d4184_pwm1_pin, OUTPUT);
    pinMode(d4184_pwm2_pin, OUTPUT);
    digitalWrite(mosfet_pin, LOW);
    digitalWrite(d4184_pwm1_pin, LOW);
    digitalWrite(d4184_pwm2_pin, LOW);
    sensorMutex = xSemaphoreCreateMutex();
    test_start_time = millis();
    xTaskCreatePinnedToCore(sensor_task, "SensorTask", 2048, NULL, 1, NULL, 0);
    xTaskCreatePinnedToCore(ignition_task, "IgnitionTask", 2048, NULL, 2, NULL, 1);
}

void loop() {}
