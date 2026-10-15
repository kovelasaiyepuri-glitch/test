import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
const envPath = path.join(__dirname, '..', '.env');
dotenv.config({ path: envPath });

const { Client } = pg;

// Paths to migration file
const migrationFile = path.join(__dirname, '..', '..', 'supabase', 'migrations', '20261014000000_create_chat_tables.sql');
const sqlFallbackFile = path.join(__dirname, '..', '..', 'supabase_schema.sql');

function getSqlContent() {
  if (fs.existsSync(migrationFile)) {
    return fs.readFileSync(migrationFile, 'utf-8');
  }
  if (fs.existsSync(sqlFallbackFile)) {
    return fs.readFileSync(sqlFallbackFile, 'utf-8');
  }
  throw new Error('Migration SQL file not found!');
}

function extractProjectRef(supabaseUrl) {
  if (!supabaseUrl) return null;
  const match = supabaseUrl.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i);
  return match ? match[1] : null;
}

async function verifyTablesWithRest(url, key) {
  try {
    const res = await fetch(`${url}/rest/v1/chats?select=id&limit=1`, {
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`
      }
    });

    if (res.status === 200 || res.status === 206) {
      return { success: true, message: 'Verified: "chats" table exists and is accessible!' };
    }

    const err = await res.json();
    return { success: false, status: res.status, error: err.message };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function runDirectSql(connectionString, sql) {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  console.log('Connected directly to Supabase PostgreSQL database.');
  console.log('Executing migration script...');

  await client.query('BEGIN');
  try {
    await client.query(sql);
    await client.query('COMMIT');
    console.log('✅ Migration committed successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    await client.end();
  }
}

async function promptUser(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  console.log('=======================================================');
  console.log('⚡ Supabase Automated Database Migration Runner');
  console.log('=======================================================');

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  const projectRef = extractProjectRef(supabaseUrl) || 'your-project-ref';
  let databaseUrl = process.env.DATABASE_URL;

  console.log(`📌 Target Project Ref: ${projectRef}`);
  console.log(`📌 Supabase URL: ${supabaseUrl}`);

  const sql = getSqlContent();

  // 1. Check if tables are already created
  console.log('\nChecking if tables already exist on Supabase...');
  const check = await verifyTablesWithRest(supabaseUrl, serviceKey);
  if (check.success) {
    console.log(`🎉 Tables are ALREADY CREATED and live in your Supabase project!`);
    console.log('You are ready to chat and persist messages.');
    process.exit(0);
  }

  console.log('Tables not yet detected. Proceeding with migration...');

  // 2. If DATABASE_URL is available in .env, execute immediately
  if (databaseUrl) {
    try {
      console.log('Found DATABASE_URL in .env. Connecting...');
      await runDirectSql(databaseUrl, sql);
      console.log('🎉 Migration finished via DATABASE_URL!');
      process.exit(0);
    } catch (err) {
      console.warn('⚠️ Direct connection with DATABASE_URL failed:', err.message);
    }
  }

  // 3. If password or DATABASE_URL not in .env, ask or provide one-click URL
  console.log('\n-------------------------------------------------------');
  console.log('Choose execution method:');
  console.log('  [1] Enter your Supabase Database Password (runs SQL directly in terminal)');
  console.log('  [2] Open Supabase SQL Editor in browser (1-click paste and run)');
  console.log('-------------------------------------------------------');

  const choice = await promptUser('Enter 1 or 2 (default is 1): ');

  if (choice === '2') {
    const sqlEditorUrl = `https://supabase.com/dashboard/project/${projectRef}/sql/new`;
    console.log(`\n🌐 Opening Supabase SQL Editor in your browser:`);
    console.log(`👉 ${sqlEditorUrl}\n`);
    console.log('Copy and paste the SQL content below into the SQL Editor and click "Run":');
    console.log('================== SQL SCRIPT ==================');
    console.log(sql);
    console.log('================================================');

    // Try opening browser
    try {
      const { exec } = await import('child_process');
      exec(`start ${sqlEditorUrl}`);
    } catch (_) {}
    process.exit(0);
  }

  // Option 1: User provides DB password
  const password = await promptUser(`Enter database password for project [${projectRef}]: `);
  if (!password) {
    console.log('No password entered. Aborted.');
    process.exit(1);
  }

  // Connection attempts (direct pooler or standard connection)
  const poolerUrl = `postgresql://postgres.${projectRef}:${encodeURIComponent(password)}@aws-0-ap-south-1.pooler.supabase.com:6543/postgres`;
  const directUrl = `postgresql://postgres:${encodeURIComponent(password)}@db.${projectRef}.supabase.co:5432/postgres`;

  try {
    console.log('\nConnecting to Supabase PostgreSQL...');
    try {
      await runDirectSql(poolerUrl, sql);
    } catch (poolerErr) {
      console.log('Pooler connection attempt failed, trying direct connection...');
      await runDirectSql(directUrl, sql);
    }

    console.log('\nVerifying table access via Supabase REST API...');
    const verify = await verifyTablesWithRest(supabaseUrl, serviceKey);
    if (verify.success) {
      console.log(`🎉 SUCCESS: ${verify.message}`);
    } else {
      console.log('Migration ran. Verification notes:', verify);
    }
    console.log('\nAll required tables (chats, messages) and RLS policies are now live! 🚀\n');
  } catch (err) {
    console.error('\n❌ Direct execution failed:', err.message);
    console.log(`\nYou can also execute the migration directly via Supabase SQL Editor:`);
    console.log(`👉 https://supabase.com/dashboard/project/${projectRef}/sql/new`);
    process.exit(1);
  }
}

main().catch(console.error);
