/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Task, Department, ProjectSettings, TaskStatus } from './types';
import { 
  DEFAULT_DEPARTMENTS, 
  sortTasks, 
  generateDateRange 
} from './utils';
import SetupMenu from './components/SetupMenu';
import TaskForm from './components/TaskForm';
import BulkImport from './components/BulkImport';
import UnifiedTimeline from './components/UnifiedTimeline';
import DepartmentFilter from './components/DepartmentFilter';
import TaskEditModal from './components/TaskEditModal';
import { 
  Layers, 
  Filter, 
  PlusCircle, 
  HelpCircle, 
  Download, 
  Upload, 
  Settings,
  Calendar,
  Sparkles,
  RotateCcw
} from 'lucide-react';

const LOCAL_STORAGE_KEY_TASKS = 'master_scheduler_tasks_v1';
const LOCAL_STORAGE_KEY_SETTINGS = 'master_scheduler_settings_v1';
const LOCAL_STORAGE_KEY_DEPARTMENTS = 'master_scheduler_departments_v1';

const DEFAULT_SETTINGS: ProjectSettings = {
  projectName: 'Project Star 2026-07-06',
  startDate: '2026-07-06',
  endDate: '2026-07-10',
};

const INITIAL_TASKS: Task[] = [
  {
    id: 'task-1',
    code: 'LOG',
    date: '2026-07-06',
    time: '06:30',
    details: 'truck 2',
    status: 'Not Started',
  },
  {
    id: 'task-2',
    code: 'LX',
    date: '2026-06-12',
    time: '06:30',
    details: '06:30 - Pre-rig truss hoist motors inspection',
    status: 'Not Started',
  },
  {
    id: 'task-3',
    code: 'LX',
    date: '2026-06-12',
    time: '14:00',
    details: '14:00 - Motor hang and structural safety point lock',
    status: 'Not Started',
  },
  {
    id: 'task-4',
    code: 'AV',
    date: '2026-06-12',
    time: '19:15',
    details: '19:15 - Night line-array power loom runs',
    status: 'Not Started',
  },
  {
    id: 'task-5',
    code: 'STG',
    date: '2026-06-13',
    time: '09:00',
    details: '09:00 - Scenic deck framing assemble',
    status: 'Not Started',
  },
  {
    id: 'task-6',
    code: 'AV',
    date: '2026-06-13',
    time: '06:30',
    details: '13:00 - FOH audio console positioning & sound check',
    status: 'In Progress',
  },
  {
    id: 'task-7',
    code: 'MKT',
    date: '2026-06-13',
    time: '', // Blank = All Day
    details: 'ALL DAY: Venue exterior graphic wraps install',
    status: 'Not Started',
  },
  {
    id: 'task-8',
    code: 'LX',
    date: '2026-06-14',
    time: '10:30',
    details: '10:30 - Profiles circuit check and dimming patch',
    status: 'In Progress',
  },
  {
    id: 'task-9',
    code: 'OPS',
    date: '2026-06-14',
    time: '15:00',
    details: '15:00 - Security briefing and usher perimeter maps',
    status: 'Not Started',
  },
  {
    id: 'task-10',
    code: 'STG',
    date: '2026-06-14',
    time: '20:00',
    details: '20:00 - Dark rehearsal stage look design lock',
    status: 'Not Started',
  },
  {
    id: 'task-11',
    code: 'LOG',
    date: '2026-06-15',
    time: '23:30',
    details: '23:30 - Midnight catering delivery window check',
    status: 'Completed',
  }
];

export default function App() {
  const isReadOnly = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('mode') === 'view' : false;
  
  const [tasks, setTasks] = useState<Task[]>([]);
  const [departments, setDepartments] = useState<Department[]>(DEFAULT_DEPARTMENTS);
  const [settings, setSettings] = useState<ProjectSettings>(DEFAULT_SETTINGS);
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>('ALL');
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  const [changesToday, setChangesToday] = useState<any[]>([]);

  const fetchChangesToday = async () => {
    try {
      const res = await fetch('/api/changes');
      if (res.ok) {
        const data = await res.json();
        setChangesToday(data);
      }
    } catch (e) {
      console.warn('Backend changes API offline', e);
    }
  };

  // Sync data dynamically from the backend server first, with localStorage as safe offline fallback
  useEffect(() => {
    const initData = async () => {
      // 1. Fetch tasks list from Express database server
      try {
        const res = await fetch('/api/tasks');
        if (res.ok) {
          const data = await res.json();
          setTasks(data);
          localStorage.setItem(LOCAL_STORAGE_KEY_TASKS, JSON.stringify(data));
        } else {
          loadTasksFromLocal();
        }
      } catch (e) {
        console.warn('Backend server unreached. Continuing in sandbox localStorage mode.', e);
        loadTasksFromLocal();
      }

      // 2. Load settings and departments from local preferences
      const storedSettings = localStorage.getItem(LOCAL_STORAGE_KEY_SETTINGS);
      if (storedSettings) {
        try {
          setSettings(JSON.parse(storedSettings));
        } catch (e) {
          setSettings(DEFAULT_SETTINGS);
        }
      }

      const storedDepts = localStorage.getItem(LOCAL_STORAGE_KEY_DEPARTMENTS);
      if (storedDepts) {
        try {
          setDepartments(JSON.parse(storedDepts));
        } catch (e) {
          setDepartments(DEFAULT_DEPARTMENTS);
        }
      }

      // 3. Load daily change log history from backend
      fetchChangesToday();
    };

    const loadTasksFromLocal = () => {
      const storedTasks = localStorage.getItem(LOCAL_STORAGE_KEY_TASKS);
      if (storedTasks) {
        try {
          setTasks(JSON.parse(storedTasks));
        } catch (e) {
          setTasks(INITIAL_TASKS);
        }
      } else {
        setTasks(INITIAL_TASKS);
      }
    };

    initData();
  }, []);

  // Show transition notifications
  const showToast = (message: string, type: 'success' | 'info' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 3500);
  };

  const [confirmReset, setConfirmReset] = useState(false);

  // Safe task saver with async full-stack API writing
  const saveTasks = async (newTasks: Task[], sortImmediately = true) => {
    const sorted = sortImmediately ? sortTasks(newTasks) : newTasks;
    setTasks(sorted);
    localStorage.setItem(LOCAL_STORAGE_KEY_TASKS, JSON.stringify(sorted));

    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sorted),
      });
      if (res.ok) {
        // Automatically sync the modified change list feed in UI
        fetchChangesToday();
      }
    } catch (e) {
      console.warn('Failed to commit tasks to persistent server', e);
    }
  };

  // Safe settings saver
  const saveSettings = (newSettings: ProjectSettings) => {
    setSettings(newSettings);
    localStorage.setItem(LOCAL_STORAGE_KEY_SETTINGS, JSON.stringify(newSettings));
    showToast('Project configuration settings updated successfully', 'success');
  };

  // Safe departments (tags) updated
  const handleUpdateDepartments = (updatedDepts: Department[]) => {
    setDepartments(updatedDepts);
    localStorage.setItem(LOCAL_STORAGE_KEY_DEPARTMENTS, JSON.stringify(updatedDepts));
  };

  // Handles daily logs wipe
  const handleClearChangesHistory = async () => {
    try {
      await fetch('/api/changes/reset', { method: 'POST' });
      fetchChangesToday();
      showToast('Recorded modifications cleared for today.', 'success');
    } catch {
      showToast('Wipe command aborted.', 'info');
    }
  };

  // Helper to recursively update a task object in the hierarchical list
  const updateTaskInList = (list: any[], id: string, updatedFields: any): any[] => {
    return list.map(item => {
      if (item.id === id) {
        return { ...item, ...updatedFields };
      }
      if (item.subtasks && item.subtasks.length > 0) {
        return {
          ...item,
          subtasks: updateTaskInList(item.subtasks, id, updatedFields)
        };
      }
      return item;
    });
  };

  // Helper to recursively delete a task from the hierarchical list
  const deleteTaskFromList = (list: any[], id: string): any[] => {
    return list
      .filter(item => item.id !== id)
      .map(item => {
        if (item.subtasks && item.subtasks.length > 0) {
          return {
            ...item,
            subtasks: deleteTaskFromList(item.subtasks, id)
          };
        }
        return item;
      });
  };

  // Helper to recursively append a subtask to the matching parent ID
  const appendSubtaskInList = (list: any[], parentId: string, newSubtask: any): any[] => {
    return list.map(item => {
      if (item.id === parentId) {
        return {
          ...item,
          subtasks: [...(item.subtasks || []), newSubtask]
        };
      }
      if (item.subtasks && item.subtasks.length > 0) {
        return {
          ...item,
          subtasks: appendSubtaskInList(item.subtasks, parentId, newSubtask)
        };
      }
      return item;
    });
  };

  // Handle direct inline task modifications directly in the timeline
  const handleUpdateTask = (updatedTask: Task, shouldSort = true) => {
    const updatedTasks = updateTaskInList(tasks, updatedTask.id, updatedTask);
    saveTasks(updatedTasks, shouldSort);
    if (shouldSort) {
      showToast('Timeline updated & sorted', 'success');
    }
  };

  // Handle addition or saving of edits
  const handleFormSubmit = (taskData: Omit<Task, 'id'> & { id?: string; durationDays?: number; parentTaskId?: string }) => {
    if (taskData.id) {
      // Edit mode
      const updatedTasks = updateTaskInList(tasks, taskData.id, taskData);
      saveTasks(updatedTasks, true);
      setEditingTask(null);
      showToast('Task details modified and auto-sorted', 'success');
    } else if (taskData.parentTaskId) {
      // Create nested subtask mode!
      const newSubtask: Omit<Task, 'code' | 'date'> & { id: string } = {
        id: `subtask-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        time: taskData.time,
        details: taskData.details,
        status: taskData.status,
        durationDays: taskData.durationDays || 1,
      };

      const updatedTasks = appendSubtaskInList(tasks, taskData.parentTaskId, newSubtask);
      saveTasks(updatedTasks, true);
      setEditingTask(null);
      showToast('Nested subtask created successfully!', 'success');
    } else {
      // Create mode
      const newTask: Task = {
        id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        code: taskData.code,
        date: taskData.date,
        time: taskData.time,
        details: taskData.details,
        status: taskData.status,
        durationDays: taskData.durationDays || 1,
        subtasks: [],
      };
      saveTasks([...tasks, newTask], true);
      showToast('Task added! Timeline automatically updated & sorted', 'success');
    }
  };

  // Handle Gemini bulk load import lists
  const handleBulkImport = (importedTasks: Task[]) => {
    saveTasks([...tasks, ...importedTasks], true);
  };

  const handleDeleteTask = (id: string) => {
    const filtered = deleteTaskFromList(tasks, id);
    saveTasks(filtered, true);
    showToast('Task deleted from timeline', 'info');
    if (editingTask?.id === id) {
      setEditingTask(null);
    }
  };

  // Quick cell click directly calendars a task matching the timeline slot
  const handleQuickAddAtSlot = (date: string, timeSlot: 'Early' | 'Mid' | 'Evening') => {
    // Map time strings based on general slot standards
    let targetTime = '';
    if (timeSlot === 'Early') targetTime = '08:30';
    else if (timeSlot === 'Mid') targetTime = '14:00';
    else if (timeSlot === 'Evening') targetTime = '19:30';

    // Focus the task form and prefill values
    const newTaskDraft: Omit<Task, 'id'> = {
      code: selectedDeptFilter !== 'ALL' ? selectedDeptFilter : 'LOG',
      date,
      time: targetTime,
      details: `Quick ${selectedDeptFilter !== 'ALL' ? selectedDeptFilter : 'New'} Event Task`,
      status: 'Not Started',
    };

    // Trigger full edit draft
    setEditingTask({ id: '', ...newTaskDraft });
    showToast(`Drafting task for ${date} at [${timeSlot} Slot]. Edit details below.`, 'info');

    // Auto-scroll to the entry form
    const formEl = document.getElementById('task-form-container');
    if (formEl) {
      formEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleResetToDefault = () => {
    if (!confirmReset) {
      setConfirmReset(true);
      showToast('🚨 Click "Reset" once more to wipe all changes and restore original spreadsheet demo.', 'info');
      setTimeout(() => setConfirmReset(false), 5000);
      return;
    }
    setConfirmReset(false);
    setSettings(DEFAULT_SETTINGS);
    localStorage.setItem(LOCAL_STORAGE_KEY_SETTINGS, JSON.stringify(DEFAULT_SETTINGS));
    setDepartments(DEFAULT_DEPARTMENTS);
    localStorage.setItem(LOCAL_STORAGE_KEY_DEPARTMENTS, JSON.stringify(DEFAULT_DEPARTMENTS));
    saveTasks(INITIAL_TASKS, true);
    setEditingTask(null);
    setSelectedDeptFilter('ALL');
    showToast('Reverted schedule to official demo dataset', 'info');
  };

  return (
    <div className="min-h-screen bg-slate-100/50 text-slate-800 antialiased font-sans flex flex-col pb-16">
      
      {/* Read-Only mode banner */}
      {isReadOnly && (
        <div className="bg-gradient-to-r from-indigo-700 to-indigo-800 text-white font-extrabold text-[11px] uppercase tracking-widest text-center py-2 px-6 shadow-xs flex items-center justify-center gap-2 select-none">
          <span className="flex items-center gap-1.5 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            Staging Operations Live Monitor Active
          </span>
          <span className="text-indigo-200 font-medium">•</span>
          <a href="?" className="underline hover:text-indigo-100 font-bold tracking-normal transition-colors">
            Switch back to Scheduling Editor
          </a>
        </div>
      )}

      {/* Dynamic Toast System */}
      {notification && (
        <div 
          id="global-toast-flag" 
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-lg shadow-lg border text-xs font-semibold animate-bounce ${
            notification.type === 'success' 
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
              : 'bg-indigo-50 text-indigo-800 border-indigo-200'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${notification.type === 'success' ? 'bg-emerald-500' : 'bg-indigo-500'}`}></span>
          {notification.message}
        </div>
      )}



      {/* Controller Toolbar & Workspace Containers */}
      <main className="max-w-[1700px] mx-auto px-4 md:px-6 mt-6 w-full flex-grow flex flex-col gap-6">
        
        {/* Row 1: Configurations & Filters */}
        {isReadOnly ? (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
            {/* Staging Monitor Info Card */}
            <div className="lg:col-span-3 bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col justify-center min-h-[142px]">
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                {settings.projectName}
                <span className="text-[9px] bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded text-indigo-700 font-extrabold uppercase tracking-widest leading-none">
                  Live View-Only Feed
                </span>
              </h2>
              <p className="text-xs text-slate-505 font-medium mt-1.5 max-w-xl">
                Active Staging & Equipment Rigging grid. Tracking from {settings.startDate} through {settings.endDate}. Clicking, dragging, and edits have been disabled for security.
              </p>
              <div className="flex items-center gap-2 mt-4 text-[11px] font-bold text-slate-400">
                <Calendar className="w-4 h-4 text-indigo-500" />
                <span>Production Horizon Span: {settings.startDate} ➜ {settings.endDate}</span>
              </div>
            </div>

            {/* Read-Only Filters Column */}
            <div className="lg:col-span-1">
              <DepartmentFilter
                departments={departments}
                onUpdateDepartments={handleUpdateDepartments}
                selectedDeptFilter={selectedDeptFilter}
                onSelectDeptFilter={setSelectedDeptFilter}
                tasks={tasks}
                onUpdateTask={handleUpdateTask}
                isReadOnly={true}
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-start">
            
            {/* Setup Menu Card Column */}
            <div className="xl:col-span-2 shadow-xs">
              <SetupMenu 
                settings={settings} 
                onUpdateSettings={saveSettings} 
                onResetToDefault={handleResetToDefault}
                onCopyShareLink={() => {
                  const url = `${window.location.origin}${window.location.pathname}?mode=view`;
                  navigator.clipboard.writeText(url);
                  showToast('🔗 Shareable View-Only link copied to clipboard!', 'success');
                }}
              />
            </div>

            {/* Department Selection Filter Menu Card Column */}
            <div className="xl:col-span-1 shadow-xs">
              <DepartmentFilter
                departments={departments}
                onUpdateDepartments={handleUpdateDepartments}
                selectedDeptFilter={selectedDeptFilter}
                onSelectDeptFilter={setSelectedDeptFilter}
                tasks={tasks}
                onUpdateTask={handleUpdateTask}
              />
            </div>

            {/* Operations Daily Logger Controller */}
            <div className="xl:col-span-1 shadow-xs">
              <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between min-h-[162px] h-full">
                <div>
                  <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-slate-100">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 select-none">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                      Operational Logger
                    </span>
                    <span className="text-[8.5px] font-black px-1.5 py-0.5 rounded bg-indigo-50 border border-indigo-150 text-indigo-700 uppercase">
                      Active Buffer
                    </span>
                  </div>

                  <div className="space-y-2 mt-2">
                    <div className="flex justify-between items-center bg-slate-50 border border-slate-100 p-2 rounded-lg">
                      <span className="text-[11px] text-slate-500 font-bold">Logged Changes Today:</span>
                      <span className="text-[11px] font-black px-2 py-0.5 bg-indigo-100 text-indigo-750 rounded-full">
                        {changesToday.length}
                      </span>
                    </div>

                    {changesToday.length > 0 ? (
                      <div className="max-h-[105px] overflow-y-auto pr-1 space-y-1.5 text-[9.5px]">
                        {changesToday.slice(-4).map((c, i) => (
                          <div key={i} className="border-l-2 pl-1.5 py-0.5" style={{ borderColor: c.type === 'Add' ? '#10b981' : c.type === 'Update' ? '#f59e0b' : '#ef4444' }}>
                            <span className="font-extrabold text-slate-700">[{c.type}]</span> <span className="text-slate-500">{c.description}</span>
                          </div>
                        ))}
                        {changesToday.length > 4 && (
                          <div className="text-[8.5px] text-slate-400 font-bold tracking-tight text-right pr-1">
                            + {changesToday.length - 4} more logs history
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-[10px] text-slate-400 leading-relaxed font-semibold">
                        No modifications written to logs yet. Add, edit or delete tasks to record actions.
                      </p>
                    )}
                  </div>
                </div>

                {changesToday.length > 0 && (
                  <div className="mt-3 pt-2.5 border-t border-slate-100">
                    <button
                      onClick={handleClearChangesHistory}
                      className="w-full text-[10.5px] font-extrabold py-2 bg-slate-50 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 text-slate-550 hover:text-rose-600 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      Wipe Recorded Logs
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Row 2: Left Input Form & Main Interactive Spreadsheet Timeline */}
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-start">
          
          {/* Form Task Addition - Side Box */}
          {!isReadOnly && (
            <div className="xl:col-span-1 space-y-4">
              <TaskForm 
                departments={departments}
                onSubmit={handleFormSubmit}
                editingTask={editingTask}
                onCancelEdit={() => setEditingTask(null)}
                defaultDate={settings.startDate}
              />

              <BulkImport 
                departments={departments}
                onBulkImport={handleBulkImport}
                showToast={showToast}
                defaultDate={settings.startDate}
              />

              {/* Documentation Helper */}
              <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white rounded-xl p-5 shadow-sm space-y-3 border border-indigo-950">
                <h4 className="text-xs font-extrabold tracking-widest text-indigo-300 flex items-center gap-1.5 uppercase">
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  Time-Slot Spreadsheet Help
                </h4>
                <p className="text-[11px] leading-relaxed text-indigo-150 font-medium font-sans">
                  Our responsive staging grid replicates professional live event workflow charts. Tasks are structured sequentially by date and time automatically upon entry.
                </p>
                <ul className="text-[11px] space-y-1.5 text-indigo-200 list-disc list-inside col-span-1">
                  <li>Create prep rows with June/prior dates.</li>
                  <li>Enter active show dates inside the July span.</li>
                  <li>Leave time blank to span ALL DAY slots on the grid.</li>
                  <li>Click any empty grid square to quickly scheduler a task draft.</li>
                </ul>
              </div>
            </div>
          )}

          {/* Master Unified Spreadsheet View - Main View */}
          <div className={isReadOnly ? "xl:col-span-4" : "xl:col-span-3"}>
            <UnifiedTimeline 
              tasks={tasks}
              settings={settings}
              departments={departments}
              onEditTask={setEditingTask}
              onDeleteTask={handleDeleteTask}
              onUpdateTask={handleUpdateTask}
              onQuickAddAtSlot={handleQuickAddAtSlot}
              selectedDeptFilter={selectedDeptFilter}
              showToast={showToast}
              isReadOnly={isReadOnly}
            />
          </div>

        </div>

      </main>

      {/* Floating high-fidelity task editing modal window */}
      <TaskEditModal
        isOpen={editingTask !== null}
        onClose={() => setEditingTask(null)}
        departments={departments}
        task={editingTask}
        onSubmit={handleFormSubmit}
        onDelete={handleDeleteTask}
      />

    </div>
  );
}
