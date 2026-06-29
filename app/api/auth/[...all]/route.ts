import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/src/lib/auth";

export const { GET, POST, PUT, PATCH, DELETE } = toNextJsHandler(auth);
