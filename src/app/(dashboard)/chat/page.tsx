import { PageHeader } from "@/components/page-header";
import { getDefaultModelIdForPurpose } from "@/app/actions/model-config";
import { openRouterProvider } from "@/lib/ai/providers/openrouter";
import { ChatInterface } from "./chat-interface";

export default async function ChatPage() {
  const [defaultModel, models] = await Promise.all([
    getDefaultModelIdForPurpose("chat"),
    openRouterProvider.listModels("text"),
  ]);

  return (
    <div className="flex flex-col h-[calc(100dvh-theme(spacing.16))]">
      <PageHeader eyebrow="AI Tools" title="Chat" />

      <div className="flex-1 min-h-0 mt-4">
        <ChatInterface defaultModel={defaultModel ?? ""} models={models} />
      </div>
    </div>
  );
}
