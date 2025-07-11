import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq, desc } from 'drizzle-orm';
import Database from 'better-sqlite3';
import * as schema from './schema.js';

// Create SQLite database
const sqlite = new Database('./db/pocketdev.db');

// Create Drizzle instance
export const db = drizzle(sqlite, { schema });

// Helper functions for common operations
export async function createTask(taskData) {
  const [task] = await db.insert(schema.tasks).values(taskData).returning();
  return task;
}

export async function updateTaskStatus(taskId, status) {
  const [updated] = await db
    .update(schema.tasks)
    .set({ status, updatedAt: new Date() })
    .where(eq(schema.tasks.id, taskId))
    .returning();
  return updated;
}

export async function getTasksByStatus(status) {
  return db.query.tasks.findMany({
    where: eq(schema.tasks.status, status),
    with: {
      project: true,
      engineerProfile: true
    }
  });
}

export async function createProject(projectData) {
  const [project] = await db.insert(schema.projects).values(projectData).returning();
  return project;
}

export async function getActiveProject() {
  // For now, return the most recently active project
  return db.query.projects.findFirst({
    orderBy: (projects, { desc }) => [desc(projects.lastActivityAt)]
  });
}

// Add more helper functions as needed