import { createFileRoute } from "@tanstack/react-router";
import { CompanyPage } from "@/pages/company/company-page";
export const Route = createFileRoute("/company")({ component: CompanyPage });
