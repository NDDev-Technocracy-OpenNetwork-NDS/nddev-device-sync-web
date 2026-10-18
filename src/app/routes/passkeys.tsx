import { createFileRoute } from "@tanstack/react-router";
import { PasskeysPage } from "@/pages/session/passkeys-page";
export const Route = createFileRoute("/passkeys")({ component: PasskeysPage });
