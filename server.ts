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
}

interface ChangeLog {
  timestamp: string;
  type: 'Add' | 'Update' | 'Delete';
  description: string;
}

const app = express();
const PORT = 3000;

app.use(express.json());

// Persistent File Paths
const DATA_DIR = path.join(process.cwd(), "data");
const TASKS_FILE = path.join(DATA_DIR, "tasks.json");
const CHANGES_FILE = path.join(DATA_DIR, "changes.json");

// Ensure Data Directory Exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initial tasks demo dataset as server-side fallback
const INITIAL_DEMO_TASKS = [
  { id: 'task-1', code: 'LOG', date: '2026-07-06', time: '06:30', details: 'truck 2', status: 'Not Started' },
  { id: 'task-2', code: 'LX', date: '2026-06-12', time: '06:30', details: '06:30 - Pre-rig truss hoist motors inspection', status: 'Not Started' },
  { id: 'task-3', code: 'LX', date: '2026-06-12', time: '14:00', details: '14:00 - Motor hang and structural safety point lock', status: 'Not Started' },
  { id: 'task-4', code: 'AV', date: '2026-06-12', time: '19:15', details: '19:15 - Night line-array power loom runs', status: 'Not Started' },
  { id: 'task-5', code: 'STG', date: '2026-06-13', time: '09:00', details: '09:00 - Scenic deck framing assemble', status: 'Not Started' },
  { id: 'task-6', code: 'AV', date: '2026-06-13', time: '06:30', details: '13:00 - FOH audio console positioning & sound check', status: 'In Progress' },
  { id: 'task-7', code: 'MKT', date: '2026-06-13', time: '', details: 'ALL DAY: Venue exterior graphic wraps install', status: 'Not Started' },
  { id: 'task-8', code: 'LX', date: '2026-06-14', time: '10:30', details: '10:30 - Profiles circuit check and dimming patch', status: 'In Progress' },
  { id: 'task-9', code: 'OPS', date: '2026-06-14', time: '15:00', details: '15:00 - Security briefing and usher perimeter maps', status: 'Not Started' },
  { id: 'task-10', code: 'STG', date: '2026-06-14', time: '20:00', details: '20:00 - Dark rehearsal stage look design lock', status: 'Not Started' },
  { id: 'task-11', code: 'LOG', date: '2026-06-15', time: '23:30', details: '23:30 - Midnight catering delivery window check', status: 'Completed' }
];

// Helper to Load Tasks
function loadTasks(): Task[] {
  if (fs.existsSync(TASKS_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(TASKS_FILE, "utf-8"));
    } catch {
      return INITIAL_DEMO_TASKS;
    }
  }
  return INITIAL_DEMO_TASKS;
}

// Helper to Save Tasks
function saveTasks(tasks: Task[]) {
  fs.writeFileSync(TASKS_FILE, JSON.stringify(tasks, null, 2), "utf-8");
}

// Helper to Load Today's Changes
function loadChangesToday(): ChangeLog[] {
  if (fs.existsSync(CHANGES_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(CHANGES_FILE, "utf-8"));
    } catch {
      return [];
    }
  }
  return [];
}

// Helper to Save Changes
function saveChangesToday(changes: ChangeLog[]) {
  fs.writeFileSync(CHANGES_FILE, JSON.stringify(changes, null, 2), "utf-8");
}

// ---------------- API ENDPOINTS ----------------

// Fetch entire list of tasks
app.get("/api/tasks", (req, res) => {
  res.json(loadTasks());
});

// Save / sync full task lists and auto-compare state differences for changelogs
app.post("/api/tasks", (req, res) => {
  const newTasks = req.body as Task[];
  const prevTasks = loadTasks();

  const newChanges: ChangeLog[] = [];
  const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false }) + ' UTC';

  // 1. Check for Additions or Updates
  newTasks.forEach(task => {
    const prevTask = prevTasks.find(pt => pt.id === task.id);
    if (!prevTask) {
      // Added
      newChanges.push({
        timestamp,
        type: 'Add',
        description: `Added task [${task.code}]: "${task.details}" on ${task.date}${task.time ? ` at ${task.time}` : ' (All Day)'}`
      });
    } else {
      // Checked for Updates
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

  // 2. Check for Deletions
  prevTasks.forEach(prevTask => {
    const isPresent = newTasks.some(nt => nt.id === prevTask.id);
    if (!isPresent) {
      // Deleted
      newChanges.push({
        timestamp,
        type: 'Delete',
        description: `Completed/Deleted task [${prevTask.code}]: "${prevTask.details}" on ${prevTask.date}${prevTask.time ? ` at ${prevTask.time}` : ' (All Day)'}`
      });
    }
  });

  // Save Tasks list
  saveTasks(newTasks);

  // If new changes resolved, append them to the operational daily buffer
  if (newChanges.length > 0) {
    const changesToday = [...loadChangesToday(), ...newChanges];
    saveChangesToday(changesToday);
    console.log(`[Operational Logger] Logged ${newChanges.length} schedule modification(s)`);
  }

  res.json({ success: true, count: newTasks.length });
});

// Fetch active operational changes today
app.get("/api/changes", (req, res) => {
  res.json(loadChangesToday());
});

// Trigger a manual reset of the server changes history log
app.post("/api/changes/reset", (req, res) => {
  saveChangesToday([]);
  res.json({ success: true, message: "Operational changes history cleared for today." });
});

// Initialize front-end bundling or static delivery fallback
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
    console.log(`🚀 Operational server successfully started and listening on http://localhost:${PORT}`);
  });
}

boot();
