/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Department, Task } from '../types';
import { Filter, Settings, Plus, Trash2, Check, X, Palette } from 'lucide-react';

interface DepartmentFilterProps {
  departments: Department[];
  onUpdateDepartments: (newDepts: Department[]) => void;
  selectedDeptFilter: string;
  onSelectDeptFilter: (code: string) => void;
  tasks: Task[];
  onUpdateTask: (task: Task, shouldSort?: boolean) => void;
}

const PRESET_COLORS = [
  { hex: '#2563eb', name: 'Blue' },
  { hex: '#7c3aed', name: 'Purple' },
  { hex: '#dc2626', name: 'Red' },
  { hex: '#d97706', name: 'Amber' },
  { hex: '#db2777', name: 'Pink' },
  { hex: '#16a34a', name: 'Green' },
  { hex: '#0891b2', name: 'Cyan' },
  { hex: '#4b5563', name: 'Slate' },
  { hex: '#ea580c', name: 'Orange' },
  { hex: '#0d9488', name: 'Teal' },
  { hex: '#0284c7', name: 'Sky' },
  { hex: '#4f46e5', name: 'Indigo' },
  { hex: '#9333ea', name: 'Violet' },
  { hex: '#c026d3', name: 'Fuchsia' },
];

export default function DepartmentFilter({
  departments,
  onUpdateDepartments,
  selectedDeptFilter,
  onSelectDeptFilter,
  tasks,
  onUpdateTask,
}: DepartmentFilterProps) {
  const [isEditing, setIsEditing] = useState(false);
  
  // Tag creation fields
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#2563eb');
  const [error, setError] = useState<string | null>(null);

  const handleAddTag = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const formattedCode = newCode.trim().toUpperCase();
    const formattedName = newName.trim();

    if (!formattedCode) {
      setError('Code is required.');
      return;
    }

    if (formattedCode.length < 2 || formattedCode.length > 5) {
      setError('Code must be 2-5 letters long.');
      return;
    }

    if (departments.some((d) => d.code === formattedCode)) {
      setError(`Tag with code "${formattedCode}" already exists.`);
      return;
    }

    const newDept: Department = {
      code: formattedCode,
      name: formattedName || `${formattedCode} Department`,
      color: newColor,
      textColor: '#ffffff',
    };

    onUpdateDepartments([...departments, newDept]);
    
    // Clear fields
    setNewCode('');
    setNewName('');
    // Pick next preset color
    const nextColorIndex = (departments.length + 1) % PRESET_COLORS.length;
    setNewColor(PRESET_COLORS[nextColorIndex].hex);
  };

  const handleDeleteTag = (codeToDelete: string) => {
    if (departments.length <= 1) {
      setError('You must have at least one department tag.');
      return;
    }

    const remaining = departments.filter((d) => d.code !== codeToDelete);
    const fallbackCode = remaining[0].code;

    // Remove the department
    onUpdateDepartments(remaining);

    // If currently selected filter was the deleted tag, reset filter to 'ALL'
    if (selectedDeptFilter === codeToDelete) {
      onSelectDeptFilter('ALL');
    }

    // Reassign any tasks using this code to the fallback department
    const affectedTasks = tasks.filter((t) => t.code === codeToDelete);
    if (affectedTasks.length > 0) {
      affectedTasks.forEach((task) => {
        onUpdateTask({ ...task, code: fallbackCode }, false);
      });
      // Force an update sort signal on the last one to write to localStorage
      if (affectedTasks.length > 0) {
        onUpdateTask(
          { ...affectedTasks[affectedTasks.length - 1], code: fallbackCode },
          true
        );
      }
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 h-full flex flex-col justify-between min-h-[220px]">
      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 select-none">
            <Filter className="w-3.5 h-3.5 text-indigo-500" />
            {isEditing ? 'Manage Department Tags' : 'Department Focus Filter'}
          </span>

          <button
            onClick={() => {
              setIsEditing(!isEditing);
              setError(null);
            }}
            className={`flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded transition-all cursor-pointer ${
              isEditing
                ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800 border border-slate-200/60'
            }`}
          >
            {isEditing ? (
              <>
                <Check className="w-3.5 h-3.5" />
                Done Editing
              </>
            ) : (
              <>
                <Settings className="w-3.5 h-3.5" />
                Edit Tags
              </>
            )}
          </button>
        </div>

        {/* --- EDIT MODE --- */}
        {isEditing ? (
          <div className="space-y-4 animate-fade-in">
            {/* Existing tags editor list */}
            <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
              <span className="block text-[10px] font-bold text-slate-400 uppercase">Active Tags</span>
              <div className="flex flex-wrap gap-1.5">
                {departments.map((dept) => {
                  const usageCount = tasks.filter((t) => t.code === dept.code).length;
                  return (
                    <div
                      key={dept.code}
                      className="inline-flex items-center gap-1.5 pl-2 pr-1.5 py-1 rounded-lg text-xs font-bold border"
                      style={{
                        backgroundColor: `${dept.color}15`,
                        borderColor: dept.color,
                        color: dept.color,
                      }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: dept.color }}></span>
                      <span>{dept.code}</span>
                      <span className="text-[9px] opacity-70 font-normal">({usageCount} tasks)</span>
                      
                      <button
                        onClick={() => handleDeleteTag(dept.code)}
                        className="p-0.5 hover:bg-white/80 hover:text-rose-600 rounded cursor-pointer transition-colors"
                        title={
                          usageCount > 0
                            ? `Delete tag (Will reassign ${usageCount} active tasks)`
                            : "Delete department tag"
                        }
                      >
                        <Trash2 className="w-3 h-3 text-slate-400 hover:text-rose-600" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* In-Line Tag Addition Form */}
            <form onSubmit={handleAddTag} className="border-t border-slate-100 pt-3 space-y-2">
              <span className="block text-[10px] font-bold text-slate-400 uppercase">Create New Tag</span>
              
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="text"
                  maxLength={5}
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                  placeholder="e.g. PR"
                  className="px-2 py-1.5 text-xs font-bold border border-slate-300 rounded focus:ring-1 focus:ring-indigo-500 outline-none uppercase"
                  title="Tag abbreviation code (2-5 characters, uppercase)"
                />
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Tag Name (e.g. Rigging)"
                  className="col-span-2 px-2 py-1.5 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-indigo-500 outline-none"
                />
              </div>

              {/* Color swatch picker */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
                  <span className="flex items-center gap-1">
                    <Palette className="w-3 h-3" />
                    Accent Color Accent
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full border border-slate-200" style={{ backgroundColor: newColor }} />
                    <input
                      type="color"
                      value={newColor}
                      onChange={(e) => setNewColor(e.target.value)}
                      className="w-4 h-4 opacity-0 absolute cursor-pointer"
                      title="Custom Color Pick"
                    />
                    <span className="text-[9px] text-slate-400 hover:text-slate-600 cursor-pointer underline">Custom Picker</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1 max-h-[50px] overflow-y-auto p-1 bg-slate-50 border border-slate-100 rounded">
                  {PRESET_COLORS.map((preset) => {
                    const isSelected = newColor === preset.hex;
                    return (
                      <button
                        key={preset.hex}
                        type="button"
                        onClick={() => setNewColor(preset.hex)}
                        title={preset.name}
                        className={`w-4 h-4 rounded-full border cursor-pointer hover:scale-110 active:scale-95 transition-transform flex items-center justify-center ${
                          isSelected ? 'border-indigo-600 scale-105' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: preset.hex }}
                      >
                        {isSelected && <Check className="w-2.5 h-2.5 text-white stroke-[3px]" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {error && (
                <p className="text-[10px] bg-rose-50 border border-rose-100 text-rose-700 px-2.5 py-1 rounded font-semibold">
                  {error}
                </p>
              )}

              <button
                type="submit"
                className="w-full bg-slate-950 text-white rounded text-xs font-bold py-1.5 hover:bg-slate-800 active:scale-98 transition-all cursor-pointer flex items-center justify-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Dynamic Tag
              </button>
            </form>
          </div>
        ) : (
          /* --- FILTER MODE (STANDARD) --- */
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 animate-fade-in">
            <button
              onClick={() => onSelectDeptFilter('ALL')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all text-center border cursor-pointer select-none ${
                selectedDeptFilter === 'ALL'
                  ? 'bg-slate-900 border-slate-900 text-white'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-100 bg-slate-50'
              }`}
            >
              ALL DEPTS
            </button>
            {departments.map((dept) => {
              const isSelected = selectedDeptFilter === dept.code;
              return (
                <button
                  key={dept.code}
                  onClick={() => onSelectDeptFilter(dept.code)}
                  className="px-2 py-1.5 rounded-lg text-xs font-bold transition-all border text-center flex items-center justify-center gap-1 cursor-pointer select-none"
                  style={{
                    backgroundColor: isSelected ? dept.color : '#f8fafc',
                    color: isSelected ? '#ffffff' : '#475569',
                    borderColor: isSelected ? dept.color : '#e2e8f0',
                  }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: isSelected ? '#ffffff' : dept.color }}
                  ></span>
                  {dept.code}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="border-t border-slate-100 pt-3 mt-3 text-[11px] text-slate-400 font-medium select-none">
        {isEditing
          ? 'Add new custom production tags, or click Trash to remove tags.'
          : 'Filter the active schedule grid by clicking any department tag.'}
      </div>
    </div>
  );
}
