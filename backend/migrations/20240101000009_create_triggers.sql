-- Updated_at trigger function (PostgreSQL only)
-- Note: DSQL doesn't support triggers
-- We'll handle updated_at in application code for DSQL

DO $$ 
BEGIN
    -- Try to create the trigger function
    -- This will only work on PostgreSQL
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $BODY$
    BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
    END;
    $BODY$ language 'plpgsql';
    
    -- Apply updated_at triggers to all relevant tables
    DROP TRIGGER IF EXISTS update_rooms_updated_at ON rooms;
    CREATE TRIGGER update_rooms_updated_at BEFORE UPDATE ON rooms
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

    DROP TRIGGER IF EXISTS update_shelving_units_updated_at ON shelving_units;
    CREATE TRIGGER update_shelving_units_updated_at BEFORE UPDATE ON shelving_units
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

    DROP TRIGGER IF EXISTS update_shelves_updated_at ON shelves;
    CREATE TRIGGER update_shelves_updated_at BEFORE UPDATE ON shelves
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

    DROP TRIGGER IF EXISTS update_containers_updated_at ON containers;
    CREATE TRIGGER update_containers_updated_at BEFORE UPDATE ON containers
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

    DROP TRIGGER IF EXISTS update_items_updated_at ON items;
    CREATE TRIGGER update_items_updated_at BEFORE UPDATE ON items
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

    DROP TRIGGER IF EXISTS update_users_updated_at ON users;
    CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION
    WHEN OTHERS THEN
        -- DSQL doesn't support triggers, that's okay
        -- We'll handle updated_at in application code
        NULL;
END $$;

