/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Department, Task, TaskStatus } from './types';

// Standard production departments with elegant professional color palettes
export const DEFAULT_DEPARTMENTS: Department[] = [
  { code: 'LX', name: 'Lighting & Electrics', color: '#2563eb', textColor: '#ffffff' }, // Blue
  { code: 'AV', name: 'Audiovisual & Video', color: '#7c3aed', textColor: '#ffffff' }, // Purple
  { code: 'STG', name: 'Stage & Carpentry', color: '#dc2626', textColor: '#ffffff' },  // Red
  { code: 'LOG', name: 'Logistics & Transport', color: '#d97706', textColor: '#ffffff' }, // Amber
  { code: 'MKT', name: 'Marketing & Signs', color: '#db2777', textColor: '#ffffff' }, // Pink
  { code: 'OPS', name: 'Operations & Security', color: '#16a34a', textColor: '#ffffff' }, // Green
  { code: 'SND', name: 'Sound & Audio', color: '#0891b2', textColor: '#ffffff' }, // Cyan
  { code: 'GEN', name: 'General/Catering', color: '#4b5563', textColor: '#ffffff' }, // Slate Gray
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

// Automatically sort tasks by Date, then Time, then ID
export function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    // Primary sort: Date
    if (a.date !== b.date) {
      return a.date.localeCompare(b.date);
    }
    
    // Secondary sort: Time (Treat all day as earlier or later? Wait, all day usually comes first on a date)
    if (!a.time && b.time) return -1;
    if (a.time && !b.time) return 1;
    if (a.time && b.time) {
      return a.time.localeCompare(b.time);
    }
    
    // Tertiary: Code
    return a.code.localeCompare(b.code);
  });
}
