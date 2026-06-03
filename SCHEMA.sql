-- SQL Schema definition for Supabase Concurrent Syncing
-- Open your Supabase Console -> SQL Editor, paste and run this command:

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  departments JSONB NOT NULL DEFAULT '[]'::jsonb,
  tasks JSONB NOT NULL DEFAULT '[]'::jsonb,
  changesToday JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Permit anonymous/public select, insert, update and delete capabilities
-- (Makes rapid synchronization across devices work transparently out of the box)
CREATE POLICY "Allow anonymous read/write operations" 
ON projects 
FOR ALL 
TO public 
USING (true) 
WITH CHECK (true);
