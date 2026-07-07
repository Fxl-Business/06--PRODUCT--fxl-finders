import 'dotenv/config';

const migrateUrl =
  process.env.TEST_DATABASE_URL ??
  process.env.DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:5006/fxl_sales';

const appUrl =
  process.env.TEST_DATABASE_URL ??
  process.env.DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:5006/fxl_sales';

const adminUrl =
  process.env.ADMIN_DATABASE_URL ??
  appUrl;

process.env.TEST_DATABASE_URL ??= appUrl;
process.env.DATABASE_URL ??= appUrl;
process.env.ADMIN_DATABASE_URL ??= adminUrl;
process.env.TEST_MIGRATE_DATABASE_URL ??= migrateUrl;
