import { createFileRoute } from "@tanstack/react-router";
import { SessionPage } from "@/pages/session/session-page";
export const Route = createFileRoute("/")({ component: SessionPage });
