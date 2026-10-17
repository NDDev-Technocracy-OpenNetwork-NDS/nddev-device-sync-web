import { createFileRoute } from "@tanstack/react-router";
import { VaultPage } from "@/pages/vault/vault-page";
export const Route = createFileRoute("/vault")({ component: VaultPage });
