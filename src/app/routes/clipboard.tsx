import { createFileRoute } from "@tanstack/react-router";
import { ClipboardPage } from "@/pages/clipboard/clipboard-page";
export const Route = createFileRoute("/clipboard")({ component: ClipboardPage });
