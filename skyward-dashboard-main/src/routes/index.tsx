import { createFileRoute } from "@tanstack/react-router";
import AdminPreview from "@/components/admin-preview/AdminPreview";

export const Route = createFileRoute("/")({
  component: () => <AdminPreview />,
});
