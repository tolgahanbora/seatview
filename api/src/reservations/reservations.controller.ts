import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ReservationsService } from './reservations.service';
import { PlanDraftsService } from '../plan/plan-drafts.service';
import { CreateHoldDto } from '../dto/create-hold.dto';
import { ConfirmHoldDto } from '../dto/confirm-hold.dto';
import { BusinessAuthGuard } from '../auth/business-auth.guard';
import { RequestWithBusiness } from '../auth/request-with-business';
import { ENVIRONMENT_HEADER, parseEnvironment } from '../auth/environment';

@Controller()
export class ReservationsController {
  constructor(
    private readonly reservations: ReservationsService,
    private readonly plans: PlanDraftsService,
  ) {}

  @Get('sessions/:sessionId/layout')
  getSessionLayout(@Param('sessionId', ParseUUIDPipe) sessionId: string) {
    return this.plans.getSessionLayoutPublic(sessionId);
  }

  @Get('sessions/:sessionId/seats')
  getSeats(@Param('sessionId', ParseUUIDPipe) sessionId: string) {
    return this.reservations.getSessionSeats(sessionId);
  }

  @Post('sessions/:sessionId/holds')
  @HttpCode(201)
  @UseGuards(BusinessAuthGuard)
  createHold(
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Body() body: CreateHoldDto,
    @Req() req: RequestWithBusiness,
  ) {
    const environment = parseEnvironment(req.header(ENVIRONMENT_HEADER));
    return this.reservations.createHold(sessionId, req.business!, body.seatIds, environment);
  }

  @Post('holds/:holdId/confirm')
  @UseGuards(BusinessAuthGuard)
  @HttpCode(200)
  confirmHold(
    @Param('holdId', ParseUUIDPipe) holdId: string,
    @Body() body: ConfirmHoldDto,
    @Req() req: RequestWithBusiness,
  ) {
    const environment = parseEnvironment(req.header(ENVIRONMENT_HEADER));
    return this.reservations.confirmHold(holdId, req.business!, body.orderKey, environment);
  }

  @Post('holds/:holdId/release')
  @UseGuards(BusinessAuthGuard)
  @HttpCode(204)
  async releaseHold(
    @Param('holdId', ParseUUIDPipe) holdId: string,
    @Req() req: RequestWithBusiness,
  ) {
    const environment = parseEnvironment(req.header(ENVIRONMENT_HEADER));
    await this.reservations.releaseHold(holdId, req.business!, environment);
  }
}
