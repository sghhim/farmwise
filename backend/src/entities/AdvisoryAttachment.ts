import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import type { CropAdvisory } from "./CropAdvisory";

@Entity({ name: "advisory_attachments" })
export class AdvisoryAttachment {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "advisory_id" })
  advisoryId!: string;

  @ManyToOne(
    () =>
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require("./CropAdvisory").CropAdvisory,
    (a: CropAdvisory) => a.attachments,
    { onDelete: "CASCADE" }
  )
  @JoinColumn({ name: "advisory_id" })
  advisory!: CropAdvisory;

  @Column()
  filename!: string;

  @Column({ name: "stored_path" })
  storedPath!: string;

  @Column({ name: "mime_type", nullable: true })
  mimeType!: string | null;

  @Column({ name: "size_bytes", type: "int" })
  sizeBytes!: number;
}
