import { defineBackend } from "@aws-amplify/backend";
import { auth } from "./auth/resource.js";
import { data } from "./data/resource.js";

// Re-export Schema so src/lib/* can import it from "../../amplify/backend"
export type { Schema } from "./data/resource.js";

defineBackend({ auth, data });
