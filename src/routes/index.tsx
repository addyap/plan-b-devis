import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  ssr: false,
  component: () => <Navigate to="/dashboard" replace />,
});
