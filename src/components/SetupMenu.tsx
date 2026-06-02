/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ProjectSettings } from '../types';
import { Calendar, Settings, Check, RefreshCw, Info, Link } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SetupMenuProps {
  settings: ProjectSettings;
  onUpdateSettings: (settings: ProjectSettings) => void;
  onResetToDefault: () => void;
  onCopyShareLink?: () => void;
  activeProjectId?: string;
}

export default function SetupMenu({ settings, onUpdateSettings, onResetToDefault, onCopyShareLink, activeProjectId }: SetupMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [projectName, setProjectName] = useState(settings.projectName);
  const [startDate, setStartDate] = useState(settings.startDate);
  const [endDate, setEndDate] = useState(settings.endDate);
  const [error, setError] = useState<string | null>(null);

  // Sync state if settings prop changes
  React.useEffect(() => {
    setProjectName(settings.projectName);
    setStartDate(settings.startDate);
    setEndDate(settings.endDate);
  }, [settings]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!projectName.trim()) {
      setError('Project Name cannot be empty');
      return;
    }

    if (!startDate || !endDate) {
      setError('Please select both Start and End Dates');
      return;
    }

    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T00:00:00');

    if (end < start) {
      setError('End Date must be on or after Start Date');
      return;
    }

    // Limit range to 45 days for visual performance
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    if (diffDays > 30) {
      setError('The maximum supported range is 30 days due to layout constraints');
      return;
    }

    onUpdateSettings({
      projectName: projectName.trim(),
      startDate,
      endDate,
    });
    setIsOpen(false);
  };

  return (
    <div id="setup-menu-container" className="bg-white border border-slate-200 rounded-xl shadow-sm mb-6 overflow-hidden">
      <div 
        id="setup-menu-header"
        className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-slate-50 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
            <Settings id="settings-icon" className="w-5 h-5" />
          </div>
          <div>
            <h3 id="project-config-title" className="font-semibold text-slate-800 text-sm tracking-tight">
              PROJECT CONFIGURATION & TIMELINE SETUP
            </h3>
            <p id="project-config-stub" className="text-xs text-slate-500 font-medium">
              {settings.projectName} • Track range ({settings.startDate} to {settings.endDate})
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onCopyShareLink && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                id="copy-share-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onCopyShareLink();
                }}
                className="text-[11px] font-bold px-2.5 py-1.5 border border-indigo-200 bg-indigo-50/40 hover:bg-indigo-50 hover:border-indigo-300 text-indigo-700 rounded-lg transition-colors flex items-center gap-1"
                title="Copy view-only share link for clients or staff"
              >
                <Link className="w-3.5 h-3.5" />
                Copy Share Link
              </button>
              <a
                href={`?project=${activeProjectId || ''}&mode=view`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  e.stopPropagation();
                }}
                className="text-[11px] font-bold px-2.5 py-1.5 border border-emerald-200 bg-emerald-50/40 hover:bg-emerald-50 hover:border-emerald-300 text-emerald-700 rounded-lg transition-colors flex items-center gap-1.5"
                title="Open view-only share screen in a new window"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Open Share View
              </a>
            </div>
          )}
          <button 
            id="toggle-setup-btn"
            className="text-xs font-semibold px-3 py-1.5 border border-slate-200 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors"
          >
            {isOpen ? 'Close Settings' : 'Edit Timeline Range'}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-slate-100 bg-slate-50/55"
          >
            <form id="setup-form" onSubmit={handleSubmit} className="p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Project Name */}
                <div className="space-y-1.5">
                  <label htmlFor="projectName" className="block text-xs font-semibold text-slate-700">
                    Project Name
                  </label>
                  <input
                    id="projectName"
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="e.g. Project Star 2026-07-06"
                    className="w-full text-sm px-3.5 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                  />
                </div>

                {/* Start Date */}
                <div className="space-y-1.5">
                  <label htmlFor="startDate" className="block text-xs font-semibold text-slate-700">
                    Timeline Start Date (Day 1)
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
                    <input
                      id="startDate"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full text-sm pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                    />
                  </div>
                </div>

                {/* End Date */}
                <div className="space-y-1.5">
                  <label htmlFor="endDate" className="block text-xs font-semibold text-slate-700">
                    Timeline End Date
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
                    <input
                      id="endDate"
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full text-sm pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                    />
                  </div>
                </div>
              </div>

              {error && (
                <div className="text-xs text-red-600 font-medium bg-red-50 border border-red-200 px-3.5 py-2.5 rounded-lg flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-600 block"></span>
                  {error}
                </div>
              )}

              <div className="flex items-center justify-between border-t border-slate-200/60 pt-4">
                <div className="text-xs text-slate-500 flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <span>The grid displays Day columns matching this date span automatically.</span>
                </div>
                
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={onResetToDefault}
                    className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 hover:bg-slate-100 text-slate-600 rounded-lg text-xs font-semibold transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Revert Defaults
                  </button>
                  <button
                    type="submit"
                    className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-sm"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Apply Changes
                  </button>
                </div>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
