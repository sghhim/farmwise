import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import type { FieldObservation } from "./FieldObservation";

@Entity({ name: "observation_media" })
export class ObservationMedia {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "observation_id" })
  observationId!: string;

  @ManyToOne(
    () =>
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require("./FieldObservation").FieldObservation,
    (o: FieldObservation) => o.media,
    { onDelete: "CASCADE" }
  )
  @JoinColumn({ name: "observation_id" })
  observation!: FieldObservation;

  @Column()
  filename!: string;

  @Column({ name: "stored_path" })
  storedPath!: string;

  @Column({ name: "mime_type", nullable: true })
  mimeType!: string | null;

  @Column({ name: "size_bytes", type: "int" })
  sizeBytes!: number;
}
