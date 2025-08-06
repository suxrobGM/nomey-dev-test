"use client";

import { useEventSource } from "@/features/sse";
import { Button } from "@/shared/components/ui/button";
import type { ReactElement } from "react";

interface SSEDemoProps {
  userId: string;
}

export function SSEDemo(props: SSEDemoProps): ReactElement {
  const { userId } = props;
  const { state, connect, disconnect } = useEventSource(`/api/sse/${userId}`, {
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
  });

  return (
    <div className="flex flex-col items-center gap-4 p-4">
      <p>User ID: {userId}</p>
      <p>Status: {state.connected ? "🟢" : "🔴"}</p>
      <p>
        Last Message: {state.lastData ? JSON.stringify(state.lastData) : "n/a"}
      </p>
      <Button onClick={state.connected ? disconnect : connect}>
        {state.connected ? "Disconnect" : "Connect"}
      </Button>
      {state.error && <small>Check console/network</small>}
    </div>
  );
}
