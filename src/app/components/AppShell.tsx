import type { ReactNode } from "react";

import { colors } from "../theme";

interface AppShellProps {
  channels: ReactNode;
  composer: ReactNode;
  messages: ReactNode;
  users: ReactNode;
  statusBar?: ReactNode;
}

export function AppShell({
  channels,
  composer,
  messages,
  users,
  statusBar,
}: AppShellProps) {
  return (
    <box
      flexGrow={1}
      backgroundColor={colors.appBackground}
      flexDirection="column"
    >
      <box
        flexGrow={1}
        flexDirection="row"
        backgroundColor={colors.appBackground}
      >
        {channels}
        <box
          flexGrow={1}
          flexDirection="column"
          backgroundColor={colors.panelBackground}
        >
          {messages}
          {composer}
        </box>
        {users}
      </box>
      <box height={1} backgroundColor={colors.appBackground} />
      {statusBar}
    </box>
  );
}
