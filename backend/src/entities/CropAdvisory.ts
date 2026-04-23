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
import { AdvisoryAttachment } from "./AdvisoryAttachment";

export enum AdvisoryStatus {
  DRAFT = "DRAFT",
  PUBLISHED = "PUBLISHED",
  ARCHIVED = "ARCHIVED",
}

@Entity({ name: "crop_advisories" })
export class CropAdvisory {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  title!: string;

  @Column({ type: "text" })
  description!: string;

  @Column()
  category!: string;

  /** Crops this advisory applies to (e.g. "Potato", "Tomato"). */
  @Column({ name: "target_crops", type: "jsonb", default: () => "'[]'" })
  targetCrops!: string[];

  /** Human-readable geography (regions, countries, river basins). */
  @Column({ name: "geographic_labels", type: "jsonb", default: () => "'[]'" })
  geographicLabels!: string[];

  /**
   * GeoJSON Polygon or MultiPolygon (WGS84). Required before publish; used for
   * intersection matching against farmer field boundaries (no PostGIS).
   */
  @Column({ type: "jsonb", nullable: true })
  extent!: Record<string, unknown> | null;

  /**
   * Weather–risk narrative: humidity, temperature swings, leaf wetness, etc.,
   * tied to the crops above.
   */
  @Column({ name: "weather_context", type: "text", nullable: true })
  weatherContext!: string | null;

  @Column({ name: "valid_from", type: "timestamptz" })
  validFrom!: Date;

  @Column({ name: "valid_to", type: "timestamptz" })
  validTo!: Date;

  /** Assignment "capacity/limit": max hectares this advisory is intended to cover. */
  @Column({
    name: "max_recommended_hectares",
    type: "decimal",
    precision: 12,
    scale: 2,
  })
  maxRecommendedHectares!: string;

  @Column({ type: "enum", enum: AdvisoryStatus, default: AdvisoryStatus.DRAFT })
  status!: AdvisoryStatus;

  @Column({ name: "owner_id" })
  ownerId!: string;

  @ManyToOne(
    () =>
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require("./User").User,
    (u: User) => u.advisories,
    { onDelete: "CASCADE" }
  )
  @JoinColumn({ name: "owner_id" })
  owner!: User;

  @OneToMany(() => AdvisoryAttachment, (a) => a.advisory, { cascade: true })
  attachments!: AdvisoryAttachment[];

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;
}
