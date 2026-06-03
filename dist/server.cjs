var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// server.ts
var server_exports = {};
__export(server_exports, {
  default: () => server_default
});
module.exports = __toCommonJS(server_exports);
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_fs = __toESM(require("fs"), 1);
var import_vite = require("vite");
var import_supabase_js = require("@supabase/supabase-js");
var import_dotenv = __toESM(require("dotenv"), 1);
import_dotenv.default.config();
var app = (0, import_express.default)();
var PORT = 3e3;
app.use(import_express.default.json());
var DATA_DIR = import_path.default.join(process.cwd(), "data");
var PROJECTS_FILE = import_path.default.join(DATA_DIR, "projects.json");
var TASKS_FILE = import_path.default.join(DATA_DIR, "tasks.json");
var CHANGES_FILE = import_path.default.join(DATA_DIR, "changes.json");
var _projectsMemoryCache = null;
try {
  if (!import_fs.default.existsSync(DATA_DIR)) {
    import_fs.default.mkdirSync(DATA_DIR, { recursive: true });
  }
} catch (err) {
  console.error("Data directory could not be created:", err);
}
var FALLBACK_DEPARTMENTS = [
  { code: "ARC", name: "ARC production", color: "#0ea5e9", textColor: "#ffffff" },
  { code: "MISC", name: "misc", color: "#64748b", textColor: "#ffffff" }
];
var lastSupabaseError = null;
var supabase = null;
function getSupabaseClient() {
  if (supabase) return supabase;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_KEY;
  if (!url || !key) {
    return null;
  }
  supabase = (0, import_supabase_js.createClient)(url, key);
  return supabase;
}
function isSupabaseConfigured() {
  return !!(process.env.SUPABASE_URL && process.env.SUPABASE_KEY);
}
function getInitialProjects() {
  let legacyTasks = [];
  if (import_fs.default.existsSync(TASKS_FILE)) {
    try {
      legacyTasks = JSON.parse(import_fs.default.readFileSync(TASKS_FILE, "utf-8"));
    } catch {
    }
  }
  let legacyChanges = [];
  if (import_fs.default.existsSync(CHANGES_FILE)) {
    try {
      legacyChanges = JSON.parse(import_fs.default.readFileSync(CHANGES_FILE, "utf-8"));
    } catch {
    }
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
function saveProjectsOnDisk(projects) {
  try {
    import_fs.default.writeFileSync(PROJECTS_FILE, JSON.stringify(projects, null, 2), "utf-8");
  } catch (err) {
    console.error("Could not write projects.json to disk:", err);
  }
}
async function loadProjects(req) {
  const sbClient = getSupabaseClient();
  if (sbClient) {
    try {
      const { data, error } = await sbClient.from("projects").select("*");
      if (error) {
        console.error("Supabase load projects error, falling back to disk/memory:", error);
        lastSupabaseError = {
          message: error.message || "Unknown database error",
          code: error.code || void 0,
          details: error.details || void 0,
          hint: error.hint || void 0
        };
      } else {
        lastSupabaseError = null;
        if (data && data.length > 0) {
          const projectsFromDb = data.map((p) => ({
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
          await saveProjects(initial, req);
          return initial;
        }
      }
    } catch (err) {
      console.error("Exception fetching projects from Supabase, using local fallback copy:", err);
      lastSupabaseError = {
        message: err?.message || String(err)
      };
    }
  }
  if (_projectsMemoryCache && _projectsMemoryCache.length > 0) {
    return _projectsMemoryCache;
  }
  if (import_fs.default.existsSync(PROJECTS_FILE)) {
    try {
      const data = JSON.parse(import_fs.default.readFileSync(PROJECTS_FILE, "utf-8"));
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
  } catch {
  }
  return initialProjects;
}
async function saveProjects(projects, req) {
  _projectsMemoryCache = projects;
  saveProjectsOnDisk(projects);
  const sbClient = getSupabaseClient();
  if (sbClient) {
    try {
      for (const p of projects) {
        const { error } = await sbClient.from("projects").upsert({
          id: p.id,
          name: p.name,
          settings: p.settings,
          departments: p.departments,
          tasks: p.tasks,
          changesToday: p.changesToday,
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        }, { onConflict: "id" });
        if (error) {
          console.error(`Error saving project '${p.id}' to Supabase:`, error);
          lastSupabaseError = {
            message: `Save error for '${p.id}': ${error.message || "Unknown error"}`,
            code: error.code || void 0,
            details: error.details || void 0,
            hint: error.hint || void 0
          };
        } else {
          lastSupabaseError = null;
        }
      }
    } catch (err) {
      console.error("Exception saving projects list to Supabase:", err);
      lastSupabaseError = {
        message: `Exception saving database changes: ${err?.message || String(err)}`
      };
    }
  }
}
function flattenTasksList(tasksList) {
  const flat = [];
  const recurse = (item, parentCode, parentDate) => {
    const virtual = {
      id: item.id,
      code: item.code || parentCode || "MISC",
      date: item.date || parentDate || "",
      time: item.time || "",
      details: item.details || "",
      status: item.status || "Not Started",
      durationDays: item.durationDays || 1,
      dependencyTaskId: item.dependencyTaskId || void 0,
      notes: item.notes || void 0,
      startTime: item.startTime || void 0,
      endTime: item.endTime || void 0
    };
    flat.push(virtual);
    if (item.subtasks && item.subtasks.length > 0) {
      item.subtasks.forEach((sub) => recurse(sub, virtual.code, virtual.date));
    }
  };
  tasksList.forEach((t) => recurse(t));
  return flat;
}
app.get("/api/db-status", (req, res) => {
  const configured = isSupabaseConfigured();
  const hasError = !!lastSupabaseError;
  const connected = configured && !hasError;
  let mode = "Checking Database Status...";
  let details = "";
  if (!configured) {
    mode = "Local Ephemeral JSON File Fallback";
    details = "Currently running with fallback system memory/local disk storage (due to missing SUPABASE_URL / SUPABASE_KEY). Configure environment variables in Settings to activate database storage.";
  } else if (hasError) {
    mode = "Supabase Connection Error";
    if (lastSupabaseError?.code === "42P01") {
      details = "The database table 'projects' is missing in your Supabase workspace schema. Please open the Supabase SQL Editor and execute the schema script inside `/SCHEMA.sql` to instantiate the table structure.";
    } else {
      details = `Supabase is configured but returned a PostgreSQL query error: "${lastSupabaseError?.message}". Please verify permissions, credentials, or table structure in your console.`;
    }
  } else {
    mode = "Supabase Cloud Database";
    details = "All scheduler lanes, tasks, and changelogs are synchronized in real-time with your live Supabase cloud workspace.";
  }
  res.json({
    connected,
    configured,
    mode,
    details,
    error: lastSupabaseError
  });
});
app.get("/api/projects", async (req, res) => {
  const projects = await loadProjects(req);
  const summaries = projects.map((p) => ({
    id: p.id,
    name: p.name,
    settings: p.settings,
    departmentsCount: p.departments.length,
    tasksCount: flattenTasksList(p.tasks).length
  }));
  res.json(summaries);
});
app.get("/api/projects/:id", async (req, res) => {
  const { id } = req.params;
  const projects = await loadProjects(req);
  const project = projects.find((p) => p.id === id);
  if (!project) {
    return res.status(404).json({ error: "Project not found" });
  }
  res.json(project);
});
app.post("/api/projects", async (req, res) => {
  const { id, name, settings, departments, tasks } = req.body;
  if (!id || !name) {
    return res.status(400).json({ error: "id and name are required parameters." });
  }
  const projects = await loadProjects(req);
  const index = projects.findIndex((p) => p.id === id);
  if (index >= 0) {
    projects[index].name = name;
    if (settings) projects[index].settings = settings;
    if (departments) projects[index].departments = departments;
    if (tasks) projects[index].tasks = tasks;
  } else {
    projects.push({
      id,
      name,
      settings: settings || { projectName: name, startDate: "2026-07-06", endDate: "2026-07-12", dayNames: {}, dayNotes: {} },
      departments: departments || FALLBACK_DEPARTMENTS,
      tasks: tasks || [],
      changesToday: []
    });
  }
  await saveProjects(projects, req);
  res.json({ success: true, id });
});
app.delete("/api/projects/:id", async (req, res) => {
  const { id } = req.params;
  let projects = await loadProjects(req);
  const beforeCount = projects.length;
  projects = projects.filter((p) => p.id !== id);
  if (projects.length === 0) {
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
  await saveProjects(projects, req);
  const sbClient = getSupabaseClient();
  if (sbClient) {
    try {
      await sbClient.from("projects").delete().eq("id", id);
    } catch {
    }
  }
  res.json({ success: true, deleted: beforeCount > projects.length });
});
app.get("/api/tasks", async (req, res) => {
  const projectId = req.query.projectId;
  const projects = await loadProjects(req);
  const project = projects.find((p) => p.id === projectId) || projects[0];
  res.json(project?.tasks || []);
});
app.post("/api/tasks", async (req, res) => {
  const projectId = req.query.projectId;
  const newTasks = req.body;
  const projects = await loadProjects(req);
  const projIdx = projects.findIndex((p) => p.id === projectId);
  if (projIdx === -1) {
    return res.status(404).json({ error: "Project context not found on server" });
  }
  const project = projects[projIdx];
  const prevFlat = flattenTasksList(project.tasks);
  const nextFlat = flattenTasksList(newTasks);
  const newChanges = [];
  const timestamp = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", { hour12: false }) + " UTC";
  nextFlat.forEach((task) => {
    const prevTask = prevFlat.find((pt) => pt.id === task.id);
    if (!prevTask) {
      newChanges.push({
        timestamp,
        type: "Add",
        description: `Added task [${task.code}]: "${task.details}" on ${task.date}${task.time ? ` at ${task.time}` : " (All Day)"}`
      });
    } else {
      const diffs = [];
      if (prevTask.code !== task.code) diffs.push(`department ${prevTask.code} -> ${task.code}`);
      if (prevTask.date !== task.date) diffs.push(`date ${prevTask.date} -> ${task.date}`);
      if (prevTask.time !== task.time) diffs.push(`time "${prevTask.time || "All Day"}" -> "${task.time || "All Day"}"`);
      if (prevTask.details !== task.details) diffs.push(`details "${prevTask.details}" -> "${task.details}"`);
      if (prevTask.status !== task.status) diffs.push(`status "${prevTask.status}" -> "${task.status}"`);
      if (diffs.length > 0) {
        newChanges.push({
          timestamp,
          type: "Update",
          description: `Updated task [${task.code}] "${task.details}": changed ${diffs.join(", ")}`
        });
      }
    }
  });
  prevFlat.forEach((prevTask) => {
    if (!nextFlat.some((nt) => nt.id === prevTask.id)) {
      newChanges.push({
        timestamp,
        type: "Delete",
        description: `Completed/Deleted task [${prevTask.code}]: "${prevTask.details}" on ${prevTask.date}${prevTask.time ? ` at ${prevTask.time}` : " (All Day)"}`
      });
    }
  });
  project.tasks = newTasks;
  if (newChanges.length > 0) {
    project.changesToday = [...project.changesToday || [], ...newChanges];
  }
  await saveProjects(projects, req);
  res.json({ success: true, count: newTasks.length });
});
app.get("/api/changes", async (req, res) => {
  const projectId = req.query.projectId;
  const projects = await loadProjects(req);
  const project = projects.find((p) => p.id === projectId) || projects[0];
  res.json(project?.changesToday || []);
});
app.post("/api/changes/reset", async (req, res) => {
  const projectId = req.query.projectId;
  const projects = await loadProjects(req);
  const project = projects.find((p) => p.id === projectId) || projects[0];
  if (project) {
    project.changesToday = [];
    await saveProjects(projects, req);
  }
  res.json({ success: true });
});
async function boot() {
  if (process.env.VERCEL === "1") {
    return;
  }
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`\u{1F680} Operational multi-project server listening on http://localhost:${PORT}`);
  });
}
boot();
var server_default = app;
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
//# sourceMappingURL=server.cjs.map
