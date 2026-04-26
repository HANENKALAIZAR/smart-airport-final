import { Search, Plane } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { Button } from "./ui/button";
import { useNavigate } from "react-router-dom";
import { getFlights } from "@/services/api";
import { motion } from "framer-motion";

export function FlightSearchBar() {
  const { t } = useTranslation();
  const [q, setQ]           = useState("");
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!q.trim()) return;
    setLoading(true);
    const flights = await getFlights({ search: q.trim(), limit: 20 });
    setLoading(false);
    if (flights.length > 0) nav(`/flights/${flights[0].id}`);
    else nav("/flights");
  };

  return (
    <motion.form
      onSubmit={submit}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="relative flex items-center gap-2 p-2 rounded-2xl border border-border bg-card/80 backdrop-blur-xl shadow-md"
    >
      <div className="grid place-items-center h-11 w-11 rounded-xl bg-primary/10 text-primary shrink-0">
        <Plane className="h-4 w-4 rtl-flip rotate-[-35deg]" />
      </div>
      <div className="flex-1">
        <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          {t("common.searchFlight")}
        </div>
        <input
          value={q}
          onChange={e => setQ(e.target.value.toUpperCase())}
          placeholder="AF 1681 · EK 203 · BA 117"
          className="w-full bg-transparent border-0 outline-none text-base font-mono tracking-wide placeholder:text-muted-foreground/50"
        />
      </div>
      <Button type="submit" disabled={loading}
        className="rounded-xl gap-2 h-11 px-5 bg-foreground text-background hover:bg-foreground/90">
        <Search className="h-4 w-4" />
        <span className="hidden sm:inline">{loading ? "..." : t("common.track")}</span>
      </Button>
    </motion.form>
  );
}
