import type { ReactElement } from "react";
import { SSEDemo } from "../components/SSEDemo";

interface SSEDemoPageProps {
  params: Promise<{ userId: string }>;
}

export default async function SSEDemoPage(
  props: SSEDemoPageProps,
): Promise<ReactElement> {
  const { params } = props;
  const { userId } = await params;

  return <SSEDemo userId={userId} />;
}
