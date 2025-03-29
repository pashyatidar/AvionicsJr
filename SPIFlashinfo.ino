#include <SPI.h>
#include <SPIFlash.h>

// Define the chip select pin for the W25Q128JV
#define FLASH_CS_PIN 10  // Chip Select pin for Arduino Uno

// SPIFlash object
SPIFlash flash(FLASH_CS_PIN);

// Buffer size (fixed for SRAM safety)
const size_t BUF_SIZE = 256;  // 256 bytes buffer

// Array of test sizes in bytes (16 bytes to 8 KB)
const uint32_t TEST_SIZES[] = {
  16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192
};
const uint8_t NUM_TESTS = sizeof(TEST_SIZES) / sizeof(TEST_SIZES[0]);

// Buffer for read/write (4-byte aligned)
uint32_t buf32[(BUF_SIZE + 3) / 4];
uint8_t* buf = (uint8_t*)buf32;

// Clear serial input buffer
void clearSerialInput() {
  uint32_t m = micros();
  do {
    if (Serial.read() >= 0) {
      m = micros();
    }
  } while (micros() - m < 10000);
}

// Print flash chip details
void printFlashInfo() {
  uint16_t jedecID = flash.getJEDECID();
  uint32_t capacity = flash.getCapacity();
  Serial.print(F("JEDEC ID: 0x"));
  Serial.println(jedecID, HEX);
  Serial.print(F("Capacity: "));
  Serial.print(capacity / 1024 / 1024);
  Serial.println(F(" MB"));
}

void setup() {
  Serial.begin(9600);
  while (!Serial) {
    ; // Wait for Serial on Uno
  }
  delay(1000);
  Serial.println(F("\nSPI Flash Benchmark for W25Q128JV"));
  Serial.println(F("Testing sizes from 16 bytes to 8 KB"));
}

void loop() {
  clearSerialInput();
  Serial.println(F("Type any character to start"));
  while (!Serial.available()) {
    yield();
  }

  if (!flash.begin()) {
    Serial.println(F("SPI Flash initialization failed!"));
    while (1) delay(1000);
  }
  printFlashInfo();

  for (size_t i = 0; i < BUF_SIZE; i++) {
    buf[i] = 'A' + (i % 26);
  }
  buf[BUF_SIZE - 1] = '\n';

  for (uint8_t testIdx = 0; testIdx < NUM_TESTS; testIdx++) {
    uint32_t testSize = TEST_SIZES[testIdx];
    
    if (testSize > flash.getCapacity()) {
      Serial.println(F("Test size exceeds flash capacity!"));
      continue;
    }

    Serial.print(F("\nTesting size: "));
    if (testSize < 1024) {
      Serial.print(testSize);
      Serial.println(F(" bytes"));
    } else {
      Serial.print(testSize / 1024);
      Serial.println(F(" KB"));
    }
    Serial.print(F("BUF_SIZE = "));
    Serial.print(BUF_SIZE);
    Serial.println(F(" bytes"));

    uint32_t n = (testSize + BUF_SIZE - 1) / BUF_SIZE;
    uint32_t actualSize = n * BUF_SIZE;

    // Write test
    Serial.println(F("Starting write test..."));
    Serial.println(F("write speed and latency"));
    Serial.println(F("speed,max,min,avg"));
    Serial.println(F("KB/Sec,usec,usec,usec"));

    uint32_t sectorCount = (actualSize + 4095) / 4096;
    for (uint32_t i = 0; i < sectorCount; i++) {
      flash.eraseSector(i * 4096);
    }

    float s;
    uint32_t t, maxLatency, minLatency, totalLatency;
    maxLatency = 0;
    minLatency = 9999999;
    totalLatency = 0;
    t = millis();

    for (uint32_t i = 0; i < n; i++) {
      uint32_t addr = i * BUF_SIZE;
      uint32_t m = micros();
      for (size_t j = 0; j < BUF_SIZE && (addr + j) < testSize; j++) {
        if (!flash.writeByte(addr + j, buf[j])) {
          Serial.println(F("Write failed"));
          break;
        }
      }
      m = micros() - m;
      totalLatency += m;
      if (maxLatency < m) maxLatency = m;
      if (minLatency > m) minLatency = m;
    }

    t = millis() - t;
    s = testSize / 1000.0 / (t / 1000.0);
    Serial.print(s);
    Serial.print(F(","));
    Serial.print(maxLatency);
    Serial.print(F(","));
    Serial.print(minLatency);
    Serial.print(F(","));
    Serial.println(totalLatency / n);

    // Read test
    Serial.println(F("\nStarting read test..."));
    Serial.println(F("read speed and latency"));
    Serial.println(F("speed,max,min,avg"));
    Serial.println(F("KB/Sec,usec,usec,usec"));

    maxLatency = 0;
    minLatency = 9999999;
    totalLatency = 0;
    t = millis();

    for (uint32_t i = 0; i < n; i++) {
      uint32_t addr = i * BUF_SIZE;
      buf[BUF_SIZE - 1] = 0;
      uint32_t m = micros();
      for (size_t j = 0; j < BUF_SIZE && (addr + j) < testSize; j++) {
        buf[j] = flash.readByte(addr + j);
      }
      m = micros() - m;
      totalLatency += m;
      if ((addr + BUF_SIZE - 1) < testSize) {
        Serial.print(F("Last byte read: "));
        Serial.println(buf[BUF_SIZE - 1], HEX); // Debug output
        if (buf[BUF_SIZE - 1] != '\n') {
          Serial.println(F("Data check error"));
          break; // Skip to next test
        }
      }
      if (maxLatency < m) maxLatency = m;
      if (minLatency > m) minLatency = m;
    }

    t = millis() - t;
    s = testSize / 1000.0 / (t / 1000.0);
    Serial.print(s);
    Serial.print(F(","));
    Serial.print(maxLatency);
    Serial.print(F(","));
    Serial.print(minLatency);
    Serial.print(F(","));
    Serial.println(totalLatency / n);
  }

  Serial.println(F("\nAll tests complete"));
  delay(10000);
}