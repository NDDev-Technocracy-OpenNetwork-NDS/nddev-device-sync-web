import { createFileRoute } from "@tanstack/react-router";
import { DiagnosticsPage } from "@/pages/diagnostics/diagnostics-page";
export const Route = createFileRoute("/diagnostics")({ component: DiagnosticsPage });
