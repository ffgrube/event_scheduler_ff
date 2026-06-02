/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type TaskStatus = 'Not Started' | 'In Progress' | 'Completed' | 'Deferred';

export interface Department {
  code: string;
  name: string;
  color: string; // Tailwind bg-class-name background / border or hex
  textColor: string;
}

export interface Task {
  id: string;
  code: string; // references Department.code
  date: string; // YYYY-MM-DD
  time: string; // HH:MM, empty means "All Day"
  details: string;
  status: TaskStatus;
  durationDays?: number; // Optional duration in days, defaulting to 1
  subtasks?: Omit<Task, 'code' | 'date'>[]; // Recursive subtasks
  parentTaskId?: string; // Parent Task ID if this is a subtask
}

export interface ProjectSettings {
  projectName: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  dayNames?: Record<string, string>; // YYYY-MM-DD -> Custom Day Name
  dayNotes?: Record<string, string>; // YYYY-MM-DD -> Custom Day Notes/Details
}
