/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Task, Department, TaskStatus } from '../types';
import { X, Calendar, Clock, Layers, CheckCircle2, AlertCircle, Trash2, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface TaskEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  departments: Department[];
  task: Task | null; // if task.id starts with empty '' or doesn't exist, it's a draft
  onSubmit: (taskData: Omit<Task, 'id'> & { id?: string }) => void;
  onDelete?: (id: string) => void;
}

export default function TaskEditModal({
  isOpen,
  onClose,
  departments,
  task,
  onSubmit,
  onDelete,
}: TaskEditModalProps) {
  const [code, setCode] = useState('LOG');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [details, setDetails] = useState('');
  const [status, setStatus] = useState<TaskStatus>('Not Started');
  const [durationDays, setDurationDays] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const detailsInputRef = useRef<HTMLInputElement>(null);

  // Sync state when modal is opened on a task
  useEffect(() => {
    if (isOpen && task) {
      setCode(task.code);
      setDate(task.date);
      setTime(task.time || '');
      setDetails(task.details);
      setStatus(task.status || 'Not Started');
      setDurationDays(task.durationDays || 1);
      setError(null);
      setConfirmDelete(false);

      // Autofocus details input
      setTimeout(() => {
        if (detailsInputRef.current) {
          detailsInputRef.current.focus();
          detailsInputRef.current.select();
        }
      }, 150);
    }
  }, [isOpen, task]);

  if (!isOpen || !task) return null;

  const isEditMode = task.id && task.id !== '';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!details.trim()) {
      setError('Please enter task details.');
      if (detailsInputRef.current) {
        detailsInputRef.current.focus();
      }
      return;
    }

    if (!date) {
      setError('Please select a valid scheduler date.');
      return;
    }

    onSubmit({
      id: isEditMode ? task.id : undefined,
      code,
      date,
      time,
      details: details.trim(),
      status,
      durationDays,
      parentTaskId: task.parentTaskId,
    });

    onClose();
  };

  const handleDelete = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    if (onDelete && task.id) {
      onDelete(task.id);
      onClose();
    }
  };

  const activeDept = departments.find((d) => d.code === code) || departments[0] || { color: '#4f46e5' };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop overlay filter */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs"
        />

        {/* Floating dialog content body */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-10 flex flex-col"
        >
          {/* Header Banner */}
          <div className="px-6 py-4 border-b border-slate-150 flex items-center justify-between bg-slate-50">
            <div className="flex items-center gap-2">
              <div 
                className="w-3.5 h-3.5 rounded-full flex-shrink-0" 
                style={{ backgroundColor: activeDept.color }}
              />
              <h3 className="text-sm font-bold text-slate-800 tracking-tight uppercase flex items-center gap-2">
                <Layers className="w-4.5 h-4.5 text-indigo-600" />
                {isEditMode ? 'Modify' : 'Create'} {task.parentTaskId ? 'Subtask' : 'Scheduled Task'}
              </h3>
            </div>
            
            <button
              onClick={onClose}
              className="p-1 px-1.5 hover:bg-slate-200/80 rounded-lg text-slate-400 hover:text-slate-700 transition-all cursor-pointer"
              title="Close window without saving"
            >
              <X className="w-4.5 h-4.5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-5 flex-grow overflow-y-auto max-h-[80vh]">
            {/* 1. Department tag list picker */}
            <div className="space-y-2">
              <label className="block text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
                Department Tag / Code
              </label>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5 p-1.5 bg-slate-50 border border-slate-200/60 rounded-xl">
                {departments.map((dept) => {
                  const isSelected = code === dept.code;
                  return (
                    <button
                      key={dept.code}
                      type="button"
                      onClick={() => setCode(dept.code)}
                      style={{
                        backgroundColor: isSelected ? dept.color : 'transparent',
                        color: isSelected ? '#ffffff' : '#334155',
                        borderColor: isSelected ? dept.color : 'transparent',
                      }}
                      className="px-2 py-2 rounded-lg text-xs font-bold uppercase transition-all duration-100 border text-center flex flex-col items-center justify-center gap-1 cursor-pointer select-none"
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: isSelected ? '#ffffff' : dept.color }}
                      />
                      <span className="text-[10px] tracking-wide">{dept.code}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Date, Time, and Duration fields */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
                  Scheduler Date
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full text-xs pl-9 pr-3 py-2.5 border border-slate-300 rounded-lg bg-white font-bold select-all focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-extrabold text-slate-400 uppercase tracking-wider flex justify-between">
                  <span>Start Time</span>
                  <span className="text-[9px] text-slate-400 font-semibold normal-case">Blank = All Day</span>
                </label>
                <div className="relative">
                  <Clock className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full text-xs pl-9 pr-3 py-2.5 border border-slate-300 rounded-lg bg-white font-semibold select-all focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-extrabold text-slate-400 uppercase tracking-wider flex justify-between">
                  <span>Duration (Days)</span>
                  <span className="text-[9px] text-slate-400 font-semibold normal-case">Min: 1</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={1}
                    required
                    value={durationDays}
                    onChange={(e) => setDurationDays(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-full text-xs px-3.5 py-2.5 border border-slate-300 rounded-lg bg-white font-bold select-all focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none font-mono"
                  />
                </div>
              </div>
            </div>

            {/* 3. Task Details Description Input */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
                Task Details & Description
              </label>
              <input
                ref={detailsInputRef}
                type="text"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="e.g. Center stage audio check & cable patch logic"
                className="w-full text-sm px-3.5 py-2.5 border border-slate-300 rounded-lg font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none bg-slate-50/20 focus:bg-white transition-all"
              />
            </div>

            {error && (
              <p className="text-xs text-red-600 font-medium bg-red-50 border border-red-100 px-3 py-2 rounded-lg flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                {error}
              </p>
            )}

            {/* Actions panel */}
            <div className="flex flex-col sm:flex-row gap-2 pt-3 border-t border-slate-100">
              {isEditMode && onDelete && (
                <button
                  type="button"
                  onClick={handleDelete}
                  className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer max-sm:order-3 ${
                    confirmDelete
                      ? 'bg-rose-600 text-white hover:bg-rose-700 animate-pulse'
                      : 'border border-rose-200 text-rose-600 hover:bg-rose-50'
                  }`}
                >
                  <Trash2 className="w-4 h-4" />
                  {confirmDelete ? 'Confirm Permanent Delete' : 'Delete Task'}
                </button>
              )}

              <div className="sm:ml-auto flex gap-2 max-sm:order-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  style={{ backgroundColor: activeDept.color }}
                  className="px-5 py-2 text-xs font-bold text-white rounded-lg hover:brightness-110 shadow-sm transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  {isEditMode ? 'Apply Updates' : 'Add to Grid'}
                </button>
              </div>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
