import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from "typeorm";
import { DocumentOrmEntity } from "./document.entity";

@Entity({ name: "document_chunks" })
@Index(["documentId", "chunkIndex"])

export class DocumentChunkOrmEntity {
  @PrimaryColumn("uuid")
  id!: string;

  @Column({ name: "document_id", type: "uuid" })
  documentId!: string;

  @Column({ name: "page_number", type: "int" })
  pageNumber!: number;

  @Column({ name: "chunk_index", type: "int" })
  chunkIndex!: number;

  @Column({ type: "text" })
  text!: string;

  @Column({ type: "jsonb", nullable: true })
  embedding!: number[] | null;

  @ManyToOne(() => DocumentOrmEntity, (document) => document.chunks, {
    onDelete: "CASCADE"
  })
  @JoinColumn({ name: "document_id" })
  document!: DocumentOrmEntity;
}
