import type { Metadata } from "next";
import ChatWorkspace from "./ChatWorkspace";

export const metadata: Metadata = {
  title: "AI Chatbot",
};

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  return <ChatWorkspace initialQuery={q ?? ""} />;
}
