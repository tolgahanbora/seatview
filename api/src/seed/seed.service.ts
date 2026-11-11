import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { DemoSeedService } from './demo-seed.service';

@Injectable()
export class SeedService implements OnApplicationBootstrap {
  constructor(private readonly demoSeed: DemoSeedService) {}

  async onApplicationBootstrap() {
    if (process.env.SEATVIEW_SKIP_SEED === '1') {
      return;
    }
    if (process.env.SEATVIEW_SEED_ON_BOOT === '0') {
      return;
    }
    await this.demoSeed.run();
  }
}
