import { config } from 'dotenv';
import { resolve } from 'node:path';

// Load environment variables from .env file for integration tests
// Skip loading .env in CI environments as they provide their own env vars
if (!process.env.CI) {
  const result = config({ path: resolve(process.cwd(), '.env'), quiet: true });
}
