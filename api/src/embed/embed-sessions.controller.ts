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
import { BusinessAuthGuard } from '../auth/business-auth.guard';
import { EmbedAuthGuard, assertEmbedSessionScope } from '../auth/embed-auth.guard';
import { RequestWithBusiness } from '../auth/request-with-business';
import { RequestWithEmbed } from '../auth/request-with-embed';
import { ENVIRONMENT_HEADER, parseEnvironment } from '../auth/environment';
import { CreateEmbedSessionDto } from './dto/create-embed-session.dto';
import { CreateHoldDto } from '../dto/create-hold.dto';
import { EmbedSessionsService } from './embed-sessions.service';
import { ReservationsService } from '../reservations/reservations.service';
import { PlanDraftsService } from '../plan/plan-drafts.service';

@Controller()
export class EmbedSessionsController {
  constructor(
    private readonly embed: EmbedSessionsService,
    private readonly reservations: ReservationsService,
    private readonly plans: PlanDraftsService,
  ) {}

  @Post('embed-sessions')
  @UseGuards(BusinessAuthGuard)
  @HttpCode(201)
  create(@Body() body: CreateEmbedSessionDto, @Req() req: RequestWithBusiness) {
    const environment = parseEnvironment(req.header(ENVIRONMENT_HEADER));
    return this.embed.create(req.business!, environment, body.sessionId, body.hostOrigin);
  }

  @Get('embed/sessions/:sessionId/layout')
  @UseGuards(EmbedAuthGuard)
  getLayout(
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Req() req: RequestWithEmbed,
  ) {
    assertEmbedSessionScope(req, sessionId);
    return this.plans.getSessionLayoutPublic(sessionId);
  }

  @Get('embed/sessions/:sessionId/seats')
  @UseGuards(EmbedAuthGuard)
  getSeats(
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Req() req: RequestWithEmbed,
  ) {
    assertEmbedSessionScope(req, sessionId);
    return this.reservations.getSessionSeats(sessionId);
  }

  @Post('embed/sessions/:sessionId/holds')
  @UseGuards(EmbedAuthGuard)
  @HttpCode(201)
  createHold(
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Body() body: CreateHoldDto,
    @Req() req: RequestWithEmbed,
  ) {
    assertEmbedSessionScope(req, sessionId);
    const environment = req.embedSession!.environment;
    return this.reservations.createHold(sessionId, req.business!, body.seatIds, environment);
  }

  @Post('embed/holds/:holdId/release')
  @UseGuards(EmbedAuthGuard)
  @HttpCode(204)
  async releaseHold(
    @Param('holdId', ParseUUIDPipe) holdId: string,
    @Req() req: RequestWithEmbed,
  ) {
    const environment = req.embedSession!.environment;
    await this.reservations.releaseHold(holdId, req.business!, environment);
  }
}
