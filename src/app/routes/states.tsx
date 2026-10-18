import { createFileRoute } from "@tanstack/react-router";
import { StatesPage } from "@/pages/vault/states-page";
export const Route = createFileRoute("/states")({ component: StatesPage });
