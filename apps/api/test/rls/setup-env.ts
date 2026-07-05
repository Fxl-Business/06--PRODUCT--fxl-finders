const migrateUrl =
  process.env.TEST_MIGRATE_DATABASE_URL ??
  process.env.MIGRATE_DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:5006/fxl_finders';

const appUrl =
  process.env.TEST_DATABASE_URL ??
  process.env.DATABASE_URL ??
  'postgresql://fxl_finders_app:fxl_finders_app@localhost:5006/fxl_finders';

const adminUrl =
  process.env.ADMIN_DATABASE_URL ??
  'postgresql://fxl_finders_admin:fxl_finders_admin@localhost:5006/fxl_finders';

process.env.TEST_MIGRATE_DATABASE_URL ??= migrateUrl;
process.env.MIGRATE_DATABASE_URL ??= migrateUrl;
process.env.TEST_DATABASE_URL ??= appUrl;
process.env.DATABASE_URL ??= appUrl;
process.env.ADMIN_DATABASE_URL ??= adminUrl;
