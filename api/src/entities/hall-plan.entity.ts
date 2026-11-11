import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('hall_plans')
export class HallPlanEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  name!: string;
}
