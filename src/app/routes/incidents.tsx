import { createFileRoute } from "@tanstack/react-router";
import { IncidentsPage } from "@/pages/diagnostics/incidents-page";
export const Route = createFileRoute("/incidents")({ component: IncidentsPage });
