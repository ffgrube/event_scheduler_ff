/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Task, Department, TaskStatus } from '../types';
import { Plus, Edit3, Trash2, Calendar, Clock, BookOpen, Layers } from 'lucide-react';

interface TaskFormProps {
  departments: Department[];
  onSubmit: (task: Omit<Task, 'id'> & { id?: string }) => void;
  editingTask: Task | null;
  onCancelEdit: () => void;
  defaultDate: string;
}

export default function TaskForm({ departments, onSubmit, editingTask, onCancelEdit, defaultDate }: TaskFormProps) {
  const [code, setCode] = useState('LOG');
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState('');
  const [details, setDetails] = useState('');
  const [status, setStatus] = useState<TaskStatus>('Not Started');
  const [durationDays, setDurationDays] = useState(1);
  const [error, setError] = useState<string | null>(null);

  // Sync state if defaultDate changes or we start editing a task
  useEffect(() => {
    if (editingTask) {
      setCode(editingTask.code);
      setDate(editingTask.date);
      setTime(editingTask.time || '');
      setDetails(editingTask.details);
      setStatus(editingTask.status);
      setDurationDays(editingTask.durationDays || 1);
    } else {
      // Keep old select code/date, just clear details & time for quick successive additions
      setDetails('');
      setTime('');
      setStatus('Not Started');
      setDurationDays(1);
    }
  }, [editingTask]);

  // Adjust default date when timeline start date changes, but only if not editing
  useEffect(() => {
    if (!editingTask) {
      setDate(defaultDate);
    }
  }, [defaultDate, editingTask]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!details.trim()) {
      setError('Please enter task details.');
      const detailsInput = document.getElementById('task-details-input');
      if (detailsInput) detailsInput.focus();
      return;
    }

    if (!date) {
      setError('Please select a valid date.');
      return;
    }

    onSubmit({
      id: editingTask?.id,
      code,
      date,
      time,
      details: details.trim(),
      status,
      durationDays,
    });

    // Reset inputs for successive quick additions
    setDetails('');
    setTime('');
    // Notice how code and date are kept. This serves "rapid data entry" because
    // usually users enter multiple tasks for the same department/day in a sequence!
    const detailsInput = document.getElementById('task-details-input');
    if (detailsInput) detailsInput.focus();
  };

  const activeDept = departments.find(d => d.code === code) || departments[0];

  return (
    <div id="task-form-container" className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
        <h3 id="form-heading" className="text-sm font-semibold text-slate-800 tracking-tight flex items-center gap-2">
          <Layers className="w-4 h-4 text-indigo-500" />
          {editingTask ? 'EDIT SELECTED TASK' : 'ADD NEW SCHEDULER TASK'}
        </h3>
        {editingTask && (
          <button
            type="button"
            onClick={onCancelEdit}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
          >
            Cancel Editing
          </button>
        )}
      </div>

      <form id="task-entry-form" onSubmit={handleSubmit} className="space-y-4">
        {/* Quick Department Tags */}
        <div id="dept-tag-section" className="space-y-2">
          <span className="block text-xs font-semibold text-slate-500">Department Code / Tag</span>
          <div className="flex flex-wrap gap-1.5 p-1 bg-slate-50 border border-slate-100 rounded-lg">
            {departments.map((dept) => {
              const isSelected = code === dept.code;
              return (
                <button
                  key={dept.code}
                  type="button"
                  onClick={() => setCode(dept.code)}
                  style={{
                    backgroundColor: isSelected ? dept.color : 'transparent',
                    color: isSelected ? '#ffffff' : '#475569',
                    borderColor: isSelected ? dept.color : 'transparent',
                  }}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase transition-all duration-150 border flex items-center gap-1 cursor-pointer select-none`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full`}
                    style={{ backgroundColor: isSelected ? '#ffffff' : dept.color }}
                  />
                  {dept.code}
                </button>
              );
            })}
          </div>
        </div>

        {/* Date, Time, and Duration selectors */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <span className="block text-xs font-semibold text-slate-600">Task Date</span>
            <div className="relative">
              <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full text-xs pl-8 pr-2 py-2 border border-slate-300 rounded-lg bg-white font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="block text-xs font-semibold text-slate-600 flex justify-between">
              <span>Task Time</span>
              <span className="text-[10px] text-slate-400 font-normal">Blank = All Day</span>
            </span>
            <div className="relative">
              <Clock className="absolute left-3 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full text-xs pl-8 pr-2 py-2 border border-slate-300 rounded-lg bg-white font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="block text-xs font-semibold text-slate-600 flex justify-between">
              <span>Duration (Days)</span>
              <span className="text-[10px] text-slate-400 font-normal">Min: 1</span>
            </span>
            <div className="relative">
              <input
                type="number"
                min={1}
                required
                value={durationDays}
                onChange={(e) => setDurationDays(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none font-mono"
              />
            </div>
          </div>
        </div>

        {/* Details & description full width */}
        <div className="space-y-1.5">
          <span className="block text-xs font-semibold text-slate-600">Task Details & Description</span>
          <input
            id="task-details-input"
            type="text"
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="e.g. Pre-rig truss hoist motors inspection"
            className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none"
          />
        </div>

        {error && (
          <p className="text-xs text-red-600 font-medium bg-red-50 border border-red-100 px-3 py-1.5 rounded">
            {error}
          </p>
        )}

        <div className="flex gap-2 pt-1">
          <button
            type="submit"
            style={{ backgroundColor: activeDept.color }}
            className="flex-1 text-white text-xs font-bold py-2.5 px-4 rounded-lg hover:brightness-110 shadow-sm transition-all duration-150 flex items-center justify-center gap-1.5 cursor-pointer"
          >
            {editingTask ? <Edit3 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {editingTask ? 'Save Changes' : `Add ${activeDept.code} Task (automatically sorts)`}
          </button>
        </div>
      </form>
    </div>
  );
}
