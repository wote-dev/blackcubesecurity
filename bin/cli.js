#!/usr/bin/env node
import('../dist/cli.js').catch((error) => {
  console.error('BlackCube Security failed to start:', error);
  process.exit(1);
});


