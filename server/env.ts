import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

// Load environment variables from .env file
const envPath = resolve(rootDir, '.env');
if (fs.existsSync(envPath)) {
  config({ path: envPath });
  console.log(`Loaded environment variables from ${envPath}`);
} else {
  console.log('No .env file found, using existing environment variables');
}

// Ensure DATABASE_URL is set
if (!process.env.DATABASE_URL && process.env.NODE_ENV !== 'production') {
  console.warn('DATABASE_URL is not set. Using in-memory storage.');
} 