import { PlannerRepository, openDatabase } from "../db/index.js";
import { collectRepeatedOption, hasFlag, requireOption } from "./_args.js";

export async function handlePlan(args: string[]): Promise<number> {
  const databasePath = requireOption(args, "--db");
  const owner = requireOption(args, "--owner");
  const packageName = requireOption(args, "--package");
  const deleteTags = collectRepeatedOption(args, "--delete-tag");
  const excludeTags = collectRepeatedOption(args, "--exclude-tag");
  const deleteUntagged = hasFlag(args, "--delete-untagged");

  if (deleteUntagged && deleteTags.length > 0) {
    throw new Error("plan currently supports either --delete-untagged or --delete-tag, not both");
  }

  if (!deleteUntagged && deleteTags.length === 0) {
    throw new Error("missing required cleanup selector: --delete-untagged or --delete-tag");
  }

  if (deleteUntagged && excludeTags.length > 0) {
    throw new Error("--exclude-tag is only supported with --delete-tag");
  }

  const database = openDatabase(databasePath);
  const repository = new PlannerRepository(database);
  const plan = deleteUntagged
    ? repository.getDeleteUntaggedPlan(owner, packageName)
    : repository.getDeleteTagsPlan(owner, packageName, deleteTags, excludeTags);
  console.log(JSON.stringify(plan, null, 2));
  database.close();
  return 0;
}
