import type { ReactNode } from "react";

import { colors } from "../theme";

interface AppShellProps {
  channels: ReactNode;
  composer: ReactNode;
  messages: ReactNode;
  users: ReactNode;
}

export function AppShell({
  channels,
  composer,
  messages,
  users,
}: AppShellProps) {
  return (
    <box flexGrow={1} padding={1} backgroundColor={colors.appBackground}>
      <box
        flexGrow={1}
        border
        borderStyle="rounded"
        borderColor={colors.border}
        flexDirection="row"
        backgroundColor={colors.panelBackground}
      >
        {channels}
        <box flexGrow={1} flexDirection="column">
          {users}
          {messages}
          {composer}
        </box>
      </box>
    </box>
  );
}
