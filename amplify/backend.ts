import { defineBackend } from "@aws-amplify/backend";
import { auth } from "./auth/resource";
import { data } from "./data/resource";

// Re-export Schema so src/lib/* can import it from "../../amplify/backend"
export type { Schema } from "./data/resource";

defineBackend({ auth, data });
