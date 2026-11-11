import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { BusinessAuthGuard } from '../auth/business-auth.guard';
import { RequestWithBusiness } from '../auth/request-with-business';
import { CreateSessionDto } from './dto/create-session.dto';
import { PatchSessionSalesDto } from './dto/patch-session-sales.dto';
import { ENVIRONMENT_HEADER, parseEnvironment } from '../auth/environment';

@Controller()
export class SessionsController {
  constructor(private readonly sessions: SessionsService) {}

  @Get('venues')
  @UseGuards(BusinessAuthGuard)
  listVenues(@Req() req: RequestWithBusiness) {
    const environment = parseEnvironment(req.header(ENVIRONMENT_HEADER));
    return this.sessions.listVenues(req.business!.id, environment);
  }

  @Get('sessions')
  @UseGuards(BusinessAuthGuard)
  listSessions(@Req() req: RequestWithBusiness) {
    const environment = parseEnvironment(req.header(ENVIRONMENT_HEADER));
    return this.sessions.listSessions(req.business!.id, environment);
  }

  @Get('sessions/:sessionId/detail')
  @UseGuards(BusinessAuthGuard)
  getSession(
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Req() req: RequestWithBusiness,
  ) {
    const environment = parseEnvironment(req.header(ENVIRONMENT_HEADER));
    return this.sessions.getSession(sessionId, req.business!.id, environment);
  }

  @Post('sessions')
  @UseGuards(BusinessAuthGuard)
  @HttpCode(201)
  createSession(@Body() body: CreateSessionDto, @Req() req: RequestWithBusiness) {
    const environment = parseEnvironment(req.header(ENVIRONMENT_HEADER));
    return this.sessions.createSession(req.business!, environment, body);
  }

  @Get('sessions/:sessionId/sales')
  @UseGuards(BusinessAuthGuard)
  getSales(
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Req() req: RequestWithBusiness,
  ) {
    const environment = parseEnvironment(req.header(ENVIRONMENT_HEADER));
    return this.sessions.getSessionSales(sessionId, req.business!.id, environment);
  }

  @Patch('sessions/:sessionId/sales')
  @UseGuards(BusinessAuthGuard)
  patchSales(
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Body() body: PatchSessionSalesDto,
    @Req() req: RequestWithBusiness,
  ) {
    const environment = parseEnvironment(req.header(ENVIRONMENT_HEADER));
    return this.sessions.patchSessionSales(sessionId, req.business!, environment, body);
  }
}
