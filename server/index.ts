import { createScreeningServer } from "./http.ts";
import { openAIService } from "./service.ts";
const server = createScreeningServer(process.env.OPENAI_API_KEY ? openAIService() : null);
server.requestTimeout = 90000;
server.listen(3002, "127.0.0.1", () =>
  console.log("Screening API: http://127.0.0.1:3002 (key stays on server)"),
);
server.on("error", () => {
  console.error("Screening API could not start. Check port 3002.");
  process.exit(1);
});
