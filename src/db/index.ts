import Database from "better-sqlite3";
import { initializeSchema } from "./_schema.js";

export { ScanWriter } from "./_scan-writer.js";
export { PlannerRepository } from "./_planner-repository.js";
export { SnapshotRepository } from "./_snapshot-repository.js";
export type { DeletePlan } from "./_planner-repository.js";

export function openDatabase(databasePath: string): Database.Database {
  const database = new Database(databasePath);
  initializeSchema(database);
  return database;
}
