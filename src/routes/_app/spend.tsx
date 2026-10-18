import { createFileRoute } from "@tanstack/react-router";
import { SpendPage } from "@/client/features/spend/SpendPage";

export const Route = createFileRoute("/_app/spend")({
  component: SpendPage,
});
