const migrateUrl =
  process.env.TEST_MIGRATE_DATABASE_URL ??
  process.env.MIGRATE_DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:5006/fxl_sales';

const appUrl =
  process.env.TEST_DATABASE_URL ??
  process.env.DATABASE_URL ??
  'postgresql://fxl_sales_app:fxl_sales_app@localhost:5006/fxl_sales';

const adminUrl =
  process.env.ADMIN_DATABASE_URL ??
  'postgresql://fxl_sales_admin:fxl_sales_admin@localhost:5006/fxl_sales';

process.env.TEST_MIGRATE_DATABASE_URL ??= migrateUrl;
process.env.MIGRATE_DATABASE_URL ??= migrateUrl;
process.env.TEST_DATABASE_URL ??= appUrl;
process.env.DATABASE_URL ??= appUrl;
process.env.ADMIN_DATABASE_URL ??= adminUrl;
