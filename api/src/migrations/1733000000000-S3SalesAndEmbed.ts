import { MigrationInterface, QueryRunner } from 'typeorm';

export class S3SalesAndEmbed1733000000000 implements MigrationInterface {
  name = 'S3SalesAndEmbed1733000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE businesses
        ADD COLUMN IF NOT EXISTS embed_allowed_origins jsonb DEFAULT '[]'::jsonb;
    `);

    await queryRunner.query(`
      ALTER TABLE sessions
        ADD COLUMN IF NOT EXISTS sales_open boolean NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS category_prices jsonb;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS session_seat_blocks (
        session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        seat_id text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT NOW(),
        PRIMARY KEY (session_id, seat_id)
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS embed_sessions (
        id uuid PRIMARY KEY,
        business_id uuid NOT NULL REFERENCES businesses(id),
        session_id uuid NOT NULL REFERENCES sessions(id),
        environment text NOT NULL DEFAULT 'test',
        host_origin text NOT NULL,
        token_hash text NOT NULL,
        expires_at timestamptz NOT NULL,
        created_at timestamptz NOT NULL DEFAULT NOW()
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_embed_sessions_token_hash
        ON embed_sessions (token_hash);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS embed_sessions`);
    await queryRunner.query(`DROP TABLE IF EXISTS session_seat_blocks`);
    await queryRunner.query(`
      ALTER TABLE sessions
        DROP COLUMN IF EXISTS sales_open,
        DROP COLUMN IF EXISTS category_prices;
    `);
    await queryRunner.query(`
      ALTER TABLE businesses DROP COLUMN IF EXISTS embed_allowed_origins;
    `);
  }
}
