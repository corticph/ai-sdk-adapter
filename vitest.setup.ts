import { config } from 'dotenv';
import { resolve } from 'node:path';

// Load environment variables from .env file for integration tests
const result = config({ path: resolve(process.cwd(), '.env') });

if (result.error) {
  console.warn('Failed to load .env file:', result.error);
} else {
  console.log('Loaded environment variables from .env');
}

