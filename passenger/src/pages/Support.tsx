import { useTranslation } from "react-i18next";
import { LifeBuoy, MessageCircle, Phone, Mail } from "lucide-react";

const Support = () => {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{t("nav.support")}</div>
        <h1 className="font-display text-3xl md:text-4xl mt-1">{t("support_title", "We're here for you")}</h1>
      </div>
      <div className="grid md:grid-cols-3 gap-4">
        {[
          { icon: MessageCircle, titleKey: "support_chat", title: "Live chat", bodyKey: "support_chat_body", body: "Average response under 2 minutes." },
          { icon: Phone, titleKey: "support_call", title: "Call us", bodyKey: "support_call_body", body: "24/7 multilingual passenger hotline." },
          { icon: Mail, titleKey: "support_email", title: "Email", bodyKey: "support_email_body", body: "support@smartairport.tn — replies within 4h." },
        ].map((c) => (
          <div key={c.titleKey} className="surface-card rounded-xl p-6">
            <div className="grid place-items-center h-11 w-11 rounded-xl bg-primary/10 text-primary"><c.icon className="h-5 w-5" /></div>
            <h3 className="mt-4 font-display text-xl">{t(c.titleKey, c.title)}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{t(c.bodyKey, c.body)}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Support;
