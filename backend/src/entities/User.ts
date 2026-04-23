import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { FarmField } from "./FarmField";
import { CropAdvisory } from "./CropAdvisory";

export enum UserRole {
  ADMIN = "ADMIN",
  AGRONOMIST = "AGRONOMIST",
  FARMER = "FARMER",
}

@Entity({ name: "users" })
export class User {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ unique: true })
  email!: string;

  @Column({ name: "password_hash" })
  passwordHash!: string;

  @Column({ type: "enum", enum: UserRole })
  role!: UserRole;

  /** Agronomists must be verified by admin before publishing advisories. */
  @Column({ name: "agronomist_verified", default: false })
  agronomistVerified!: boolean;

  @Column({ name: "is_active", default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @OneToMany(() => FarmField, (f) => f.farmer)
  farmFields!: FarmField[];

  @OneToMany(() => CropAdvisory, (a) => a.owner)
  advisories!: CropAdvisory[];
}
