import { MigrationInterface, QueryRunner } from 'typeorm';

export class S2PlanDrafts1732100000000 implements MigrationInterface {
  name = 'S2PlanDrafts1732100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS plan_drafts (
        id uuid PRIMARY KEY,
        business_id uuid NOT NULL REFERENCES businesses(id),
        venue_id uuid NOT NULL REFERENCES venues(id),
        hall_plan_id uuid REFERENCES hall_plans(id),
        title text NOT NULL,
        revision int NOT NULL DEFAULT 1,
        layout jsonb NOT NULL,
        last_published_revision int,
        last_published_plan_version_id uuid REFERENCES plan_versions(id),
        created_at timestamptz NOT NULL DEFAULT NOW(),
        updated_at timestamptz NOT NULL DEFAULT NOW()
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_plan_drafts_business_venue
        ON plan_drafts (business_id, venue_id);
    `);

    await queryRunner.query(`
      ALTER TABLE seats
        ADD COLUMN IF NOT EXISTS label text,
        ADD COLUMN IF NOT EXISTS pos_x double precision,
        ADD COLUMN IF NOT EXISTS pos_y double precision,
        ADD COLUMN IF NOT EXISTS pos_z double precision;
    `);

    await queryRunner.query(`
      ALTER TABLE plan_versions
        ADD COLUMN IF NOT EXISTS layout_snapshot jsonb,
        ADD COLUMN IF NOT EXISTS draft_revision int;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS plan_drafts`);
    await queryRunner.query(`
      ALTER TABLE plan_versions
        DROP COLUMN IF EXISTS layout_snapshot,
        DROP COLUMN IF EXISTS draft_revision;
    `);
    await queryRunner.query(`
      ALTER TABLE seats
        DROP COLUMN IF EXISTS label,
        DROP COLUMN IF EXISTS pos_x,
        DROP COLUMN IF EXISTS pos_y,
        DROP COLUMN IF EXISTS pos_z;
    `);
  }
}
