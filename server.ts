/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";

interface Task {
  id: string;
  code: string;
  date: string;
  time: string;
  details: string;
  status: string;
  durationDays?: number;
  subtasks?: any[];
  parentTaskId?: string;
  dependencyTaskId?: string;
  notes?: string;
  startTime?: string;
  endTime?: string;
}

interface Department {
  code: string;
  name: string;
  color: string;
  textColor: string;
}

interface ProjectSettings {
  projectName: string;
  startDate: string;
  endDate: string;
  dayNames?: Record<string, string>;
  dayNotes?: Record<string, string>;
}

interface ChangeLog {
  timestamp: string;
  type: 'Add' | 'Update' | 'Delete';
  description: string;
}

interface Project {
  id: string;
  name: string;
  settings: ProjectSettings;
  departments: Department[];
  tasks: Task[];
  changesToday: ChangeLog[];
}

const app = express();
const PORT = 3000;

app.use(express.json());

// Persistent File Paths
const DATA_DIR = path.join(process.cwd(), "data");
const PROJECTS_FILE = path.join(DATA_DIR, "projects.json");
const TASKS_FILE = path.join(DATA_DIR, "tasks.json");
const CHANGES_FILE = path.join(DATA_DIR, "changes.json");

// Ensure Data Directory Exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Global default departments for falling back
const FALLBACK_DEPARTMENTS: Department[] = [
  { code: 'ARC', name: 'ARC production', color: '#0ea5e9', textColor: '#ffffff' },
  { code: 'MISC', name: 'misc', color: '#64748b', textColor: '#ffffff' }
];

// Helper to Load Projects
function loadProjects(): Project[] {
  if (fs.existsSync(PROJECTS_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(PROJECTS_FILE, "utf-8"));
      if (Array.isArray(data) && data.length > 0) {
        return data;
      }
    } catch {
      // Fallback
    }
  }

  // Handle migration of single project data if legacy files exist
  let legacyTasks: Task[] = [];
  if (fs.existsSync(TASKS_FILE)) {
    try {
      legacyTasks = JSON.parse(fs.readFileSync(TASKS_FILE, "utf-8"));
    } catch {}
  }

  let legacyChanges: ChangeLog[] = [];
  if (fs.existsSync(CHANGES_FILE)) {
    try {
      legacyChanges = JSON.parse(fs.readFileSync(CHANGES_FILE, "utf-8"));
    } catch {}
  }

  const initialProjects: Project[] = [
    {
      id: "basel-tattoo-2026",
      name: "Basel Tattoo 2026",
      settings: {
        projectName: "Basel Tattoo 2026",
        startDate: "2026-07-06",
        endDate: "2026-07-30",
        dayNames: {},
        dayNotes: {}
      },
      departments: FALLBACK_DEPARTMENTS,
      tasks: legacyTasks,
      changesToday: legacyChanges
    }
  ];

  saveProjects(initialProjects);
  return initialProjects;
}

// Helper to Save Projects
function saveProjects(projects: Project[]) {
  fs.writeFileSync(PROJECTS_FILE, JSON.stringify(projects, null, 2), "utf-8");
}

// Helper to find parent or nested task recursively
function findTaskInList(list: any[], id: string): any {
  for (const item of list) {
    if (item.id === id) return item;
    if (item.subtasks && item.subtasks.length > 0) {
      const found = findTaskInList(item.subtasks, id);
      if (found) return found;
    }
  }
  return null;
}

// Flatten hierarchical tasks to a flat list for change comparison
function flattenTasksList(tasksList: Task[]): Task[] {
  const flat: Task[] = [];
  const recurse = (item: any, parentCode?: string, parentDate?: string) => {
    const virtual: Task = {
      id: item.id,
      code: item.code || parentCode || 'MISC',
      date: item.date || parentDate || '',
      time: item.time || '',
      details: item.details || '',
      status: item.status || 'Not Started',
      durationDays: item.durationDays || 1,
      dependencyTaskId: item.dependencyTaskId || undefined,
      notes: item.notes || undefined,
      startTime: item.startTime || undefined,
      endTime: item.endTime || undefined
    };
    flat.push(virtual);
    if (item.subtasks && item.subtasks.length > 0) {
      item.subtasks.forEach((sub: any) => recurse(sub, virtual.code, virtual.date));
    }
  };
  tasksList.forEach(t => recurse(t));
  return flat;
}

// ---------------- API ENDPOINTS ----------------

// Fetch list of projects with task/depts count (metadata style for active picker)
app.get("/api/projects", (req, res) => {
  const projects = loadProjects();
  const summaries = projects.map(p => ({
    id: p.id,
    name: p.name,
    settings: p.settings,
    departmentsCount: p.departments.length,
    tasksCount: flattenTasksList(p.tasks).length,
  }));
  res.json(summaries);
});

// Fetch a specific project's full details
app.get("/api/projects/:id", (req, res) => {
  const { id } = req.params;
  const projects = loadProjects();
  const project = projects.find(p => p.id === id);
  if (!project) {
    return res.status(404).json({ error: "Project not found" });
  }
  res.json(project);
});

// Create/Update a new project or settings
app.post("/api/projects", (req, res) => {
  const { id, name, settings, departments, tasks } = req.body;
  if (!id || !name) {
    return res.status(400).json({ error: "id and name are required parameters." });
  }

  const projects = loadProjects();
  const index = projects.findIndex(p => p.id === id);

  if (index >= 0) {
    // Update existing project details
    projects[index].name = name;
    if (settings) projects[index].settings = settings;
    if (departments) projects[index].departments = departments;
    if (tasks) projects[index].tasks = tasks;
  } else {
    // Add new clean slate project
    projects.push({
      id,
      name,
      settings: settings || { projectName: name, startDate: "2026-07-06", endDate: "2026-07-12", dayNames: {}, dayNotes: {} },
      departments: departments || FALLBACK_DEPARTMENTS,
      tasks: tasks || [],
      changesToday: []
    });
  }

  saveProjects(projects);
  res.json({ success: true, id });
});

// Delete specific project
app.delete("/api/projects/:id", (req, res) => {
  const { id } = req.params;
  let projects = loadProjects();
  const beforeCount = projects.length;
  projects = projects.filter(p => p.id !== id);

  if (projects.length === 0) {
    // Keep at least one fallback demo project
    projects = [{
      id: "basel-tattoo-2026",
      name: "Basel Tattoo 2026",
      settings: {
        projectName: "Basel Tattoo 2026",
        startDate: "2026-07-06",
        endDate: "2026-07-30",
        dayNames: {},
        dayNotes: {}
      },
      departments: FALLBACK_DEPARTMENTS,
      tasks: [],
      changesToday: []
    }];
  }

  saveProjects(projects);
  res.json({ success: true, deleted: beforeCount > projects.length });
});

// Fetch entire list of tasks for the selected project
app.get("/api/tasks", (req, res) => {
  const projectId = req.query.projectId as string;
  const projects = loadProjects();
  const project = projects.find(p => p.id === projectId) || projects[0];
  res.json(project?.tasks || []);
});

// Save or Sync full tasks lists while auto-comparing changes to log output
app.post("/api/tasks", (req, res) => {
  const projectId = req.query.projectId as string;
  const newTasks = req.body as Task[];
  const projects = loadProjects();
  const projIdx = projects.findIndex(p => p.id === projectId);
  
  if (projIdx === -1) {
    return res.status(404).json({ error: "Project context not found on server" });
  }

  const project = projects[projIdx];
  const prevFlat = flattenTasksList(project.tasks);
  const nextFlat = flattenTasksList(newTasks);

  const newChanges: ChangeLog[] = [];
  const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false }) + ' UTC';

  // Compare sets
  nextFlat.forEach(task => {
    const prevTask = prevFlat.find(pt => pt.id === task.id);
    if (!prevTask) {
      newChanges.push({
        timestamp,
        type: 'Add',
        description: `Added task [${task.code}]: "${task.details}" on ${task.date}${task.time ? ` at ${task.time}` : ' (All Day)'}`
      });
    } else {
      const diffs: string[] = [];
      if (prevTask.code !== task.code) diffs.push(`department ${prevTask.code} -> ${task.code}`);
      if (prevTask.date !== task.date) diffs.push(`date ${prevTask.date} -> ${task.date}`);
      if (prevTask.time !== task.time) diffs.push(`time "${prevTask.time || 'All Day'}" -> "${task.time || 'All Day'}"`);
      if (prevTask.details !== task.details) diffs.push(`details "${prevTask.details}" -> "${task.details}"`);
      if (prevTask.status !== task.status) diffs.push(`status "${prevTask.status}" -> "${task.status}"`);

      if (diffs.length > 0) {
        newChanges.push({
          timestamp,
          type: 'Update',
          description: `Updated task [${task.code}] "${task.details}": changed ${diffs.join(', ')}`
        });
      }
    }
  });

  prevFlat.forEach(prevTask => {
    if (!nextFlat.some(nt => nt.id === prevTask.id)) {
      newChanges.push({
        timestamp,
        type: 'Delete',
        description: `Completed/Deleted task [${prevTask.code}]: "${prevTask.details}" on ${prevTask.date}${prevTask.time ? ` at ${prevTask.time}` : ' (All Day)'}`
      });
    }
  });

  // Save changes
  project.tasks = newTasks;
  if (newChanges.length > 0) {
    project.changesToday = [...(project.changesToday || []), ...newChanges];
  }

  saveProjects(projects);
  res.json({ success: true, count: newTasks.length });
});

// Fetch active changes for the selected project
app.get("/api/changes", (req, res) => {
  const projectId = req.query.projectId as string;
  const projects = loadProjects();
  const project = projects.find(p => p.id === projectId) || projects[0];
  res.json(project?.changesToday || []);
});

// Wipe operational log history of the selected project
app.post("/api/changes/reset", (req, res) => {
  const projectId = req.query.projectId as string;
  const projects = loadProjects();
  const project = projects.find(p => p.id === projectId) || projects[0];
  
  if (project) {
    project.changesToday = [];
    saveProjects(projects);
  }
  res.json({ success: true });
});

// Initialize Vite server for asset handling
async function boot() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Operational multi-project server listening on http://localhost:${PORT}`);
  });
}

boot();
