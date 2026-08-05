import dotenv from 'dotenv';
import pg from 'pg';
import bcrypt from 'bcryptjs';

dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const email = 'test@nekosinga.com';
const password = 'password123';
const hash = await bcrypt.hash(password, 12);

try {
  await pool.query(
    `INSERT INTO users (email, password_hash) VALUES ($1, $2)
     ON CONFLICT (email) DO NOTHING`,
    [email, hash]
  );
  console.log('Seed:OK');
  console.log(`  email:    ${email}`);
  console.log(`  password: ${password}`);
} catch (e) {
  console.error('Seed:FAIL', e.message);
  process.exit(1);
} finally {
  await pool.end();
}
