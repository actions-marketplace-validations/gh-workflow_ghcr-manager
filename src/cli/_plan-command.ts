import { PlannerRepository, openDatabase } from "../db/index.js";
import { hasFlag, requireOption } from "./_args.js";

export async function handlePlan(args: string[]): Promise<number> {
  const databasePath = requireOption(args, "--db");
  const owner = requireOption(args, "--owner");
  const packageName = requireOption(args, "--package");

  if (!hasFlag(args, "--delete-untagged")) {
    throw new Error("missing required cleanup selector: --delete-untagged");
  }

  const database = openDatabase(databasePath);
  const repository = new PlannerRepository(database);
  const plan = repository.getDeleteUntaggedPlan(owner, packageName);
  console.log(JSON.stringify(plan, null, 2));
  database.close();
  return 0;
}
