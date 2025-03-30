#include <SPI.h>
#include <SPIFlash.h>

// Define the chip select pin for the W25Q128JV
#define FLASH_CS_PIN 10  // Chip Select pin for Arduino Uno

// SPIFlash object
SPIFlash flash(FLASH_CS_PIN);

// Buffer size (256 bytes = page size, fits Uno SRAM; scale to 4096 on Mega/Teensy)
const size_t BUF_SIZE = 256;

// Test sizes in bytes (16 bytes to 512 KB)
const uint32_t TEST_SIZES[] = {
  16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192, 16384, 32768, 65536, 131072, 262144, 524288
};
const uint8_t NUM_TESTS = sizeof(TEST_SIZES) / sizeof(TEST_SIZES[0]);

// Buffer (4-byte aligned for safety)
uint32_t buf32[(BUF_SIZE + 3) / 4];
uint8_t* buf = (uint8_t*)buf32;

// Manual status register read (since _readStat1 is private)
uint8_t readStatus() {
  digitalWrite(FLASH_CS_PIN, LOW);
  SPI.transfer(0x05);  // Read Status Register 1 command
  uint8_t status = SPI.transfer(0x00);
  digitalWrite(FLASH_CS_PIN, HIGH);
  return status;
}

// Custom SPI bulk write (256-byte page max)
void writePage(uint32_t addr, uint8_t* data, size_t len) {
  digitalWrite(FLASH_CS_PIN, LOW);
  SPI.transfer(0x06);  // Write Enable
  digitalWrite(FLASH_CS_PIN, HIGH);

  digitalWrite(FLASH_CS_PIN, LOW);
  SPI.transfer(0x02);  // Page Program command
  SPI.transfer((addr >> 16) & 0xFF);  // 24-bit address
  SPI.transfer((addr >> 8) & 0xFF);
  SPI.transfer(addr & 0xFF);
  for (size_t i = 0; i < len; i++) {
    SPI.transfer(data[i]);  // Bulk transfer
  }
  digitalWrite(FLASH_CS_PIN, HIGH);

  // Wait for write to complete using custom readStatus
  while (readStatus() & 0x01) yield();
}

// Custom SPI bulk read
void readPage(uint32_t addr, uint8_t* data, size_t len) {
  digitalWrite(FLASH_CS_PIN, LOW);
  SPI.transfer(0x03);  // Read command
  SPI.transfer((addr >> 16) & 0xFF);  // 24-bit address
  SPI.transfer((addr >> 8) & 0xFF);
  SPI.transfer(addr & 0xFF);
  for (size_t i = 0; i < len; i++) {
    data[i] = SPI.transfer(0x00);  // Bulk read
  }
  digitalWrite(FLASH_CS_PIN, HIGH);
}

// Clear serial input buffer
void clearSerialInput() {
  uint32_t m = micros();
  do {
    if (Serial.read() >= 0) m = micros();
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
  Serial.begin(115200);  // Faster baud rate
  while (!Serial) ;      // Wait for Serial
  delay(1000);
  Serial.println(F("\nOptimized SPI Flash Benchmark for W25Q128JV"));
  Serial.println(F("Testing sizes from 16 bytes to 512 KB"));

  // Initialize SPI at 8 MHz (Uno max)
  SPI.begin();
  SPI.beginTransaction(SPISettings(8000000, MSBFIRST, SPI_MODE0));

  if (!flash.begin()) {
    Serial.println(F("SPI Flash init failed!"));
    while (1) delay(1000);
  }
  printFlashInfo();

  // Pre-erase the maximum test region once (covers 512 KB)
  uint32_t maxSize = TEST_SIZES[NUM_TESTS - 1];
  uint32_t sectorCount = (maxSize + 4095) / 4096;
  Serial.println(F("Pre-erasing test region..."));
  for (uint32_t i = 0; i < sectorCount; i++) {
    flash.eraseSector(i * 4096);
  }
  Serial.println(F("Pre-erase complete"));

  // Fill buffer with test pattern
  for (size_t i = 0; i < BUF_SIZE; i++) {
    buf[i] = 'A' + (i % 26);  // Binary pattern
  }
  buf[BUF_SIZE - 1] = '\n';    // Sentinel for verification
}

void loop() {
  clearSerialInput();
  Serial.println(F("\nType any character to start"));
  while (!Serial.available()) yield();

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

    uint32_t n = (testSize + BUF_SIZE - 1) / BUF_SIZE;  // Number of chunks
    uint32_t actualSize = n * BUF_SIZE;

    // Write Test
    Serial.println(F("Starting write test..."));
    Serial.println(F("write speed and latency"));
    Serial.println(F("speed,max,min,avg"));
    Serial.println(F("KB/Sec,usec,usec,usec"));

    float s;
    uint32_t t, maxLatency = 0, minLatency = 9999999, totalLatency = 0;
    t = millis();

    for (uint32_t i = 0; i < n; i++) {
      uint32_t addr = i * BUF_SIZE;
      size_t bytesToWrite = min(BUF_SIZE, testSize - addr);
      uint32_t m = micros();
      writePage(addr, buf, bytesToWrite);  // Custom bulk write
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

    // Read Test
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
      size_t bytesToRead = min(BUF_SIZE, testSize - addr);
      uint32_t m = micros();
      readPage(addr, buf, bytesToRead);  // Custom bulk read
      m = micros() - m;
      totalLatency += m;
      if ((addr + bytesToRead - 1) < testSize && buf[bytesToRead - 1] != '\n') {
        Serial.println(F("Data check error"));
        break;
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
