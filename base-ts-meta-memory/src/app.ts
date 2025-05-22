import { createBot, MemoryDB as Database } from "@builderbot/bot";
import { metaProvider } from "./provider"; // Updated import
import { config } from "./config";
import flows from "./flows"; // Updated import
import { initializeDriveFolders } from "./services/driveService";


const PORT = config.PORT;

const main = async () => {
  // Initialize Google Drive folders (optional, creates them if they don't exist)
  // This is a fire-and-forget, errors are logged by the function itself.
  initializeDriveFolders().catch(err => console.error("Failed to initialize drive folders on startup:", err));


  const { handleCtx, httpServer } = await createBot({
    flow: flows,
    provider: metaProvider, // Updated provider
    database: new Database(), // Using MemoryDB as per original setup
  });

  httpServer(+PORT);
  console.log(`NateBot Pro listening on port: ${PORT}`);
  console.log(`Webhook URL: http://localhost:${PORT}/webhook`);
  console.log('Press Ctrl+C to stop.');
};

main();