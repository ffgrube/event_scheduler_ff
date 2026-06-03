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
  RotateCcw,
  Folder,
  FolderPlus,
  Play,
  ArrowRight,
  Trash2,
  Plus
} from 'lucide-react';

const LOCAL_STORAGE_KEY_TASKS = 'master_scheduler_tasks_v3';
const LOCAL_STORAGE_KEY_SETTINGS = 'master_scheduler_settings_v3';
const LOCAL_STORAGE_KEY_DEPARTMENTS = 'master_scheduler_departments_v3';
const LOCAL_STORAGE_KEY_ACTIVE_PROJECT_ID = 'active_project_id_v3';

const DEFAULT_SETTINGS: ProjectSettings = {
  projectName: 'Project Star 2026-07-06',
  startDate: '2026-07-06',
  endDate: '2026-07-10',
};

const INITIAL_TASKS: Task[] = [];

export default function App() {
  const queryParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const isReadOnly = queryParams ? queryParams.get('mode') === 'view' : false;
  const queryProjectId = queryParams ? queryParams.get('project') : null;
  
  // Dynamic request wrapper
  const appFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    return fetch(input, init);
  };

  const [projects, setProjects] = useState<any[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string>('');
  const [isProjectMenuOpen, setIsProjectMenuOpen] = useState<boolean>(!isReadOnly);
  const [dbStatus, setDbStatus] = useState<{
    connected: boolean;
    configured?: boolean;
    mode: string;
    details: string;
    error?: {
      message: string;
      code?: string;
      details?: string;
      hint?: string;
    } | null;
  }>({
    connected: false,
    mode: 'Checking database connectivity...',
    details: 'Querying operational server status...'
  });

  const checkDbStatus = async () => {
    try {
      const res = await appFetch('/api/db-status');
      if (res.ok) {
        const data = await res.json();
        setDbStatus(data);
      }
    } catch (e) {
      console.warn('Backend database status inquiry offline', e);
    }
  };
  
  const [newProjName, setNewProjName] = useState<string>('');
  const [newProjStart, setNewProjStart] = useState<string>('2026-07-06');
  const [newProjEnd, setNewProjEnd] = useState<string>('2026-07-12');

  const [tasks, setTasks] = useState<Task[]>([]);
  const [departments, setDepartments] = useState<Department[]>(DEFAULT_DEPARTMENTS);
  const [settings, setSettings] = useState<ProjectSettings>(DEFAULT_SETTINGS);
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>('ALL');
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  const [changesToday, setChangesToday] = useState<any[]>([]);

  // Show transition notifications
  const showToast = (message: string, type: 'success' | 'info' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 3500);
  };

  const loadProjectsList = async () => {
    try {
      const res = await appFetch('/api/projects');
      if (res.ok) {
        const data = await res.json();
        setProjects(data);
        
        // Auto-select if stored active ID exists and is valid, or if query param exists
        const queryParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
        const queryProjectId = queryParams ? queryParams.get('project') : null;
        const targetProjectId = (queryProjectId && data.some((p: any) => p.id === queryProjectId))
          ? queryProjectId
          : localStorage.getItem(LOCAL_STORAGE_KEY_ACTIVE_PROJECT_ID);

        if (targetProjectId && data.some((p: any) => p.id === targetProjectId)) {
          if (!activeProjectId) {
            handleSelectProject(targetProjectId);
          }
        } else if (data.length > 0 && !activeProjectId) {
          // Fallback to choose first
          setActiveProjectId(data[0].id);
          if (isReadOnly) {
            handleSelectProject(data[0].id);
          }
        }
      }
    } catch (e) {
      console.warn('Failed to fetch projects metadata from backend', e);
    }
  };

  const handleSelectProject = async (id: string) => {
    try {
      const res = await appFetch(`/api/projects/${id}`);
      if (res.ok) {
        const p = await res.json();
        setActiveProjectId(id);
        localStorage.setItem(LOCAL_STORAGE_KEY_ACTIVE_PROJECT_ID, id);
        
        setSettings(p.settings);
        setDepartments(p.departments);
        setTasks(p.tasks);
        setIsProjectMenuOpen(false);
        showToast(`Loaded live project: "${p.name}"`, 'success');
        
        // Load changes
        fetchChangesToday(id);
      } else {
        showToast('Error retrieving project details', 'info');
      }
    } catch (e) {
      showToast('Offline fallback: could not reach database server', 'info');
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjName.trim()) {
      showToast('Project name cannot be blank!', 'info');
      return;
    }

    const id = newProjName.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || `project-${Date.now()}`;

    // check collision
    if (projects.some(p => p.id === id)) {
      showToast('A project with a similar slug/name already exists.', 'info');
      return;
    }

    const payload = {
      id,
      name: newProjName.trim(),
      settings: {
        projectName: newProjName.trim(),
        startDate: newProjStart,
        endDate: newProjEnd,
        dayNames: {},
        dayNotes: {}
      },
      departments: DEFAULT_DEPARTMENTS,
      tasks: [],
      changesToday: []
    };

    try {
      const res = await appFetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setNewProjName('');
        showToast(`Project "${payload.name}" initialized!`, 'success');
        await loadProjectsList();
        await handleSelectProject(id);
      } else {
        const errData = await res.json().catch(() => ({}));
        showToast(`Could not boot workspace: ${errData.error || res.statusText || 'Server rejected request'}`, 'info');
      }
    } catch (e: any) {
      showToast(`Network error: ${e?.message || 'could not reach database server'}`, 'info');
    }
  };

  const handleDeleteProject = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to permanently delete this project? All associated event lanes will be destroyed.')) {
      return;
    }

    try {
      const res = await appFetch(`/api/projects/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        showToast('Project wiped from database', 'info');
        await loadProjectsList();
        if (activeProjectId === id) {
          setActiveProjectId('');
          setIsProjectMenuOpen(true);
        }
      }
    } catch (e) {
      showToast('Error removing project', 'info');
    }
  };

  const fetchChangesToday = async (pId = activeProjectId) => {
    const targetId = pId || activeProjectId;
    if (!targetId) return;
    try {
      const res = await appFetch(`/api/changes?projectId=${targetId}`);
      if (res.ok) {
        const data = await res.json();
        setChangesToday(data);
      }
    } catch (e) {
      console.warn('Backend changes API offline', e);
    }
  };

  // Sync projects and active on start
  useEffect(() => {
    loadProjectsList();
    checkDbStatus();
  }, []);

  const [confirmReset, setConfirmReset] = useState(false);

  // Safe task saver with async full-stack API writing
  const saveTasks = async (newTasks: Task[], sortImmediately = true) => {
    const sorted = sortImmediately ? sortTasks(newTasks) : newTasks;
    setTasks(sorted);
    localStorage.setItem(LOCAL_STORAGE_KEY_TASKS, JSON.stringify(sorted));

    if (!activeProjectId) return;

    try {
      const res = await appFetch(`/api/tasks?projectId=${activeProjectId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sorted),
      });
      if (res.ok) {
        // Automatically sync the modified change list feed in UI
        fetchChangesToday(activeProjectId);
      }
    } catch (e) {
      console.warn('Failed to commit tasks to persistent server', e);
    }
  };

  // Safe settings saver
  const saveSettings = async (newSettings: ProjectSettings) => {
    setSettings(newSettings);
    localStorage.setItem(LOCAL_STORAGE_KEY_SETTINGS, JSON.stringify(newSettings));
    
    if (activeProjectId) {
      try {
        const res = await appFetch(`/api/projects/${activeProjectId}`);
        if (res.ok) {
          const p = await res.json();
          p.settings = newSettings;
          p.name = newSettings.projectName;
          
          await appFetch('/api/projects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(p)
          });
          showToast('Project configuration settings updated', 'success');
          loadProjectsList();
        }
      } catch (e) {
        console.warn('Failed to save project settings to server', e);
      }
    }
  };

  // Safe departments (tags) updated
  const handleUpdateDepartments = async (updatedDepts: Department[]) => {
    setDepartments(updatedDepts);
    localStorage.setItem(LOCAL_STORAGE_KEY_DEPARTMENTS, JSON.stringify(updatedDepts));

    if (activeProjectId) {
      try {
        const res = await appFetch(`/api/projects/${activeProjectId}`);
        if (res.ok) {
          const p = await res.json();
          p.departments = updatedDepts;
          
          await appFetch('/api/projects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(p)
          });
          loadProjectsList();
        }
      } catch (e) {
        console.warn('Failed to sync departments to server', e);
      }
    }
  };

  // Handles daily logs wipe
  const handleClearChangesHistory = async () => {
    if (!activeProjectId) return;
    try {
      await appFetch(`/api/changes/reset?projectId=${activeProjectId}`, { method: 'POST' });
      fetchChangesToday(activeProjectId);
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
    <div className="min-h-screen bg-slate-150/40 text-slate-800 antialiased font-sans flex flex-col pb-16">
      
      {/* Read-Only mode banner */}
      {isReadOnly && (
        <div className="bg-gradient-to-r from-indigo-700 to-indigo-800 text-white font-extrabold text-[11px] uppercase tracking-widest text-center py-2 px-6 shadow-xs flex items-center justify-center gap-2 select-none">
          <span className="flex items-center gap-1.5 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            Staging Operations Live Monitor Active (Read-Only Mode)
          </span>
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

      {/* Top Header Navigation Strip */}
      <header className="bg-slate-900 text-slate-100 py-4 px-6 border-b border-slate-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Layers className="w-6 h-6 text-indigo-400 animate-spin-slow" />
          <div>
            <h1 className="text-sm font-black tracking-widest uppercase text-white flex items-center gap-2">
              FF - TIMELINE PLAYGROUND
              <span className="text-[9px] font-extrabold bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-500/30">
                v2.1
              </span>
            </h1>
            <p className="text-[11px] text-slate-400 font-medium leading-none">
              Rigging, Staging & Event Schedule Matrix Architect
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          {activeProjectId && (
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-slate-850 border border-slate-800 rounded-lg text-xs font-medium text-slate-300">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              <span>Active Workspace:</span>
              <strong className="text-white">{settings.projectName}</strong>
            </div>
          )}

          {!isReadOnly && (
            <button
              onClick={() => setIsProjectMenuOpen(!isProjectMenuOpen)}
              className={`flex items-center gap-2 text-xs font-extrabold px-3.5 py-2 rounded-lg border transition-all ${
                isProjectMenuOpen 
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-500/50 shadow-sm shadow-indigo-600/10' 
                  : 'bg-slate-800 hover:bg-slate-755 text-slate-100 border-slate-700'
              }`}
            >
              <Folder className="w-4 h-4 text-indigo-300" />
              {isProjectMenuOpen ? 'View Staging Matrix' : '📂 Switch Project Menu'}
            </button>
          )}
        </div>
      </header>

      {isProjectMenuOpen ? (
        /* ==================== MAIN PROJECTS SELECTION MENU ==================== */
        <main className="max-w-[1300px] mx-auto px-4 md:px-6 py-12 w-full flex-grow flex flex-col gap-10">
          
          <div className="text-center space-y-2">
            <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight font-sans">
              MAIN WORKSPACE DIRECTORY
            </h2>
            <p className="text-sm text-slate-550 max-w-xl mx-auto font-medium leading-relaxed">
              Initialize, configure, or load custom multidevice time-slot production schedules. Each project acts as a completely isolated staging database.
            </p>
            <div className="w-16 h-1 bg-indigo-600 mx-auto rounded-full mt-4"></div>
          </div>

          {/* Database Synchronization Status Ribbon */}
          <div className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm transition-all text-xs ${
            dbStatus.connected 
              ? 'bg-emerald-50 border-emerald-200 text-emerald-950' 
              : dbStatus.error 
                ? 'bg-rose-50 border-rose-200 text-rose-950'
                : 'bg-slate-50 border-slate-200 text-slate-800'
          }`}>
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-lg mt-0.5 ${
                dbStatus.connected 
                  ? 'bg-emerald-100 text-emerald-700' 
                  : dbStatus.error
                    ? 'bg-rose-100 text-rose-700'
                    : 'bg-slate-200 text-slate-600'
              }`}>
                <div className="relative flex h-2.5 w-2.5">
                  {dbStatus.connected && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  )}
                  <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                    dbStatus.connected 
                      ? 'bg-emerald-500' 
                      : dbStatus.error 
                        ? 'bg-rose-500' 
                        : 'bg-slate-400'
                  }`}></span>
                </div>
              </div>
              <div className="space-y-1">
                <h4 className="font-extrabold uppercase tracking-wide text-[10px] mb-0.5 flex items-center gap-1.5">
                  Database Link Status: <strong className="underline">{dbStatus.mode}</strong>
                </h4>
                <p className="font-medium opacity-90 leading-relaxed max-w-[800px]">
                  {dbStatus.details}
                </p>
                {dbStatus.error && (
                  <div className="mt-2.5 p-3 bg-white/80 backdrop-blur-xs border border-rose-150 rounded-lg text-[11px] font-mono whitespace-pre-wrap select-text text-rose-850 shadow-inner max-w-[850px] space-y-1">
                    <div className="font-bold text-rose-900 border-b border-rose-100/60 pb-1 mb-1">
                      ⚠️ Active Query / Schema Error:
                    </div>
                    <div><b className="text-rose-900">Message:</b> {dbStatus.error.message}</div>
                    {dbStatus.error.code && <div><b className="text-rose-900">Code:</b> {dbStatus.error.code}</div>}
                    {dbStatus.error.hint && <div><b className="text-rose-900">Hint:</b> {dbStatus.error.hint}</div>}
                    {dbStatus.error.details && <div><b className="text-rose-900">Details:</b> {dbStatus.error.details}</div>}
                  </div>
                )}
              </div>
            </div>
            
            {!dbStatus.connected && (
              <div className="flex-shrink-0">
                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border rounded text-[10px] font-extrabold ${
                  dbStatus.error ? 'border-rose-200 text-rose-600' : 'border-slate-200 text-slate-600'
                }`}>
                  <span>{dbStatus.error ? "Supabase Sync Failure" : "Supabase Sync Offline"}</span>
                </div>
              </div>
            )}
          </div>



          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            
            {/* Column 1 & 2: Project Cards Directory */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between font-black text-xs uppercase text-slate-400 tracking-widest pb-2 border-b border-slate-200">
                <span>Production Project Directory ({projects.length})</span>
                <span>Select to open</span>
              </div>

              {projects.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-4 shadow-xs">
                  <Folder className="w-12 h-12 text-indigo-400 mx-auto animate-pulse" />
                  <div>
                    <h4 className="text-base font-black text-slate-900 uppercase">Registry Empty</h4>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto font-medium">
                      Configure your first event workspace parameters on the right to start scheduling devices, lines and operations.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {projects.map((proj) => {
                    const isActive = proj.id === activeProjectId;
                    return (
                      <div
                        key={proj.id}
                        onClick={() => handleSelectProject(proj.id)}
                        className={`group relative bg-white border rounded-xl p-5 shadow-xs transition-all hover:shadow-md hover:border-indigo-500 cursor-pointer flex flex-col justify-between min-h-[170px] ${
                          isActive ? 'ring-2 ring-indigo-600 border-transparent bg-indigo-50/5' : 'border-slate-200/90'
                        }`}
                      >
                        <div>
                          {/* Active Pill Badge */}
                          <div className="flex items-center justify-between gap-2 mb-2.5">
                            <span className="text-[10px] font-black uppercase text-indigo-600 bg-indigo-50 border border-indigo-150 px-2 py-0.5 rounded">
                              ID: {proj.id}
                            </span>
                            {isActive && (
                              <span className="text-[9px] font-extrabold px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-250 rounded-full flex items-center gap-1 shadow-2xs">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                Loaded Focus
                              </span>
                            )}
                          </div>

                          <h3 className="font-extrabold text-slate-900 group-hover:text-indigo-600 transition-colors text-base leading-tight">
                            {proj.name}
                          </h3>

                          <div className="flex items-center gap-1 text-[11px] font-medium text-slate-400 mt-2">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            <span>{proj.settings?.startDate} ➜ {proj.settings?.endDate}</span>
                          </div>
                        </div>

                        <div className="mt-4 pt-3.5 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-500/90">
                          <div className="flex items-center gap-3">
                            <span className="flex items-center gap-1">
                              <Layers className="w-3.5 h-3.5 text-indigo-500" />
                              <strong className="text-slate-800">{proj.tasksCount || 0}</strong> tasks
                            </span>
                            <span className="text-slate-200 font-normal">•</span>
                            <span className="text-[10.5px]">
                              <strong className="text-slate-800">{proj.departmentsCount || 0}</strong> tags
                            </span>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => handleDeleteProject(proj.id, e)}
                              className="p-1 px-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50/40 rounded transition-all cursor-pointer"
                              title="Permenently wipe project database"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                            <span className="text-slate-300 font-normal">|</span>
                            <span className="text-indigo-600 group-hover:translate-x-1 transition-transform flex items-center gap-0.5">
                              Open Board
                              <ArrowRight className="w-3.5 h-3.5" />
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Column 3: Project Builder Form */}
            <div className="lg:col-span-1 space-y-4">
              <div className="flex items-center justify-between font-black text-xs uppercase text-slate-400 tracking-widest pb-2 border-b border-slate-200">
                <span>Project Workspace Initiator</span>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                    <FolderPlus className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-sm tracking-tight uppercase">
                      New Event Blueprint
                    </h3>
                    <p className="text-xs text-slate-400 font-semibold leading-tight">
                      Provision isolated calendar staging data
                    </p>
                  </div>
                </div>

                <form onSubmit={handleCreateProject} className="space-y-4 mt-6">
                  <div className="space-y-1.5">
                    <label htmlFor="modalProjectName" className="block text-xs font-semibold text-slate-700">
                      Project Name / Show Identifier
                    </label>
                    <input
                      id="modalProjectName"
                      type="text"
                      required
                      value={newProjName}
                      onChange={(e) => setNewProjName(e.target.value)}
                      placeholder="e.g., Basel Laser Rigging 2026"
                      className="w-full text-xs px-3.5 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-slate-50/50"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="modalStartDate" className="block text-xs font-semibold text-slate-700">
                      Show Start Date (Day 1)
                    </label>
                    <input
                      id="modalStartDate"
                      type="date"
                      required
                      value={newProjStart}
                      onChange={(e) => setNewProjStart(e.target.value)}
                      className="w-full text-xs px-3.5 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-slate-50/50"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="modalEndDate" className="block text-xs font-semibold text-slate-700">
                      Show End Date (Max 30 days)
                    </label>
                    <input
                      id="modalEndDate"
                      type="date"
                      required
                      value={newProjEnd}
                      onChange={(e) => setNewProjEnd(e.target.value)}
                      className="w-full text-xs px-3.5 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-slate-50/50"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full mt-2 text-xs font-extrabold py-3 rounded-lg bg-slate-900 text-white border border-slate-950 hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm shadow-slate-900/10"
                  >
                    <Plus className="w-4 h-4" />
                    Create & Boot Workspace
                  </button>
                </form>

                <div className="text-[10px] text-slate-400 mt-6 leading-relaxed bg-slate-50 border border-slate-100 p-3 rounded-lg font-medium flex items-start gap-2">
                  <Play className="w-3.5 h-3.5 text-indigo-505 rotate-90 flex-shrink-0 mt-0.5" />
                  <span>
                    New workspaces automatically boot with essential default channels (ARC, MISC) and support adding custom departments, bulk importing, and changes history tracker.
                  </span>
                </div>
              </div>
            </div>

          </div>

        </main>
      ) : (
        /* ==================== ACTIVE SPREADSHEET RIGGING MATRIX WORKSPACE ==================== */
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
                  activeProjectId={activeProjectId}
                  onCopyShareLink={() => {
                    const url = `${window.location.origin}${window.location.pathname}?project=${activeProjectId}&mode=view`;
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
                  allTasks={tasks}
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
                onUpdateSettings={saveSettings}
              />
            </div>

          </div>

        </main>
      )}

      {/* Floating high-fidelity task editing modal window */}
      <TaskEditModal
        isOpen={editingTask !== null}
        onClose={() => setEditingTask(null)}
        departments={departments}
        task={editingTask}
        onSubmit={handleFormSubmit}
        onDelete={handleDeleteTask}
        allTasks={tasks}
      />

    </div>
  );
}
