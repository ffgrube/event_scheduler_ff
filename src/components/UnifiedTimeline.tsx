/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Task, Department, ProjectSettings, TaskStatus } from '../types';
import { 
  formatDateShort, 
  generateDateRange, 
  getTimeSlot, 
  DEFAULT_DEPARTMENTS 
} from '../utils';
import { 
  Trash2, 
  Edit3, 
  Clock, 
  Calendar, 
  AlertCircle, 
  CheckCircle2, 
  FileText, 
  Plus, 
  Layers, 
  Filter, 
  ExternalLink
} from 'lucide-react';
import { motion } from 'motion/react';

interface UnifiedTimelineProps {
  tasks: Task[];
  settings: ProjectSettings;
  departments: Department[];
  onEditTask: (task: Task) => void;
  onDeleteTask: (id: string) => void;
  onUpdateTask: (task: Task, shouldSort?: boolean) => void;
  onQuickAddAtSlot: (date: string, timeSlot: 'Early' | 'Mid' | 'Evening') => void;
  selectedDeptFilter: string;
}

export default function UnifiedTimeline({
  tasks,
  settings,
  departments,
  onEditTask,
  onDeleteTask,
  onUpdateTask,
  onQuickAddAtSlot,
  selectedDeptFilter,
}: UnifiedTimelineProps) {
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

  // Generate the timeline dates list based on setup settings
  const dateRange = generateDateRange(settings.startDate, settings.endDate);

  // Filter tasks based on active selection filter
  const filteredTasks = tasks.filter(task => {
    if (selectedDeptFilter === 'ALL') return true;
    return task.code === selectedDeptFilter;
  });

  const getDeptColor = (code: string) => {
    const dept = departments.find(d => d.code === code);
    return dept ? dept.color : '#64748b';
  };

  return (
    <div id="unified-timeline-panel" className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
      {/* Top Section */}
      <div className="px-6 py-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-slate-50/70">
        <div>
          <h2 id="scheduler-title" className="text-base font-bold text-slate-800 tracking-tight uppercase flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-600" />
            {settings.projectName}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5 font-medium flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            Timeline Span: <span className="text-slate-700 font-semibold">{settings.startDate}</span> to <span className="text-slate-700 font-semibold">{settings.endDate}</span> ({dateRange.length} Days)
          </p>
        </div>
        
        <div className="flex items-center gap-2 text-xs text-slate-500 bg-white border border-slate-200 px-3 py-1.5 rounded-lg font-medium shadow-2xs">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>Task Count: <strong className="text-slate-800">{filteredTasks.length}</strong> sorted</span>
        </div>
      </div>

      {/* Synchronized Table Layout */}
      <div id="scheduler-table-container" className="w-full overflow-x-auto">
        <table className="w-full border-collapse text-left min-w-[1100px]">
          <thead>
            <tr className="bg-slate-800 text-white border-b border-slate-700">
              {/* Left Side Static Headers with perfect width definitions */}
              <th className="px-3 py-3 text-center text-[10px] font-bold uppercase tracking-wider border-r border-slate-700 w-12 min-w-[48px] max-w-[48px] sticky left-0 bg-slate-800 z-30">
                Item
              </th>
              <th className="px-3 py-3 text-center text-[10px] font-bold uppercase tracking-wider border-r border-slate-700 w-16 min-w-[64px] max-w-[64px] sticky left-12 bg-slate-800 z-30">
                CODE
              </th>
              <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider border-r border-slate-700 w-32 min-w-[128px] max-w-[128px] sticky left-28 bg-slate-800 z-30">
                Date
              </th>
              <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider border-r border-slate-700 w-[460px] min-w-[460px] sticky left-60 bg-slate-800 z-30">
                Task Details (Direct inline editing)
              </th>

              {/* Right Side Date Slots Headers */}
              {dateRange.map((dayDate, dayIdx) => (
                <th key={dayDate} colSpan={3} className="text-center text-[10px] font-extrabold uppercase border-r border-slate-700 py-1 bg-slate-900/90 tracking-wide min-w-[150px]">
                  <div className="text-[10px] text-indigo-300 font-bold">DAY {dayIdx + 1}</div>
                  <div className="text-[11px] font-extrabold text-white mt-0.5">{formatDateShort(dayDate)}</div>
                </th>
              ))}
            </tr>
            {/* Time Slot Labels Column Header */}
            <tr className="bg-slate-700/90 text-slate-200 border-b border-slate-600 text-[9px] font-semibold text-center select-none">
              {/* Padding cells for Sticky Headers with matching sizes */}
              <th className="sticky left-0 w-12 min-w-[48px] max-w-[48px] bg-slate-700 z-30 border-r border-slate-600"></th>
              <th className="sticky left-12 w-16 min-w-[64px] max-w-[64px] bg-slate-700 z-30 border-r border-slate-600"></th>
              <th className="sticky left-28 w-32 min-w-[128px] max-w-[128px] bg-slate-700 z-30 border-r border-slate-600"></th>
              <th className="sticky left-60 w-[460px] min-w-[460px] bg-slate-700 z-30 border-r border-slate-600"></th>

              {/* Day Subdivision Slots */}
              {dateRange.map((dayDate) => (
                <React.Fragment key={`sub-${dayDate}`}>
                  <th className="py-1 px-1 border-r border-slate-600 bg-slate-800/40 w-[50px] uppercase font-bold text-[9px] text-slate-300">Early</th>
                  <th className="py-1 px-1 border-r border-slate-600 bg-slate-800/40 w-[50px] uppercase font-bold text-[9px] text-slate-300">Mid</th>
                  <th className="py-1 px-1 border-r border-slate-650 bg-slate-800/40 w-[50px] uppercase font-bold text-[9px] text-slate-300">Evening</th>
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredTasks.length === 0 ? (
              <tr>
                <td colSpan={4 + dateRange.length * 3} className="px-6 py-12 text-center text-slate-400 bg-slate-50/50">
                  <div className="flex flex-col items-center justify-center gap-2 max-w-md mx-auto">
                    <AlertCircle className="w-8 h-8 text-slate-300" />
                    <p className="text-sm font-semibold text-slate-700">No tasks found</p>
                    <p className="text-xs text-slate-500">
                      There are no scheduled tasks matching the current filters. Add a task or adjust filters to begin.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredTasks.map((task, idx) => {
                const taskSlot = getTimeSlot(task.time);
                const isHovered = hoveredRowId === task.id;

                return (
                  <tr 
                    key={task.id}
                    onMouseEnter={() => setHoveredRowId(task.id)}
                    onMouseLeave={() => {
                      setHoveredRowId(null);
                      setConfirmingDeleteId(null);
                    }}
                    className={`border-b border-slate-100 transition-colors ${
                      isHovered ? 'bg-indigo-50/40' : 'hover:bg-slate-50/30'
                    }`}
                  >
                    {/* 1. Item # */}
                    <td className="px-3 py-2 text-center text-xs font-mono font-medium text-slate-400 border-r border-slate-100 sticky left-0 bg-white z-20 group-hover:bg-indigo-50/30 w-12 min-w-[48px] max-w-[48px]">
                      {idx + 1}
                    </td>

                    {/* 2. Department CODE dropdown */}
                    <td className="px-2 py-2 text-center border-r border-slate-100 sticky left-12 bg-white z-20 w-16 min-w-[64px] max-w-[64px]">
                      <select
                        value={task.code}
                        onChange={(e) => {
                          onUpdateTask({ ...task, code: e.target.value }, true);
                        }}
                        style={{ backgroundColor: getDeptColor(task.code) }}
                        className="px-1.5 py-0.5 rounded text-[10px] font-extrabold text-white text-center cursor-pointer outline-none border-none min-w-[48px] max-w-[56px] appearance-none hover:scale-105 active:scale-95 transition-transform"
                      >
                        {departments.map((dept) => (
                          <option key={dept.code} value={dept.code} className="bg-slate-800 text-white font-bold text-xs">
                            {dept.code}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* 3. Date picker input */}
                    <td className="px-1 py-1 border-r border-slate-100 sticky left-28 bg-white z-20 w-32 min-w-[128px] max-w-[128px]">
                      <input
                        type="date"
                        value={task.date}
                        onChange={(e) => {
                          onUpdateTask({ ...task, date: e.target.value }, false);
                        }}
                        onBlur={() => {
                          onUpdateTask(task, true);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            (e.target as HTMLInputElement).blur();
                          }
                        }}
                        className="w-full bg-transparent px-1 py-0.5 text-xs font-bold text-slate-700 hover:bg-slate-100 focus:bg-white focus:ring-1 focus:ring-indigo-500 rounded outline-none border border-transparent transition-all"
                      />
                    </td>

                    {/* 4. Task Details input with Direct Actions - guaranteed 460px to show complete text */}
                    <td className="px-2 py-1 border-r border-slate-100 sticky left-60 bg-white z-20 w-[460px] min-w-[460px] max-w-[460px]">
                      <div className="flex items-center justify-between gap-1.5 w-full">
                        <input
                          type="text"
                          value={task.details}
                          onChange={(e) => {
                            onUpdateTask({ ...task, details: e.target.value }, false);
                          }}
                          onBlur={() => {
                            onUpdateTask(task, true);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              (e.target as HTMLInputElement).blur();
                            }
                          }}
                          className="w-full bg-transparent px-1.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 focus:bg-white focus:ring-1 focus:ring-indigo-500 rounded outline-none border border-transparent transition-all"
                          title="Click directly to edit this task details"
                        />
                        
                        {/* Direct action buttons (Always visible to ensure 100% reliability on touch & iframe) */}
                        <div className="flex items-center gap-1 bg-slate-50 border border-slate-200/60 rounded-lg px-1 py-0.5 flex-shrink-0 shadow-2xs">
                          <button
                            onClick={() => {
                              onEditTask(task);
                              const detailsInput = document.getElementById('task-details-input');
                              if (detailsInput) detailsInput.focus();
                            }}
                            title="Sync task details to Sidebar Editor"
                            className="p-1 hover:bg-indigo-50 hover:text-indigo-600 text-slate-400 rounded transition-colors"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          
                          {confirmingDeleteId === task.id ? (
                            <button
                              onClick={() => {
                                onDeleteTask(task.id);
                                setConfirmingDeleteId(null);
                              }}
                              className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-[9px] rounded transition-all uppercase select-none duration-100 animate-pulse"
                              title="Click again to confirm deletion from schedule"
                            >
                              Confirm
                            </button>
                          ) : (
                            <button
                              onClick={() => setConfirmingDeleteId(task.id)}
                              title="Delete task from schedule"
                              className="p-1 hover:bg-rose-100 hover:text-rose-600 text-slate-400 rounded transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Right Side Timeline Plot Cells */}
                    {dateRange.map((dayDate) => {
                      const isSameDay = task.date === dayDate;
                      
                      return (
                        <React.Fragment key={`cell-${task.id}-${dayDate}`}>
                          {/* EARLY SLOT CELL */}
                          <td 
                            onClick={() => !isSameDay && onQuickAddAtSlot(dayDate, 'Early')}
                            className={`border-r border-slate-100 p-1 text-center min-w-[50px] transition-all relative ${
                              isSameDay ? 'bg-slate-50/10' : 'cursor-cell hover:bg-indigo-50/20'
                            }`}
                          >
                            {isSameDay && (taskSlot === 'Early' || taskSlot === 'All Day') ? (
                              <div
                                style={{ backgroundColor: getDeptColor(task.code) }}
                                className="w-full h-7 rounded text-[9px] font-extrabold text-white flex items-center justify-center shadow-xs cursor-help select-none shrink-0"
                                title={`${task.code}: ${task.details} (${task.time || 'All Day'})`}
                              >
                                {task.code}
                              </div>
                            ) : !isSameDay && isHovered ? (
                              <span className="opacity-0 group-hover:opacity-100 text-[10px] text-slate-300">+</span>
                            ) : null}
                          </td>

                          {/* MID SLOT CELL */}
                          <td 
                            onClick={() => !isSameDay && onQuickAddAtSlot(dayDate, 'Mid')}
                            className={`border-r border-slate-100 p-1 text-center min-w-[50px] transition-all relative ${
                              isSameDay ? 'bg-slate-50/10' : 'cursor-cell hover:bg-indigo-50/20'
                            }`}
                          >
                            {isSameDay && (taskSlot === 'Mid' || taskSlot === 'All Day') ? (
                              <div
                                style={{ backgroundColor: getDeptColor(task.code) }}
                                className="w-full h-7 rounded text-[9px] font-extrabold text-white flex items-center justify-center shadow-xs cursor-help select-none shrink-0"
                                title={`${task.code}: ${task.details} (${task.time || 'All Day'})`}
                              >
                                {task.code}
                              </div>
                            ) : !isSameDay && isHovered ? (
                              <span className="opacity-0 group-hover:opacity-100 text-[10px] text-slate-300">+</span>
                            ) : null}
                          </td>

                          {/* EVENING SLOT CELL */}
                          <td 
                            onClick={() => !isSameDay && onQuickAddAtSlot(dayDate, 'Evening')}
                            className={`border-r border-slate-150 p-1 text-center min-w-[50px] transition-all relative ${
                              isSameDay ? 'bg-slate-50/10' : 'cursor-cell hover:bg-indigo-50/20'
                            }`}
                          >
                            {isSameDay && (taskSlot === 'Evening' || taskSlot === 'All Day') ? (
                              <div
                                style={{ backgroundColor: getDeptColor(task.code) }}
                                className="w-full h-7 rounded text-[9px] font-extrabold text-white flex items-center justify-center shadow-xs cursor-help select-none shrink-0"
                                title={`${task.code}: ${task.details} (${task.time || 'All Day'})`}
                              >
                                {task.code}
                              </div>
                            ) : !isSameDay && isHovered ? (
                              <span className="opacity-0 group-hover:opacity-100 text-[10px] text-slate-300">+</span>
                            ) : null}
                          </td>
                        </React.Fragment>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Info Footnote */}
      <div className="bg-slate-50 px-6 py-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between text-xs text-slate-500 gap-2">
        <span className="flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 text-slate-400" />
          Pro-tip: Click any empty cell in the grid to instantly move/schedule a task directly at that day & time slot!
        </span>
        <span className="font-medium text-[11px] text-slate-400">
          Grid uses: Early (&lt;12:00) • Mid (12:00-18:00) • Evening (&gt;=18:00)
        </span>
      </div>
    </div>
  );
}
