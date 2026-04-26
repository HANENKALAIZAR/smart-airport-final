import { Bell, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { ThemeToggle } from "./ThemeToggle";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { notifications } from "@/data/mockFlights";

export function TopBar() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const unread = notifications.filter((n) => n.unread).length;

  return (
    <header className="sticky top-0 z-30 h-16 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="h-full flex items-center gap-3 px-4 md:px-6">
        <SidebarTrigger className="h-9 w-9 rounded-full hover:bg-secondary" />

        <div className="hidden md:flex items-center flex-1 max-w-xl ms-2">
          <div className="relative w-full">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("common.search")}
              className="ps-10 h-10 rounded-full bg-secondary/60 border-transparent focus-visible:bg-background focus-visible:border-border"
            />
          </div>
        </div>

        <div className="ms-auto flex items-center gap-1">
          <LanguageSwitcher />
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => nav("/notifications")}
            className="relative h-9 w-9 rounded-full hover:bg-secondary"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
            {unread > 0 && (
              <span className="absolute top-1.5 end-1.5 h-2 w-2 rounded-full bg-primary ring-2 ring-background" />
            )}
          </Button>
          <div className="ms-2 h-9 w-9 rounded-full bg-gradient-amber grid place-items-center text-primary-foreground text-xs font-semibold shadow-amber">
            AM
          </div>
        </div>
      </div>
    </header>
  );
}
