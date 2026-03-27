import { getItems } from "@/app/actions/items";
import { getItemHealthIndicators } from "@/app/actions/psychometrics";
import { ItemList } from "./item-list";

export default async function ItemsPage() {
  const [items, indicators] = await Promise.all([
    getItems(),
    getItemHealthIndicators(),
  ]);

  // Build a lookup map for the client component
  const healthMap: Record<string, { status: "healthy" | "review" | "action"; discrimination: number | null }> = {};
  for (const ind of indicators) {
    healthMap[ind.itemId] = { status: ind.status, discrimination: ind.discrimination };
  }

  return <ItemList items={items} healthMap={healthMap} />;
}
