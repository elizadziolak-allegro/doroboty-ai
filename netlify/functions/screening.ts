import type { Config, Context } from "@netlify/functions";
import { publicHandler } from "../../server/netlify-handler.ts";
import { openAIService } from "../../server/service.ts";
import { tokenBudget } from "../../server/token-budget.ts";
import { tokenStore } from "../../server/token-store.ts";

export default async function screening(request: Request, context: Context) {
  return publicHandler(() => {
    // Paid calls are off in previews and in every unconfigured/disabled deployment.
    if (
      context.deploy?.context !== "production" ||
      process.env.AI_ENABLED !== "true" ||
      !process.env.OPENAI_API_KEY ||
      !context.site.id ||
      process.env.AI_SITE_ID !== context.site.id
    )
      return null;
    return openAIService(tokenBudget(() => tokenStore(), context.site.id));
  })(request);
}
export const config: Config = {
  path: ["/api/health", "/api/screening/*"],
  rateLimit: {
    action: "rate_limit",
    aggregateBy: ["ip", "domain"],
    windowSize: 60,
    windowLimit: 12,
  },
};
