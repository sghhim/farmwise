import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import type { User } from "./User";
import { FieldObservation } from "./FieldObservation";

@Entity({ name: "farm_fields" })
export class FarmField {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "farmer_id" })
  farmerId!: string;

  @ManyToOne(
    () =>
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require("./User").User,
    (u: User) => u.farmFields,
    { onDelete: "CASCADE" }
  )
  @JoinColumn({ name: "farmer_id" })
  farmer!: User;

  @Column()
  name!: string;

  /** Primary crop(s) on this parcel, e.g. "Potato" or "Wheat, barley". */
  @Column({ type: "varchar", length: 120, nullable: true })
  crop!: string | null;

  @Column({ type: "decimal", precision: 12, scale: 2 })
  areaHectares!: string;

  @Column({ name: "soil_notes", type: "text", nullable: true })
  soilNotes!: string | null;

  @Column({ name: "location_text", type: "text", nullable: true })
  locationText!: string | null;

  /** GeoJSON Polygon in WGS84 (field boundary drawn on map). */
  @Column({ type: "jsonb", nullable: true })
  boundary!: { type: "Polygon"; coordinates: number[][][] } | null;

  @OneToMany(() => FieldObservation, (o) => o.field)
  observations!: FieldObservation[];

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;
}
