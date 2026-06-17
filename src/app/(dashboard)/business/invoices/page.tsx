import { PageHeader } from "@/components/page-header";
import { requireAdminScope } from "@/lib/auth/authorization";
import { getBillingClients, getInvoicesForAdmin } from "@/app/actions/invoices";

import { CreateInvoiceDialog } from "./create-invoice-dialog";
import { InvoicesTable } from "./invoices-table";

export default async function InvoicesPage() {
  await requireAdminScope();
  const [invoices, clients] = await Promise.all([
    getInvoicesForAdmin(),
    getBillingClients(),
  ]);

  return (
    <div className="space-y-6 max-w-6xl">
      <PageHeader
        eyebrow="Business"
        title="Invoices"
        description="Create and track invoices billed directly to your clients."
      >
        <CreateInvoiceDialog clients={clients} />
      </PageHeader>

      <InvoicesTable invoices={invoices} />
    </div>
  );
}
