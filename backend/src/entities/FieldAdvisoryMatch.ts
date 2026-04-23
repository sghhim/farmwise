import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from "typeorm";
import type { CropAdvisory } from "./CropAdvisory";
import type { FarmField } from "./FarmField";

@Entity({ name: "field_advisory_matches" })
@Unique(["fieldId", "advisoryId"])
export class FieldAdvisoryMatch {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "field_id" })
  fieldId!: string;

  @ManyToOne(
    () =>
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require("./FarmField").FarmField,
    { onDelete: "CASCADE" }
  )
  @JoinColumn({ name: "field_id" })
  field!: FarmField;

  @Column({ name: "advisory_id" })
  advisoryId!: string;

  @ManyToOne(
    () =>
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require("./CropAdvisory").CropAdvisory,
    { onDelete: "CASCADE" }
  )
  @JoinColumn({ name: "advisory_id" })
  advisory!: CropAdvisory;

  @Column({ type: "text" })
  explanation!: string;

  @CreateDateColumn({ name: "matched_at" })
  matchedAt!: Date;
}
