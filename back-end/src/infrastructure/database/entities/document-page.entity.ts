import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from "typeorm";
import { DocumentOrmEntity } from "./document.entity";

@Entity({ name: "document_pages" })
@Index(["documentId", "pageNumber"], { unique: true })

export class DocumentPageOrmEntity {
  @PrimaryColumn("uuid")
  id!: string;

  @Column({ name: "document_id", type: "uuid" })
  documentId!: string;

  @Column({ name: "page_number", type: "int" })
  pageNumber!: number;

  @Column({ type: "text" })
  text!: string;

  @ManyToOne(() => DocumentOrmEntity, (document) => document.pages, {
    onDelete: "CASCADE"
  })
  @JoinColumn({ name: "document_id" })
  document!: DocumentOrmEntity;
}
