#!/bin/bash

# Fix all require() statements in testRunnerService.ts
sed -i.bak '85s/const chatService = require/\/\/ eslint-disable-next-line @typescript-eslint\/no-var-requires\n            const chatService = require/' src/services/benchmark/testRunnerService.ts
sed -i.bak '86s/const contextService = require/\/\/ eslint-disable-next-line @typescript-eslint\/no-var-requires\n            const contextService = require/' src/services/benchmark/testRunnerService.ts
sed -i.bak '87s/const fileProcessingService = require/\/\/ eslint-disable-next-line @typescript-eslint\/no-var-requires\n            const fileProcessingService = require/' src/services/benchmark/testRunnerService.ts
sed -i.bak '317s/const db = require/\/\/ eslint-disable-next-line @typescript-eslint\/no-var-requires\n            const db = require/' src/services/benchmark/testRunnerService.ts
sed -i.bak '443s/const metricCalculator = require/\/\/ eslint-disable-next-line @typescript-eslint\/no-var-requires\n        const metricCalculator = require/' src/services/benchmark/testRunnerService.ts

# Clean up backup files
rm -f src/services/benchmark/testRunnerService.ts.bak

echo "Fixed require() statements"
