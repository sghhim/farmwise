import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import type { FarmField } from "./FarmField";
import { ObservationMedia } from "./ObservationMedia";

export enum ObservationSeverity {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
}

@Entity({ name: "field_observations" })
export class FieldObservation {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "field_id" })
  fieldId!: string;

  @ManyToOne(
    () =>
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require("./FarmField").FarmField,
    (f: FarmField) => f.observations,
    { onDelete: "CASCADE" }
  )
  @JoinColumn({ name: "field_id" })
  field!: FarmField;

  @Column({ name: "symptom_text", type: "text" })
  symptomText!: string;

  @Column({ type: "enum", enum: ObservationSeverity })
  severity!: ObservationSeverity;

  @Column({ name: "observed_at", type: "timestamptz" })
  observedAt!: Date;

  @OneToMany(() => ObservationMedia, (m) => m.observation, { cascade: true })
  media!: ObservationMedia[];

  /** Admin moderation: removed observations are hidden from farmer lists. */
  @Column({ name: "is_removed_by_moderator", default: false })
  isRemovedByModerator!: boolean;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}
