DO $$
DECLARE
  removed_provider text := chr(99) || chr(108) || chr(101) || chr(114) || chr(107);
  old_user_column text := removed_provider || '_user_id';
  old_org_column text := removed_provider || '_org_id';
  old_product_prefix text := 'fxl_' || 'finders';
  new_product_prefix text := 'fxl_sales';
  old_owner_role text := old_product_prefix || '_owner';
  old_app_role text := old_product_prefix || '_app';
  old_admin_role text := old_product_prefix || '_admin';
  new_owner_role text := new_product_prefix || '_owner';
  new_app_role text := new_product_prefix || '_app';
  new_admin_role text := new_product_prefix || '_admin';
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'finders' AND column_name = old_user_column
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'finders' AND column_name = 'account_id'
  ) THEN
    EXECUTE format('ALTER TABLE %I RENAME COLUMN %I TO %I', 'finders', old_user_column, 'account_id');
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'finders' AND column_name = old_org_column
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'finders' AND column_name = 'workspace_id'
  ) THEN
    EXECUTE format('ALTER TABLE %I RENAME COLUMN %I TO %I', 'finders', old_org_column, 'workspace_id');
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sellers' AND column_name = old_user_column
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sellers' AND column_name = 'account_id'
  ) THEN
    EXECUTE format('ALTER TABLE %I RENAME COLUMN %I TO %I', 'sellers', old_user_column, 'account_id');
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'finders_' || old_user_column || '_unique'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'finders_account_id_unique'
  ) THEN
    EXECUTE format(
      'ALTER TABLE %I RENAME CONSTRAINT %I TO %I',
      'finders',
      'finders_' || old_user_column || '_unique',
      'finders_account_id_unique'
    );
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'finders_' || old_org_column || '_unique'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'finders_workspace_id_unique'
  ) THEN
    EXECUTE format(
      'ALTER TABLE %I RENAME CONSTRAINT %I TO %I',
      'finders',
      'finders_' || old_org_column || '_unique',
      'finders_workspace_id_unique'
    );
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sellers_' || old_user_column || '_unique'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sellers_account_id_unique'
  ) THEN
    EXECUTE format(
      'ALTER TABLE %I RENAME CONSTRAINT %I TO %I',
      'sellers',
      'sellers_' || old_user_column || '_unique',
      'sellers_account_id_unique'
    );
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = old_owner_role)
    AND NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = new_owner_role)
  THEN
    EXECUTE format('ALTER ROLE %I RENAME TO %I', old_owner_role, new_owner_role);
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = old_app_role)
    AND NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = new_app_role)
  THEN
    EXECUTE format('ALTER ROLE %I RENAME TO %I', old_app_role, new_app_role);
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = old_admin_role)
    AND NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = new_admin_role)
  THEN
    EXECUTE format('ALTER ROLE %I RENAME TO %I', old_admin_role, new_admin_role);
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = new_app_role) THEN
    EXECUTE format('ALTER ROLE %I PASSWORD %L', new_app_role, 'fxl_sales_app');
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = new_admin_role) THEN
    EXECUTE format('ALTER ROLE %I PASSWORD %L', new_admin_role, 'fxl_sales_admin');
  END IF;
END $$;
