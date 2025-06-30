#include <Adafruit_MCP9600.h>
#include <Wire.h>
#include <HardwareSerial.h>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>
#include <freertos/semphr.h>

Adafruit_MCP9600 thermocouple;
HardwareSerial LoRaSerial(1);
SemaphoreHandle_t sensorMutex;
SemaphoreHandle_t loraMutex;

const int pressure_pin = 14;
const int mosfet_pin = 6;
const int d4184_pwm1_pin = 12;
const int d4184_pwm2_pin = 13;
const int lora_rx = 43;
const int lora_tx = 44;
const int load_cell_pin = 41;

const float load_cell_scale = 10000; 
const float load_cell_offset = 0.0; 

typedef enum {
  SAFE,
  ARMED,
  LAUNCHED
} STATE;
STATE currentState = SAFE;

bool armed = false;
unsigned long ignition_duration = 1000;
unsigned long sample_interval = 100;
unsigned long last_sample = 0;
unsigned long test_start_time = 0;
unsigned long last_ignition_attempt = 0;
int ignition_state = 0;

float read_thermocouple() {
    if (xSemaphoreTake(sensorMutex, portMAX_DELAY)) {
        float temp = thermocouple.readThermocouple();
        xSemaphoreGive(sensorMutex);
        return temp;
    }
    return 0.0;
}

float read_load_cell() {
    if (xSemaphoreTake(sensorMutex, portMAX_DELAY)) {
        int adc_value = analogRead(load_cell_pin); 
        float voltage = (adc_value * 5.0) / 4095.0;
        float load = (voltage * load_cell_scale) + load_cell_offset;
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
    static unsigned long start_time = 0;
    if (armed && ignition_state == 0) {
        if (start_time == 0) {
            digitalWrite(mosfet_pin, HIGH);
            start_time = millis();
        }
        if (millis() - start_time >= ignition_duration) {
            digitalWrite(mosfet_pin, LOW);
            last_ignition_attempt = millis();
            ignition_state = 1;
            start_time = 0;
            currentState = LAUNCHED;
        }
    }
}

void ignite_redundant1() {
    static unsigned long start_time = 0;
    if (armed && ignition_state == 1) {
        if (start_time == 0) {
            digitalWrite(d4184_pwm1_pin, HIGH);
            start_time = millis();
        }
        if (millis() - start_time >= ignition_duration) {
            digitalWrite(d4184_pwm1_pin, LOW);
            last_ignition_attempt = millis();
            ignition_state = 2;
            start_time = 0;
        }
    }
}

void ignite_redundant2() {
    static unsigned long start_time = 0;
    if (armed && ignition_state == 2) {
        if (start_time == 0) {
            digitalWrite(d4184_pwm2_pin, HIGH);
            start_time = millis();
        }
        if (millis() - start_time >= ignition_duration) {
            digitalWrite(d4184_pwm2_pin, LOW);
            last_ignition_attempt = millis();
            ignition_state = 3;
            armed = false;
            start_time = 0;
        }
    }
}

void send_lora_data(float temp, float load, float pressure, unsigned long timestamp) {
    if (xSemaphoreTake(loraMutex, portMAX_DELAY)) {
        char buffer[120];
        const char* state_str = (currentState == SAFE) ? "SAFE" : (currentState == ARMED) ? "ARMED" : "LAUNCHED";
        snprintf(buffer, sizeof(buffer), "AT+SEND=0,%d,TESTBED STATE:%s,T:%.2f,L:%.2f,P:%.2f,IS:%d,TS:%lu\r\n",
                 45, state_str, temp, load, pressure, ignition_state, timestamp);
        LoRaSerial.print(buffer);
        xSemaphoreGive(loraMutex);
    }
}

void send_lora_ack(const char* state) {
    if (xSemaphoreTake(loraMutex, portMAX_DELAY)) {
        char buffer[64];
        snprintf(buffer, sizeof(buffer), "AT+SEND=0,%d,STATE_CONFIRMED:%s\r\n", 19 + strlen(state), state);
        LoRaSerial.print(buffer);
        xSemaphoreGive(loraMutex);
    }
}

void process_lora_command() {
    if (LoRaSerial.available()) {
        String command = LoRaSerial.readStringUntil('\n');
        command.trim();
        if (command.startsWith("AT+SEND=")) {
            int first_comma = command.indexOf(',');
            int second_comma = command.indexOf(',', first_comma + 1);
            String payload = command.substring(second_comma + 1);
            if (payload == "DISARM") {
                currentState = SAFE;
                armed = false;
                ignition_state = 0;
                send_lora_ack("SAFE");
            } else if (payload == "ARM") {
                currentState = ARMED;
                armed = true;
                send_lora_ack("ARMED");
            } else if (payload == "LAUNCH") {
                currentState = LAUNCHED;
                armed = true;
                send_lora_ack("LAUNCHED");
            } else {
                Serial.println("Invalid LoRa command: " + payload);
            }
        }
    }
}

void sensor_task(void *pvParameters) {
    for (;;) {
        unsigned long current_time = millis();
        if (current_time - last_sample >= sample_interval) {
            float temp = read_thermocouple();
            float load = read_load_cell();
            float pressure = read_pressure();
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

void lora_task(void *pvParameters) {
    for (;;) {
        process_lora_command();
        vTaskDelay(pdMS_TO_TICKS(10));
    }
}

void setup() {
    Wire.begin();
    Serial.begin(115200);
    if (!thermocouple.begin(0x60)) {
        Serial.println("Could not initialize MCP9600! Check wiring or I2C address.");
        while (1);
    }
    thermocouple.setADCresolution(MCP9600_ADCRESOLUTION_14); 
    thermocouple.setThermocoupleType(MCP9600_TYPE_K);
    thermocouple.setFilterCoefficient(3);

    LoRaSerial.begin(115200, SERIAL_8N1, lora_rx, lora_tx);
    pinMode(load_cell_pin, INPUT); 
    pinMode(mosfet_pin, OUTPUT);
    pinMode(d4184_pwm1_pin, OUTPUT);
    pinMode(d4184_pwm2_pin, OUTPUT);
    digitalWrite(mosfet_pin, LOW);
    digitalWrite(d4184_pwm1_pin, LOW);
    digitalWrite(d4184_pwm2_pin, LOW);

    sensorMutex = xSemaphoreCreateMutex();
    loraMutex = xSemaphoreCreateMutex();
    if (sensorMutex == NULL || loraMutex == NULL) {
        Serial.println("Failed to create mutex!");
        while (1);
    }

    test_start_time = millis();
    xTaskCreatePinnedToCore(sensor_task, "SensorTask", 2048, NULL, 1, NULL, 0);
    xTaskCreatePinnedToCore(ignition_task, "IgnitionTask", 2048, NULL, 2, NULL, 1);
    xTaskCreatePinnedToCore(lora_task, "LoRaTask", 2048, NULL, 1, NULL, 0);
}

void loop() {}
