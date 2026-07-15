import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from "typeorm";
import type { DocumentStatus, UploadKind } from "@/domain/entities/document";
import { UserOrmEntity } from "./user.entity";

@Entity({ name: "documents" })
export class DocumentOrmEntity {
  @PrimaryColumn("uuid")
  id!: string;

  @Index()
  @Column({ name: "user_id", type: "uuid" })
  userId!: string;

  @ManyToOne(() => UserOrmEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: UserOrmEntity;

  @Column({ type: "text" })
  title!: string;

  @Column({ name: "file_name", type: "text" })
  fileName!: string;

  @Column({ name: "mime_type", type: "varchar", length: 255 })
  mimeType!: string;

  @Column({ name: "file_type", type: "varchar", length: 16 })
  fileType!: UploadKind;

  @Column({ name: "file_size", type: "bigint" })
  fileSize!: string;

  @Column({ type: "varchar", length: 16 })
  status!: DocumentStatus;

  @Column({ name: "page_count", type: "int" })
  pageCount!: number;

  @Column({ name: "storage_path", type: "text" })
  storagePath!: string;

  @Column({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @Column({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;

  @Column({ type: "text", nullable: true })
  error!: string | null;
}
