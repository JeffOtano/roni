import { defineApp } from "convex/server";
import agent from "@convex-dev/agent/convex.config";
import aggregate from "@convex-dev/aggregate/convex.config";
import migrations from "@convex-dev/migrations/convex.config";
import rateLimiter from "@convex-dev/rate-limiter/convex.config";
import workflow from "@convex-dev/workflow/convex.config";

const app = defineApp();
app.use(agent);
app.use(aggregate, { name: "perfByMovement" });
app.use(migrations);
app.use(rateLimiter);
app.use(workflow);

export default app;
