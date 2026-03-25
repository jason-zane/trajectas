import { getItems } from "@/app/actions/items";
import { ItemList } from "./item-list";

export default async function ItemsPage() {
  const items = await getItems();
  return <ItemList items={items} />;
}
