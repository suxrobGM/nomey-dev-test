"use client";

import { useEventSource } from "@/features/sse";
import { Button } from "@/shared/components/ui/button";
import type { ReactElement } from "react";

interface SSEDemoProps {
  userId: string;
}

export function SSEDemo(props: SSEDemoProps): ReactElement {
  const { userId } = props;
  const { connected, lastData, error, connect, disconnect } = useEventSource(
    `/api/sse/${userId}`,
    {
      enabled: false,
      on: {
        open: () => {
          console.log(`SSE connection opened`);
        },
        message: (data) => {
          console.log(`Received SSE message:`, data);
        },
        connected: (data) => {
          console.log(`SSE connected:`, data);
        },
      },
    },
  );

  return (
    <div className="flex flex-col items-center gap-4 p-4">
      <p>User ID: {userId}</p>
      <p>Status: {connected ? "🟢" : "🔴"}</p>
      <p>Last Message: {lastData ? JSON.stringify(lastData) : "n/a"}</p>
      <Button onClick={connected ? disconnect : connect}>
        {connected ? "Disconnect" : "Connect"}
      </Button>
      {error && <small>Check console/network</small>}
    </div>
  );
}
