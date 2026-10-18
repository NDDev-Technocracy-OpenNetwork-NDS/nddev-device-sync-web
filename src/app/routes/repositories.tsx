import { createFileRoute } from "@tanstack/react-router";
import { CatalogPage } from "@/pages/catalog/catalog-page";
export const Route = createFileRoute("/repositories")({ component: CatalogPage });
