import { useTranslation } from "react-i18next";

const Settings = () => {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{t("nav.settings")}</div>
        <h1 className="font-display text-3xl md:text-4xl mt-1">Preferences</h1>
        <p className="text-muted-foreground mt-2 max-w-prose">
          Use the language switcher and theme toggle in the top bar to customize your experience.
          More personalization options coming soon.
        </p>
      </div>
    </div>
  );
};

export default Settings;
