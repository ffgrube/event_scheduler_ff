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
import UnifiedTimeline from './components/UnifiedTimeline';
import DepartmentFilter from './components/DepartmentFilter';
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
  const [tasks, setTasks] = useState<Task[]>([]);
  const [departments, setDepartments] = useState<Department[]>(DEFAULT_DEPARTMENTS);
  const [settings, setSettings] = useState<ProjectSettings>(DEFAULT_SETTINGS);
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>('ALL');
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  // Initialize data from LocalStorage or setup defaults
  useEffect(() => {
    const storedTasks = localStorage.getItem(LOCAL_STORAGE_KEY_TASKS);
    const storedSettings = localStorage.getItem(LOCAL_STORAGE_KEY_SETTINGS);
    const storedDepts = localStorage.getItem(LOCAL_STORAGE_KEY_DEPARTMENTS);

    if (storedTasks) {
      try {
        setTasks(JSON.parse(storedTasks));
      } catch (e) {
        setTasks(INITIAL_TASKS);
      }
    } else {
      setTasks(INITIAL_TASKS);
    }

    if (storedDepts) {
      try {
        setDepartments(JSON.parse(storedDepts));
      } catch (e) {
        setDepartments(DEFAULT_DEPARTMENTS);
      }
    } else {
      setDepartments(DEFAULT_DEPARTMENTS);
    }

    if (storedSettings) {
      try {
        setSettings(JSON.parse(storedSettings));
      } catch (e) {
        setSettings(DEFAULT_SETTINGS);
      }
    } else {
      setSettings(DEFAULT_SETTINGS);
    }
  }, []);

  // Show transition notifications
  const showToast = (message: string, type: 'success' | 'info' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 3500);
  };

  const [confirmReset, setConfirmReset] = useState(false);

  // Safe task saver
  const saveTasks = (newTasks: Task[], sortImmediately = true) => {
    const sorted = sortImmediately ? sortTasks(newTasks) : newTasks;
    setTasks(sorted);
    localStorage.setItem(LOCAL_STORAGE_KEY_TASKS, JSON.stringify(sorted));
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

  // Handle direct inline task modifications directly in the timeline
  const handleUpdateTask = (updatedTask: Task, shouldSort = true) => {
    const updatedTasks = tasks.map(t => t.id === updatedTask.id ? updatedTask : t);
    saveTasks(updatedTasks, shouldSort);
    if (shouldSort) {
      showToast('Timeline updated & sorted', 'success');
    }
  };

  // Handle addition or saving of edits
  const handleFormSubmit = (taskData: Omit<Task, 'id'> & { id?: string }) => {
    if (taskData.id) {
      // Edit mode
      const updatedTasks = tasks.map(t => 
        t.id === taskData.id 
          ? { ...t, ...taskData } as Task 
          : t
      );
      saveTasks(updatedTasks, true);
      setEditingTask(null);
      showToast('Task details modified and auto-sorted', 'success');
    } else {
      // Create mode
      const newTask: Task = {
        id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        code: taskData.code,
        date: taskData.date,
        time: taskData.time,
        details: taskData.details,
        status: taskData.status,
      };
      saveTasks([...tasks, newTask], true);
      showToast('Task added! Timeline automatically updated & sorted', 'success');
    }
  };

  const handleDeleteTask = (id: string) => {
    const filtered = tasks.filter(t => t.id !== id);
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

      {/* Main Top Header Strip */}
      <header className="bg-slate-900 border-b border-slate-800 text-white shadow-md">
        <div className="max-w-[1600px] mx-auto px-6 py-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600 rounded-xl text-white shadow-inner flex-shrink-0">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                Interactive Event Master Scheduler
                <span className="text-[10px] bg-indigo-500/25 border border-indigo-400/40 px-2 py-0.5 rounded text-indigo-300 font-extrabold uppercase tracking-wide">Time-Slot V2</span>
              </h1>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                Dynamic Stage Production grid. Map prep-works, track days/slots, automatically organize task lists.
              </p>
            </div>
          </div>

          {/* Quick instructions / Revert default */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleResetToDefault}
              className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white border border-slate-700 hover:border-slate-500 bg-slate-800 px-3.5 py-2 rounded-lg font-bold transition-all duration-150 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
              Reset Spreadsheet Demo
            </button>
          </div>
        </div>
      </header>

      {/* Controller Toolbar & Workspace Containers */}
      <main className="max-w-[1700px] mx-auto px-4 md:px-6 mt-6 w-full flex-grow flex flex-col gap-6">
        
        {/* Row 1: Configurations & Filters */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          
          {/* Setup Menu Card Column */}
          <div className="lg:col-span-2">
            <SetupMenu 
              settings={settings} 
              onUpdateSettings={saveSettings} 
              onResetToDefault={handleResetToDefault}
            />
          </div>

          {/* Department Selection Filter Menu Card Column */}
          <DepartmentFilter
            departments={departments}
            onUpdateDepartments={handleUpdateDepartments}
            selectedDeptFilter={selectedDeptFilter}
            onSelectDeptFilter={setSelectedDeptFilter}
            tasks={tasks}
            onUpdateTask={handleUpdateTask}
          />

        </div>

        {/* Row 2: Left Input Form & Main Interactive Spreadsheet Timeline */}
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-start">
          
          {/* Form Task Addition - Side Box */}
          <div className="xl:col-span-1 space-y-4">
            <TaskForm 
              departments={departments}
              onSubmit={handleFormSubmit}
              editingTask={editingTask}
              onCancelEdit={() => setEditingTask(null)}
              defaultDate={settings.startDate}
            />

            {/* Documentation Helper */}
            <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white rounded-xl p-5 shadow-sm space-y-3 border border-indigo-950">
              <h4 className="text-xs font-extrabold tracking-widest text-indigo-300 flex items-center gap-1.5 uppercase">
                <Sparkles className="w-4 h-4 text-amber-300" />
                Time-Slot Spreadsheet Help
              </h4>
              <p className="text-[11px] leading-relaxed text-indigo-150 font-medium">
                Our responsive staging grid replicates professional live event workflow charts. Tasks are structured sequentially by date and time automatically upon entry.
              </p>
              <ul className="text-[11px] space-y-1.5 text-indigo-200 list-disc list-inside">
                <li>Create prep rows with June/prior dates.</li>
                <li>Enter active show dates inside the July span.</li>
                <li>Leave time blank to span ALL DAY slots on the grid.</li>
                <li>Click any empty grid square to quickly scheduler a task draft.</li>
              </ul>
            </div>
          </div>

          {/* Master Unified Spreadsheet View - Main View */}
          <div className="xl:col-span-3">
            <UnifiedTimeline 
              tasks={tasks}
              settings={settings}
              departments={departments}
              onEditTask={setEditingTask}
              onDeleteTask={handleDeleteTask}
              onUpdateTask={handleUpdateTask}
              onQuickAddAtSlot={handleQuickAddAtSlot}
              selectedDeptFilter={selectedDeptFilter}
            />
          </div>

        </div>

      </main>
    </div>
  );
}
