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
import { BusinessAuthGuard } from '../auth/business-auth.guard';
import { RequestWithBusiness } from '../auth/request-with-business';
import { CreatePlanDraftDto } from './dto/create-plan-draft.dto';
import { PublishPlanDraftDto } from './dto/publish-plan-draft.dto';
import { SavePlanDraftDto } from './dto/save-plan-draft.dto';
import { PlanDraftsService } from './plan-drafts.service';

@Controller()
@UseGuards(BusinessAuthGuard)
export class PlanDraftsController {
  constructor(private readonly plans: PlanDraftsService) {}

  @Post('venues/:venueId/plan-drafts')
  @HttpCode(201)
  createDraft(
    @Param('venueId', ParseUUIDPipe) venueId: string,
    @Body() body: CreatePlanDraftDto,
    @Req() req: RequestWithBusiness,
  ) {
    return this.plans.createDraft(req.business!, venueId, body.title);
  }

  @Get('plan-drafts/:draftId')
  getDraft(@Param('draftId', ParseUUIDPipe) draftId: string, @Req() req: RequestWithBusiness) {
    return this.plans.getDraftForBusiness(draftId, req.business!.id);
  }

  @Get('plan-drafts/:draftId/layout')
  getDraftLayout(@Param('draftId', ParseUUIDPipe) draftId: string, @Req() req: RequestWithBusiness) {
    return this.plans.getDraftLayout(draftId, req.business!.id);
  }

  @Patch('plan-drafts/:draftId')
  saveDraft(
    @Param('draftId', ParseUUIDPipe) draftId: string,
    @Body() body: SavePlanDraftDto,
    @Req() req: RequestWithBusiness,
  ) {
    return this.plans.saveDraft(
      draftId,
      req.business!,
      body.layout,
      body.expectedRevision,
      body.title,
    );
  }

  @Post('plan-drafts/:draftId/publish')
  @HttpCode(200)
  publishDraft(
    @Param('draftId', ParseUUIDPipe) draftId: string,
    @Body() body: PublishPlanDraftDto,
    @Req() req: RequestWithBusiness,
  ) {
    return this.plans.publishDraft(draftId, req.business!, body.expectedRevision);
  }

  @Get('plan-versions/:planVersionId/layout')
  getLayout(
    @Param('planVersionId', ParseUUIDPipe) planVersionId: string,
    @Req() req: RequestWithBusiness,
  ) {
    return this.plans.getPublishedLayout(planVersionId, req.business!.id);
  }
}
