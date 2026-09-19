'use strict';
try {
  const result = require('../core/community-setup').inspectSetup();
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.ready ? 0 : 2;
} catch (error) {
  console.log(JSON.stringify({ schemaVersion: 1, ready: false, error: error.message }));
  process.exitCode = 1;
}
