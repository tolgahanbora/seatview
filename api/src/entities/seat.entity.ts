import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { HallPlanEntity } from './hall-plan.entity';
import { PlanVersionEntity } from './plan-version.entity';

@Entity('seats')
export class SeatEntity {
  @PrimaryColumn({ name: 'plan_version_id', type: 'uuid' })
  planVersionId!: string;

  @PrimaryColumn({ type: 'text' })
  id!: string;

  @Column({ name: 'hall_plan_id', type: 'uuid', nullable: true })
  hallPlanId!: string | null;

  @Column({ type: 'text' })
  row!: string;

  @Column({ type: 'int' })
  column!: number;

  @Column({ type: 'text' })
  category!: string;

  @Column({ type: 'int' })
  price!: number;

  @Column({ type: 'text', nullable: true })
  label!: string | null;

  @Column({ name: 'pos_x', type: 'double precision', nullable: true })
  posX!: number | null;

  @Column({ name: 'pos_y', type: 'double precision', nullable: true })
  posY!: number | null;

  @Column({ name: 'pos_z', type: 'double precision', nullable: true })
  posZ!: number | null;

  @ManyToOne(() => PlanVersionEntity, (version) => version.seats)
  @JoinColumn({ name: 'plan_version_id' })
  planVersion!: PlanVersionEntity;

  @ManyToOne(() => HallPlanEntity, { nullable: true })
  @JoinColumn({ name: 'hall_plan_id' })
  hallPlan!: HallPlanEntity | null;
}
