import type { ReactElement } from "react";
import { SSEDemo } from "./components/SSEDemo";

interface SSEDemoPageProps {
  searchParams: Promise<{ user_id?: string }>;
}

export default async function SSEDemoPage(
  props: SSEDemoPageProps,
): Promise<ReactElement> {
  const { searchParams } = props;
  const { user_id } = await searchParams;

  return <SSEDemo userId={user_id} />;
}
