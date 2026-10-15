import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from backend directory
dotenv.config({ path: path.join(__dirname, '.env') });

// Load public frontend .env if present
const frontendEnvPath = path.join(__dirname, '..', 'frontend', '.env');
let frontendEnv = {};
if (fs.existsSync(frontendEnvPath)) {
  const envContent = fs.readFileSync(frontendEnvPath, 'utf-8');
  frontendEnv = dotenv.parse(envContent);
}

export const config = {
  port: parseInt(process.env.PORT, 10) || 5000,
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  defaultModel: process.env.DEFAULT_MODEL || 'gemini-2.5-flash',

  // Supabase Backend Config
  supabaseUrl: process.env.SUPABASE_URL || frontendEnv.SUPABASE_URL || '',
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || frontendEnv.SUPABASE_ANON_KEY || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',

  // Public Frontend Config (safe to expose to browser)
  publicConfig: {
    supabaseUrl: frontendEnv.SUPABASE_URL || process.env.SUPABASE_URL || '',
    supabaseAnonKey: frontendEnv.SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '',
    backendApiUrl: frontendEnv.BACKEND_API_URL || process.env.BACKEND_API_URL || `http://localhost:${process.env.PORT || 5000}`
  },

  supportedModels: [
    {
      id: 'gemini-2.5-flash',
      name: 'Gemini 2.5 Flash',
      description: 'Ultra-fast, state-of-the-art multimodal model with great coding and reasoning'
    },
    {
      id: 'gemini-2.5-pro',
      name: 'Gemini 2.5 Pro',
      description: 'Advanced reasoning model for complex code, analysis and deep synthesis'
    },
    {
      id: 'gemini-1.5-flash',
      name: 'Gemini 1.5 Flash',
      description: 'High-speed model optimized for low-latency conversational tasks'
    },
    {
      id: 'gemini-1.5-pro',
      name: 'Gemini 1.5 Pro',
      description: 'High-intelligence multimodal model with long context window'
    }
  ],

  setApiKey(newKey) {
    this.geminiApiKey = newKey.trim();
    process.env.GEMINI_API_KEY = newKey.trim();
  },

  setSupabaseConfig({ url, anonKey, serviceRoleKey }) {
    if (url) {
      this.supabaseUrl = url.trim();
      this.publicConfig.supabaseUrl = url.trim();
    }
    if (anonKey) {
      this.supabaseAnonKey = anonKey.trim();
      this.publicConfig.supabaseAnonKey = anonKey.trim();
    }
    if (serviceRoleKey) {
      this.supabaseServiceRoleKey = serviceRoleKey.trim();
    }
  }
};
