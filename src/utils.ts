/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Department, Task, TaskStatus } from './types';

// Standard production departments with elegant professional color palettes
export const DEFAULT_DEPARTMENTS: Department[] = [
  { code: 'ARC', name: 'ARC production', color: '#0ea5e9', textColor: '#ffffff' }, // Elegant Sky Blue
  { code: 'MISC', name: 'misc', color: '#64748b', textColor: '#ffffff' }, // Slate Gray
];

export function getDaysDifference(from: string, toStr: string): number {
  if (!from || !toStr) return 0;
  const d1 = new Date(from + 'T00:00:00');
  const d2 = new Date(toStr + 'T00:00:00');
  const diffTime = d1.getTime() - d2.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

export function formatDateShort(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { day: '2-digit', month: 'short' });
}

export function generateDateRange(startStr: string, endStr: string): string[] {
  const dates: string[] = [];
  if (!startStr || !endStr) return dates;

  const current = new Date(startStr + 'T00:00:00');
  const end = new Date(endStr + 'T00:00:00');

  // Prevent infinite loop if end date is somehow before start date
  if (current > end) {
    // Return at least the start date
    dates.push(startStr);
    return dates;
  }

  // Cap at 100 days to prevent browser-freezing in case of wild dates
  let safetyCounter = 0;
  while (current <= end && safetyCounter < 100) {
    const year = current.getFullYear();
    const month = String(current.getMonth() + 1).padStart(2, '0');
    const day = String(current.getDate()).padStart(2, '0');
    dates.push(`${year}-${month}-${day}`);
    
    current.setDate(current.getDate() + 1);
    safetyCounter++;
  }

  return dates;
}

export function getTimeSlot(timeStr: string): 'Early' | 'Mid' | 'Evening' | 'All Day' {
  if (!timeStr) return 'All Day';
  
  const [hoursStr] = timeStr.split(':');
  const hours = parseInt(hoursStr, 10);
  if (isNaN(hours)) return 'All Day';

  if (hours < 12) {
    return 'Early';
  } else if (hours < 18) {
    return 'Mid';
  } else {
    return 'Evening';
  }
}

// Helper to normalize H:MM or HH:MM strings into clean 24-hour HH:MM format for reliable sorting
export function normalizeTimeStr(t?: string): string {
  if (!t) return '';
  const trimmed = t.trim();
  if (!trimmed) return '';
  const parts = trimmed.split(':');
  if (parts.length === 2) {
    const hh = parts[0].padStart(2, '0');
    const mm = parts[1].padStart(2, '0');
    return `${hh}:${mm}`;
  }
  return trimmed;
}

// Segment Time-Scaling System (22 Segments per 24h day):
// Segment 1: 00:00 - 02:00 (2h)
// Segment 2: 02:00 - 04:00 (2h)
// Segments 3-18: 04:00 - 20:00 (1h each, total 16 segments from 4am to 8pm)
// Segment 19: 20:00 - 22:00 (2h)
// Segment 20: 22:00 - 24:00 (2h)
// Total 20 standard segments + boundaries (normalized across 22 visual step slots)

export interface TimeSegmentSpan {
  leftPercent: number;
  widthPercent: number;
  isShortMilestone: boolean;
  effectiveStartTime: string;
  effectiveEndTime: string;
  durationMinutes: number;
  isUntimedDefault: boolean;
}

/**
 * Converts HH:MM string into minute count from midnight (0..1440).
 */
export function timeToMinutes(timeStr?: string): number | null {
  if (!timeStr) return null;
  const trimmed = timeStr.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(':');
  if (parts.length < 2) return null;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return null;
  return Math.max(0, Math.min(1440, h * 60 + m));
}

/**
 * Maps a minute of the day (0..1440) to fractional segment index (0..20 on the 22-segment scale).
 * Segment breakdown:
 * 00:00 - 02:00 (120 min) -> Seg 0 to 1
 * 02:00 - 04:00 (120 min) -> Seg 1 to 2
 * 04:00 - 20:00 (960 min, 16 hours, 60 min each) -> Seg 2 to 18
 * 20:00 - 22:00 (120 min) -> Seg 18 to 19
 * 22:00 - 24:00 (120 min) -> Seg 19 to 20
 */
export function minuteToSegmentValue(min: number): number {
  const TOTAL_SEGMENTS = 20; // 2 early 2h + 16 core 1h + 2 late 2h = 20 logical segment weight units
  if (min <= 0) return 0;
  if (min >= 1440) return TOTAL_SEGMENTS;

  if (min < 120) {
    // 00:00 to 02:00
    return (min / 120) * 1.0;
  } else if (min < 240) {
    // 02:00 to 04:00
    return 1.0 + ((min - 120) / 120) * 1.0;
  } else if (min < 1200) {
    // 04:00 to 20:00 (16 hours = 960 min -> 16 segments)
    return 2.0 + ((min - 240) / 60);
  } else if (min < 1320) {
    // 20:00 to 22:00 (120 min -> 1 segment)
    return 18.0 + ((min - 1200) / 120) * 1.0;
  } else {
    // 22:00 to 24:00 (120 min -> 1 segment)
    return 19.0 + ((min - 1320) / 120) * 1.0;
  }
}

/**
 * Calculates percentage span for any task inside a day cell based on the 22-segment scale.
 * - If task duration is <= 30 minutes OR end time equals start time, flags isShortMilestone = true (Star visual).
 * - If no exact start/end time is given, defaults to 09:00 - 19:00 (9:00 AM - 7:00 PM).
 */
export function calculateTaskTimeSpan(task: Task): TimeSegmentSpan {
  const TOTAL_SEGMENTS = 20;
  const rawStart = task.startTime || task.time;
  const rawEnd = task.endTime;

  const startMin = timeToMinutes(rawStart);
  const endMinParsed = timeToMinutes(rawEnd);

  // Untimed task: Default to 09:00 AM to 07:00 PM (09:00 - 19:00 = 540m to 1140m)
  if (startMin === null && endMinParsed === null) {
    const defaultStartMin = 9 * 60; // 09:00 (540)
    const defaultEndMin = 19 * 60; // 19:00 (1140)
    const startSeg = minuteToSegmentValue(defaultStartMin);
    const endSeg = minuteToSegmentValue(defaultEndMin);
    const leftPercent = (startSeg / TOTAL_SEGMENTS) * 100;
    const widthPercent = ((endSeg - startSeg) / TOTAL_SEGMENTS) * 100;

    return {
      leftPercent: Math.max(0, Math.min(100, leftPercent)),
      widthPercent: Math.max(4, Math.min(100, widthPercent)),
      isShortMilestone: false,
      effectiveStartTime: '09:00',
      effectiveEndTime: '19:00',
      durationMinutes: 600,
      isUntimedDefault: true
    };
  }

  const effectiveStartMin = startMin !== null ? startMin : 9 * 60; // default 09:00
  let effectiveEndMin = endMinParsed;

  // If end time is missing but start time was provided:
  // If task has duration 1 day and no explicit end time, default to 1 hour
  if (effectiveEndMin === null) {
    effectiveEndMin = Math.min(1440, effectiveStartMin + 60);
  }

  // If end time is before or equal to start time:
  if (effectiveEndMin <= effectiveStartMin) {
    // If exactly equal, e.g. 08:00 to 08:00, or end is smaller, treat as point-in-time milestone
    effectiveEndMin = effectiveStartMin;
  }

  const durationMinutes = effectiveEndMin - effectiveStartMin;
  // A task is a milestone if duration is 0 to 30 minutes, or if specifically <= 30 mins
  const isShortMilestone = durationMinutes <= 30 && durationMinutes >= 0;

  const startSeg = minuteToSegmentValue(effectiveStartMin);
  const endSeg = minuteToSegmentValue(effectiveEndMin);

  let leftPercent = (startSeg / TOTAL_SEGMENTS) * 100;
  let widthPercent = ((endSeg - startSeg) / TOTAL_SEGMENTS) * 100;

  // For visual representation of non-milestones, ensure a minimum readable width
  if (!isShortMilestone) {
    widthPercent = Math.max(6, widthPercent);
    if (leftPercent + widthPercent > 100) {
      leftPercent = Math.max(0, 100 - widthPercent);
    }
  }

  const fmtTime = (min: number) => {
    const h = Math.floor(min / 60).toString().padStart(2, '0');
    const m = (min % 60).toString().padStart(2, '0');
    return `${h}:${m}`;
  };

  return {
    leftPercent: Math.max(0, Math.min(100, leftPercent)),
    widthPercent: Math.max(2, Math.min(100, widthPercent)),
    isShortMilestone,
    effectiveStartTime: fmtTime(effectiveStartMin),
    effectiveEndTime: fmtTime(effectiveEndMin),
    durationMinutes,
    isUntimedDefault: false
  };
}

// Automatically sort tasks by Date, then Start Time, then End Time, then Code, then Details
export function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    // Primary sort: Date
    if (a.date !== b.date) {
      return a.date.localeCompare(b.date);
    }
    
    // Effective Start Time (prefers startTime if present, falls back to time)
    const timeA = normalizeTimeStr(a.startTime || a.time);
    const timeB = normalizeTimeStr(b.startTime || b.time);

    // Untimed ("All Day") tasks come first
    if (!timeA && timeB) return -1;
    if (timeA && !timeB) return 1;
    
    // Compare start times chronologically
    if (timeA && timeB && timeA !== timeB) {
      return timeA.localeCompare(timeB);
    }
    
    // Compare End Times if start times are equal
    const endTimeA = normalizeTimeStr(a.endTime);
    const endTimeB = normalizeTimeStr(b.endTime);
    if (endTimeA && endTimeB && endTimeA !== endTimeB) {
      return endTimeA.localeCompare(endTimeB);
    }

    // Tertiary sort: Code
    if (a.code !== b.code) {
      return a.code.localeCompare(b.code);
    }

    // Quaternary sort: Details
    return a.details.localeCompare(b.details);
  });
}

/**
 * Safely converts any hex color string (e.g., "#2563eb", "2563eb", "#f00", "f00", etc.)
 * into an {r, g, b} object with robust fallbacks to prevent crashes in older PDF engines.
 */
export function hexToRgb(hex: string, fallback = { r: 79, g: 70, b: 229 }): { r: number; g: number; b: number } {
  if (!hex || typeof hex !== 'string') return fallback;
  
  let cleaned = hex.trim().replace(/^#/, '');
  
  if (cleaned.length === 3) {
    cleaned = cleaned.split('').map(char => char + char).join('');
  }
  
  if (cleaned.length < 6) return fallback;
  
  const r = parseInt(cleaned.slice(0, 2), 16);
  const g = parseInt(cleaned.slice(2, 4), 16);
  const b = parseInt(cleaned.slice(4, 6), 16);
  
  if (isNaN(r) || isNaN(g) || isNaN(b)) {
    return fallback;
  }
  
  return { r, g, b };
}

