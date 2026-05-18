import Database from "better-sqlite3";
import { initializeSchema } from "./_schema.js";

export { ScanWriter } from "./_scan-writer.js";
export { CleanupRunWriter } from "./_cleanup-run-writer.js";
export { PlannerRepository } from "./planner/index.js";
export { SnapshotRepository } from "./_snapshot-repository.js";
export type { DeletePlan } from "./planner/index.js";

export function openDatabase(databasePath: string): Database.Database {
  const database = new Database(databasePath);
  initializeSchema(database);
  return database;
}
