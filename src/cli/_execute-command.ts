import { openDatabase, PlannerRepository } from "../db/index.js";
import { executeDeletePlan } from "../execute/index.js";
import { resolveGitHubToken, resolveLogLevel } from "./_args.js";
import { createLogger } from "./_logger.js";
import { loadDeletePlan, resolvePlanCommandInputs } from "./_planner-options.js";

export async function handleExecute(args: string[]): Promise<number> {
  const inputs = resolvePlanCommandInputs(args);
  const token = resolveGitHubToken(args);
  const logger = createLogger(resolveLogLevel(args));
  const database = openDatabase(inputs.databasePath);
  const repository = new PlannerRepository(database, logger);
  logger.debug(`Starting execute for ${inputs.owner}/${inputs.packageName}`);
  const plan = loadDeletePlan(repository, inputs);
  const summary = await executeDeletePlan(plan, {
    token,
    logger
  });
  logger.debug(`Completed execute for ${inputs.owner}/${inputs.packageName}`);
  console.log(JSON.stringify(summary, null, 2));
  database.close();
  return 0;
}
