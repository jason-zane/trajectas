import { getFactors } from "@/app/actions/factors";
import { FactorList } from "./factor-list";

export default async function FactorsPage() {
  const factors = await getFactors();
  return <FactorList factors={factors} />;
}
