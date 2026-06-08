import { MigrationInterface, QueryRunner } from "typeorm";

export class Migrations1780955820527 implements MigrationInterface {
    name = 'Migrations1780955820527'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL, "google_id" character varying(255) NOT NULL, "email" character varying(320) NOT NULL, "name" text NOT NULL, "picture" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_0bd5012aeb82628e07f6a1be53" ON "users" ("google_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_97672ac88f789774dd47f7c8be" ON "users" ("email") `);
        await queryRunner.query(`ALTER TABLE "documents" ADD "user_id" uuid NOT NULL`);
        await queryRunner.query(`CREATE INDEX "IDX_c7481daf5059307842edef74d7" ON "documents" ("user_id") `);
        await queryRunner.query(`ALTER TABLE "documents" ADD CONSTRAINT "FK_c7481daf5059307842edef74d73" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "documents" DROP CONSTRAINT "FK_c7481daf5059307842edef74d73"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c7481daf5059307842edef74d7"`);
        await queryRunner.query(`ALTER TABLE "documents" DROP COLUMN "user_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_97672ac88f789774dd47f7c8be"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0bd5012aeb82628e07f6a1be53"`);
        await queryRunner.query(`DROP TABLE "users"`);
    }

}
