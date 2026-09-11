import { SettingsPanel, type SettingsPanelProps } from "./SettingsPanel";

export function SettingsSidebar(props: SettingsPanelProps) {
  return (
    <aside className="mx-auto mt-8 hidden w-full max-w-[220px] flex-col items-center justify-center lg:mx-0 lg:mt-0 lg:flex lg:max-w-[240px] lg:justify-self-center lg:pl-6">
      <SettingsPanel {...props} />
    </aside>
  );
}
