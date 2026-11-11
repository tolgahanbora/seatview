import { MigrationInterface, QueryRunner } from 'typeorm';

export class S1VenuePlanSessions1731206400000 implements MigrationInterface {
  name = 'S1VenuePlanSessions1731206400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS venues (
        id uuid PRIMARY KEY,
        business_id uuid NOT NULL REFERENCES businesses(id),
        name text NOT NULL
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS plan_versions (
        id uuid PRIMARY KEY,
        venue_id uuid NOT NULL REFERENCES venues(id),
        hall_plan_id uuid REFERENCES hall_plans(id),
        version int NOT NULL,
        published_at timestamptz NOT NULL,
        UNIQUE (venue_id, version)
      );
    `);

    await queryRunner.query(`
      ALTER TABLE sessions
        ADD COLUMN IF NOT EXISTS venue_id uuid,
        ADD COLUMN IF NOT EXISTS plan_version_id uuid,
        ADD COLUMN IF NOT EXISTS starts_at timestamptz,
        ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'Europe/Istanbul',
        ADD COLUMN IF NOT EXISTS environment text DEFAULT 'test';
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'sessions_venue_id_fkey'
        ) THEN
          ALTER TABLE sessions
            ADD CONSTRAINT sessions_venue_id_fkey
            FOREIGN KEY (venue_id) REFERENCES venues(id);
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'sessions_plan_version_id_fkey'
        ) THEN
          ALTER TABLE sessions
            ADD CONSTRAINT sessions_plan_version_id_fkey
            FOREIGN KEY (plan_version_id) REFERENCES plan_versions(id);
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      ALTER TABLE seats ADD COLUMN IF NOT EXISTS plan_version_id uuid;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'seats_plan_version_id_fkey'
        ) THEN
          ALTER TABLE seats
            ADD CONSTRAINT seats_plan_version_id_fkey
            FOREIGN KEY (plan_version_id) REFERENCES plan_versions(id);
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_sessions_business_env
        ON sessions (business_id, environment);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_sessions_business_env`);
    await queryRunner.query(
      `ALTER TABLE seats DROP CONSTRAINT IF EXISTS seats_plan_version_id_fkey`,
    );
    await queryRunner.query(`ALTER TABLE seats DROP COLUMN IF EXISTS plan_version_id`);
    await queryRunner.query(
      `ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_plan_version_id_fkey`,
    );
    await queryRunner.query(
      `ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_venue_id_fkey`,
    );
    await queryRunner.query(`ALTER TABLE sessions DROP COLUMN IF EXISTS environment`);
    await queryRunner.query(`ALTER TABLE sessions DROP COLUMN IF EXISTS timezone`);
    await queryRunner.query(`ALTER TABLE sessions DROP COLUMN IF EXISTS starts_at`);
    await queryRunner.query(`ALTER TABLE sessions DROP COLUMN IF EXISTS plan_version_id`);
    await queryRunner.query(`ALTER TABLE sessions DROP COLUMN IF EXISTS venue_id`);
    await queryRunner.query(`DROP TABLE IF EXISTS plan_versions`);
    await queryRunner.query(`DROP TABLE IF EXISTS venues`);
  }
}
