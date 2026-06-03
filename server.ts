/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

// Load local environment variables
dotenv.config();

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

// In-Memory Database Fallback Cache
let _projectsMemoryCache: Project[] | null = null;

// Ensure Data Directory Exists
try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
} catch (err) {
  console.error("Data directory could not be created:", err);
}

// Global default departments for falling back
const FALLBACK_DEPARTMENTS: Department[] = [
  { code: 'ARC', name: 'ARC production', color: '#0ea5e9', textColor: '#ffffff' },
  { code: 'MISC', name: 'misc', color: '#64748b', textColor: '#ffffff' }
];

// Lazily initialized Supabase client
let supabase: ReturnType<typeof createClient> | null = null;

function getSupabaseClient() {
  if (supabase) return supabase;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_KEY;
  if (!url || !key) {
    return null;
  }
  supabase = createClient(url, key);
  return supabase;
}

function isSupabaseConfigured(): boolean {
  return !!(process.env.SUPABASE_URL && process.env.SUPABASE_KEY);
}

// Helper to Load Projects Default Definitions
function getInitialProjects(): Project[] {
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

  return [
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
}

// Helper to persistent fallback file-save on local disk
function saveProjectsOnDisk(projects: Project[]) {
  try {
    fs.writeFileSync(PROJECTS_FILE, JSON.stringify(projects, null, 2), "utf-8");
  } catch (err) {
    console.error("Could not write projects.json to disk:", err);
  }
}

// Helper to Load Projects asynchronously from Supabase, in-memory, or static JSON disk
async function loadProjects(): Promise<Project[]> {
  const sbClient = getSupabaseClient();
  if (sbClient) {
    try {
      const { data, error } = await (sbClient as any)
        .from("projects")
        .select("*");
      if (error) {
        console.error("Supabase load projects error, falling back to disk/memory:", error);
      } else if (data && data.length > 0) {
        const projectsFromDb = data.map((p: any) => ({
          id: p.id,
          name: p.name,
          settings: p.settings || {},
          departments: p.departments || [],
          tasks: p.tasks || [],
          changesToday: p.changesToday || p.changes_today || []
        }));
        _projectsMemoryCache = projectsFromDb;
        saveProjectsOnDisk(projectsFromDb);
        return projectsFromDb;
      } else {
        console.log("Supabase table 'projects' is empty. Initializing defaults in Supabase...");
        const initial = getInitialProjects();
        await saveProjects(initial);
        return initial;
      }
    } catch (err) {
      console.error("Exception fetching projects from Supabase, using local fallback copy:", err);
    }
  }

  if (_projectsMemoryCache && _projectsMemoryCache.length > 0) {
    return _projectsMemoryCache;
  }

  if (fs.existsSync(PROJECTS_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(PROJECTS_FILE, "utf-8"));
      if (Array.isArray(data) && data.length > 0) {
        _projectsMemoryCache = data;
        return data;
      }
    } catch (err) {
      console.error("Error reading projects.json, continuing with fallback:", err);
    }
  }

  const initialProjects = getInitialProjects();
  _projectsMemoryCache = initialProjects;
  try {
    saveProjectsOnDisk(initialProjects);
  } catch {}
  return initialProjects;
}

// Helper to Save Projects in Supabase, sync RAM cache & disk
async function saveProjects(projects: Project[]) {
  _projectsMemoryCache = projects;
  saveProjectsOnDisk(projects);

  const sbClient = getSupabaseClient();
  if (sbClient) {
    try {
      for (const p of projects) {
        const { error } = await (sbClient as any)
          .from("projects")
          .upsert({
            id: p.id,
            name: p.name,
            settings: p.settings,
            departments: p.departments,
            tasks: p.tasks,
            changesToday: p.changesToday,
            updated_at: new Date().toISOString()
          }, { onConflict: 'id' });
          
        if (error) {
          console.error(`Error saving project '${p.id}' to Supabase:`, error);
        }
      }
    } catch (err) {
      console.error("Exception saving projects list to Supabase:", err);
    }
  }
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

// DB Status check endpoint
app.get("/api/db-status", (req, res) => {
  const configured = isSupabaseConfigured();
  res.json({
    connected: configured,
    mode: configured ? "Supabase Cloud Database" : "Local Ephemeral JSON File Fallback",
    details: configured
      ? "All scheduler lanes, tasks, and changelogs are synchronized in real-time with your live Supabase cloud workspace."
      : "Currently running with fallback system memory/local disk storage (due to missing SUPABASE_URL / SUPABASE_KEY). Configure environment variables in Settings to activate database storage."
  });
});

// Fetch list of projects with task/depts count (metadata style for active picker)
app.get("/api/projects", async (req, res) => {
  const projects = await loadProjects();
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
app.get("/api/projects/:id", async (req, res) => {
  const { id } = req.params;
  const projects = await loadProjects();
  const project = projects.find(p => p.id === id);
  if (!project) {
    return res.status(404).json({ error: "Project not found" });
  }
  res.json(project);
});

// Create/Update a new project or settings
app.post("/api/projects", async (req, res) => {
  const { id, name, settings, departments, tasks } = req.body;
  if (!id || !name) {
    return res.status(400).json({ error: "id and name are required parameters." });
  }

  const projects = await loadProjects();
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

  await saveProjects(projects);
  res.json({ success: true, id });
});

// Delete specific project
app.delete("/api/projects/:id", async (req, res) => {
  const { id } = req.params;
  let projects = await loadProjects();
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

  await saveProjects(projects);

  const sbClient = getSupabaseClient();
  if (sbClient) {
    try {
      await (sbClient as any).from("projects").delete().eq("id", id);
    } catch {}
  }

  res.json({ success: true, deleted: beforeCount > projects.length });
});

// Fetch entire list of tasks for the selected project
app.get("/api/tasks", async (req, res) => {
  const projectId = req.query.projectId as string;
  const projects = await loadProjects();
  const project = projects.find(p => p.id === projectId) || projects[0];
  res.json(project?.tasks || []);
});

// Save or Sync full tasks lists while auto-comparing changes to log output
app.post("/api/tasks", async (req, res) => {
  const projectId = req.query.projectId as string;
  const newTasks = req.body as Task[];
  const projects = await loadProjects();
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

  await saveProjects(projects);
  res.json({ success: true, count: newTasks.length });
});

// Fetch active changes for the selected project
app.get("/api/changes", async (req, res) => {
  const projectId = req.query.projectId as string;
  const projects = await loadProjects();
  const project = projects.find(p => p.id === projectId) || projects[0];
  res.json(project?.changesToday || []);
});

// Wipe operational log history of the selected project
app.post("/api/changes/reset", async (req, res) => {
  const projectId = req.query.projectId as string;
  const projects = await loadProjects();
  const project = projects.find(p => p.id === projectId) || projects[0];
  
  if (project) {
    project.changesToday = [];
    await saveProjects(projects);
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
