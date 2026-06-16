import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  stravaId!: number;

  @Column()
  firstname!: string;

  @Column()
  lastname!: string;

  @Column({ nullable: true, type: 'text' })
  city!: string | null;

  @Column({ nullable: true, type: 'text' })
  state!: string | null;

  @Column({ nullable: true, type: 'text' })
  country!: string | null;

  @Column({ nullable: true, type: 'text' })
  sex!: string | null;

  @Column()
  profile!: string;

  @Column()
  accessToken!: string;

  @Column()
  refreshToken!: string;

  /** Timestamp epoch (secondes) d'expiration de l'access token. */
  @Column()
  tokenExpiresAt!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
