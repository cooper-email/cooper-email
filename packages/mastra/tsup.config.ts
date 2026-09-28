import path from "node:path";
import { fileURLToPath } from "node:url";
import { sdkPackage } from "../tsup.shared";

const dir = path.dirname(fileURLToPath(import.meta.url));

export default sdkPackage(dir, ["cooper-email", "@mastra/core", "zod"]);
