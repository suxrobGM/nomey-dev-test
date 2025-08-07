"use client";

import { useEventSource, type SSEvents } from "@/features/sse";
import { Button } from "@/shared/components/ui/button";
import { useEffect, type ReactElement } from "react";

interface SSEDemoProps {
  userId?: string;
}

export function SSEDemo(props: SSEDemoProps): ReactElement {
  const { userId } = props;
  const { state, connect, disconnect, subscribe } = useEventSource<SSEvents>(
    `/api/sse${userId ? `?user_id=${userId}` : ""}`,
  );

  useEffect(() => {
    subscribe("connected", (data) => {
      console.log("Subscribed to 'connected' event:", data);
    });

    subscribe("message", (data, ev) => {
      console.log("Received message:", data, "Event:", ev);
    });

    subscribe("open", () => {
      console.log("Connection opened");
    });
  }, [subscribe]);

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
