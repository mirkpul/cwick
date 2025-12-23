const fs = require('fs');
const path = require('path');
const db = require('../src/config/database');

const migrationFile = process.argv[2];

if (!migrationFile) {
  console.error('Usage: node scripts/run-migration.js <migration-file>');
  process.exit(1);
}

const sqlPath = path.join(__dirname, '../../database/migrations', migrationFile);

console.log(`Running migration: ${migrationFile}`);
console.log(`Path: ${sqlPath}`);

fs.readFile(sqlPath, 'utf8', async (err, sql) => {
  if (err) {
    console.error('Error reading migration file:', err);
    process.exit(1);
  }

  try {
    console.log('Executing SQL...');
    await db.query(sql);
    console.log('Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error executing migration:', error);
    process.exit(1);
  }
});
