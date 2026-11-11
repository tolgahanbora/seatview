import { Injectable } from '@nestjs/common';
import { PlanLayout, PlanSeatDraft, PlanValidationIssue } from './plan-layout.types';

const MIN_SEAT_DISTANCE = 0.35;

@Injectable()
export class PlanValidationService {
  validate(layout: PlanLayout): PlanValidationIssue[] {
    const issues: PlanValidationIssue[] = [];
    const categoryIds = new Set(layout.categories.map((c) => c.id));
    const sectionIds = new Set(layout.sections.map((s) => s.id));

    if (layout.seats.length === 0) {
      issues.push({ code: 'NO_SEATS', message: 'Yayın için en az bir koltuk gerekli.' });
    }

    if (!layout.screen) {
      issues.push({ code: 'NO_SCREEN', message: 'Perde/sahne tanımlanmalı.' });
    } else if (
      !Number.isFinite(layout.screen.width) ||
      !Number.isFinite(layout.screen.height) ||
      !Number.isFinite(layout.screen.bottom) ||
      layout.screen.width <= 0 ||
      layout.screen.height <= 0
    ) {
      issues.push({ code: 'INVALID_SCREEN', message: 'Perde boyutları geçersiz.' });
    }

    if (layout.sections.length === 0) {
      issues.push({ code: 'NO_SECTION', message: 'En az bir bölüm gerekli.' });
    }

    const uids = new Set<string>();
    const labels = new Set<string>();

    for (const seat of layout.seats) {
      if (!seat.uid) {
        issues.push({ code: 'SEAT_UID', message: 'Koltuk uid eksik', label: seat.label });
      } else if (uids.has(seat.uid)) {
        issues.push({
          code: 'DUPLICATE_UID',
          message: 'Yinelenen koltuk kimliği',
          seatUid: seat.uid,
        });
      } else {
        uids.add(seat.uid);
      }

      if (!seat.label?.trim()) {
        issues.push({ code: 'SEAT_LABEL', message: 'Koltuk etiketi eksik', seatUid: seat.uid });
      } else if (labels.has(seat.label)) {
        issues.push({
          code: 'DUPLICATE_LABEL',
          message: 'Yinelenen etiket: ' + seat.label,
          label: seat.label,
        });
      } else {
        labels.add(seat.label);
      }

      if (!categoryIds.has(seat.categoryId)) {
        issues.push({
          code: 'UNKNOWN_CATEGORY',
          message: 'Bilinmeyen kategori',
          seatUid: seat.uid,
        });
      }

      if (seat.sectionId && !sectionIds.has(seat.sectionId)) {
        issues.push({
          code: 'UNKNOWN_SECTION',
          message: 'Bilinmeyen bölüm',
          seatUid: seat.uid,
        });
      }

      if (!Number.isFinite(seat.x) || !Number.isFinite(seat.y) || !Number.isFinite(seat.z)) {
        issues.push({
          code: 'INVALID_COORDS',
          message: 'Geçersiz koordinat',
          seatUid: seat.uid,
          label: seat.label,
        });
      }
    }

    issues.push(...this.findOverlaps(layout.seats));
    return issues;
  }

  private findOverlaps(seats: PlanSeatDraft[]): PlanValidationIssue[] {
    const issues: PlanValidationIssue[] = [];
    for (let i = 0; i < seats.length; i += 1) {
      for (let j = i + 1; j < seats.length; j += 1) {
        const a = seats[i];
        const b = seats[j];
        if (a.row === b.row) {
          const sameBlock =
            (a.column <= 6 && b.column <= 6) || (a.column >= 7 && b.column >= 7);
          if (!sameBlock) {
            continue;
          }
        }
        const dist = Math.hypot(a.x - b.x, a.z - b.z);
        if (dist < MIN_SEAT_DISTANCE) {
          issues.push({
            code: 'OVERLAP',
            message: a.label + ' ve ' + b.label + ' çakışıyor',
            seatUid: a.uid,
            label: a.label,
          });
        }
      }
    }
    return issues;
  }
}
