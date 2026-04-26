import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Plane,
  MapPinned,
  Bell,
  LifeBuoy,
  Settings,
  Sparkles,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import logoUrl from "@/assets/logo.png";

export function AppSidebar() {
  const { t } = useTranslation();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();

  const items = [
    { to: "/app", label: t("nav.dashboard"), icon: LayoutDashboard, end: true },
    { to: "/flights", label: t("nav.flights"), icon: Plane },
    { to: "/services", label: t("nav.services"), icon: MapPinned },
    { to: "/notifications", label: t("nav.notifications"), icon: Bell },
    { to: "/support", label: t("nav.support"), icon: LifeBuoy },
    { to: "/settings", label: t("nav.settings"), icon: Settings },
  ];

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="px-4 py-5">
        <div className="flex items-center gap-3">
          <img
            src={logoUrl}
            alt="Logo"
            className={cn("w-auto object-contain shrink-0", collapsed ? "h-8" : "h-10")}
          />
          {!collapsed && (
            <div className="text-[10px] uppercase tracking-[0.18em] text-sidebar-foreground/60 leading-tight">
              Smart Airport
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {items.map((item) => {
                const active = item.end ? pathname === item.to : pathname.startsWith(item.to);
                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton asChild tooltip={item.label} className="h-10">
                      <NavLink
                        to={item.to}
                        end={item.end}
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-3 transition-colors",
                          "text-sidebar-foreground/75 hover:text-sidebar-foreground hover:bg-sidebar-accent",
                          active &&
                            "bg-sidebar-accent text-sidebar-foreground relative before:absolute before:start-0 before:top-2 before:bottom-2 before:w-1 before:rounded-full before:bg-primary"
                        )}
                      >
                        <item.icon className="h-[18px] w-[18px] shrink-0" />
                        {!collapsed && <span className="text-sm">{item.label}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {!collapsed && (
        <SidebarFooter className="p-3">
          <div className="rounded-xl bg-sidebar-accent/60 border border-sidebar-border p-3">
            <div className="flex items-center gap-2 text-xs text-sidebar-foreground/70">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span className="font-medium uppercase tracking-wider">Smart AI</span>
            </div>
            <p className="mt-2 text-xs text-sidebar-foreground/60 leading-relaxed">
              Predictive insights & smart alerts for your journey.
            </p>
          </div>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
