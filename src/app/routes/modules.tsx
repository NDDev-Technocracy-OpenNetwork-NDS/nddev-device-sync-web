import { createFileRoute } from "@tanstack/react-router";
import { ModulesPage } from "@/pages/modules/modules-page";
export const Route = createFileRoute("/modules")({ component: ModulesPage });
