import { useTranslation } from "react-i18next";
import { LifeBuoy, MessageCircle, Phone, Mail } from "lucide-react";

const Support = () => {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{t("nav.support")}</div>
        <h1 className="font-display text-3xl md:text-4xl mt-1">We're here for you</h1>
      </div>
      <div className="grid md:grid-cols-3 gap-4">
        {[
          { icon: MessageCircle, title: "Live chat", body: "Average response under 2 minutes." },
          { icon: Phone, title: "Call us", body: "24/7 multilingual passenger hotline." },
          { icon: Mail, title: "Email", body: "support@smartairport.tn — replies within 4h." },
        ].map((c) => (
          <div key={c.title} className="surface-card rounded-xl p-6">
            <div className="grid place-items-center h-11 w-11 rounded-xl bg-primary/10 text-primary"><c.icon className="h-5 w-5" /></div>
            <h3 className="mt-4 font-display text-xl">{c.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{c.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Support;
