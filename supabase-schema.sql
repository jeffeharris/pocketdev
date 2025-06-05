-- Create engineers table
CREATE TABLE engineers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('frontend', 'backend', 'devops', 'fullstack')),
  status TEXT NOT NULL DEFAULT 'idle' CHECK (status IN ('idle', 'thinking', 'coding', 'testing', 'complete', 'error')),
  current_task TEXT,
  progress INTEGER DEFAULT 0,
  assistant_id TEXT UNIQUE,
  last_update TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create tasks table
CREATE TABLE tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  description TEXT NOT NULL,
  assigned_to UUID REFERENCES engineers(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
  output TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Enable real-time for engineers table
ALTER TABLE engineers REPLICA IDENTITY FULL;

-- Create indexes
CREATE INDEX idx_engineers_status ON engineers(status);
CREATE INDEX idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX idx_tasks_status ON tasks(status);

-- Insert sample engineers (you'll need to add real assistant IDs after creating them)
INSERT INTO engineers (name, role, status) VALUES
  ('Claude Frontend', 'frontend', 'idle'),
  ('Claude Backend', 'backend', 'idle'),
  ('Claude DevOps', 'devops', 'idle');