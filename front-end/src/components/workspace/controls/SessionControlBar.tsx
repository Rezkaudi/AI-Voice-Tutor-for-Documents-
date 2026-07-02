import { useSessionStore } from "@/store/sessionStore";
import { CallControls } from "./CallControls";
import { SettingsMenu } from "./SettingsMenu";
import { StartCallButton } from "./StartCallButton";

interface SessionControlBarProps {
  large?: boolean;
  showMenu?: boolean;
}

export function SessionControlBar({ large = false, showMenu = true }: SessionControlBarProps) {
  const callMode = useSessionStore((s) => s.callMode);

  return (
    <>
      {showMenu ? <SettingsMenu large={large} /> : null}
      {callMode ? <CallControls large={large} /> : <StartCallButton large={large} />}
    </>
  );
}
