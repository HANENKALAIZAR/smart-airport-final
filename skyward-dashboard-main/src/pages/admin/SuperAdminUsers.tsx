import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Search,
  ShieldCheck,
  CheckCircle2,
  Clock,
  X,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  MapPin,
  BadgeCheck,
  LayoutGrid,
  Calendar,
  ArrowLeft,
  Mail,
  IdCard,
  Plane,
  Phone,
  User,
  AlertTriangle,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { AdminShell } from "@/components/admin/AdminShell";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/* ─────────────── Types & Data ─────────────── */

export type AdminStatus = "pending" | "approved" | "rejected" | "resubmitted";

type FieldGroup = "Personal" | "Identification" | "Travel" | "Contact";

export interface AdminField {
  key: string;
  label: string;
  value: string;
  type?: "text" | "image" | "date";
  group: FieldGroup;
}

export interface AdminSubmission {
  id: string;
  fullName: string;
  role: string;
  airport: string;
  email: string;
  submittedAt: string;
  status: AdminStatus;
  avatar: string;
  rejectionNote?: string;
  rejectedFields?: string[];
  fields: AdminField[];
}

const baseFields = (overrides: Partial<Record<string, string>> = {}): AdminField[] => [
  { key: "photo", label: "Profile Photo", value: overrides.photo ?? "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400", type: "image", group: "Personal" },
  { key: "dob", label: "Date of Birth", value: overrides.dob ?? "1989-04-12", type: "date", group: "Personal" },
  { key: "gender", label: "Gender", value: overrides.gender ?? "Female", group: "Personal" },
  { key: "nationality", label: "Nationality", value: overrides.nationality ?? "Tunisian", group: "Personal" },
  { key: "address", label: "Residential Address", value: overrides.address ?? "14 Avenue Habib Bourguiba, Tunis 1000", group: "Personal" },
  { key: "phone", label: "Phone Number", value: overrides.phone ?? "+216 22 145 880", group: "Contact" },
  { key: "cin", label: "CIN Number", value: overrides.cin ?? "08745621", group: "Identification" },
  { key: "cinDoc", label: "CIN Document", value: overrides.cinDoc ?? "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=600", type: "image", group: "Identification" },
  { key: "passport", label: "Passport Number", value: overrides.passport ?? "TN8842156", group: "Travel" },
  { key: "passportExp", label: "Passport Expiry", value: overrides.passportExp ?? "2031-08-22", type: "date", group: "Travel" },
  { key: "passportDoc", label: "Passport Document", value: overrides.passportDoc ?? "https://images.unsplash.com/photo-1569959220744-ff553533f492?w=600", type: "image", group: "Travel" },
  { key: "emergencyName", label: "Emergency Contact Name", value: overrides.emergencyName ?? "Karim Ben Salah", group: "Contact" },
  { key: "emergencyPhone", label: "Emergency Contact Phone", value: overrides.emergencyPhone ?? "+216 98 224 117", group: "Contact" },
];

const initialAdmins: AdminSubmission[] = [
  { id: "ADM-2401", fullName: "Leila Mansour", role: "Terminal Operations Admin", airport: "TUN — Tunis-Carthage Intl.", email: "l.mansour@avia.tn", submittedAt: "2025-04-21T09:24:00Z", status: "pending", avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200", fields: baseFields() },
  { id: "ADM-2402", fullName: "Youssef El Amri", role: "Security Checkpoint Admin", airport: "MIR — Habib Bourguiba", email: "y.elamri@avia.tn", submittedAt: "2025-04-20T14:02:00Z", status: "pending", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200", fields: baseFields({ photo: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400", dob: "1992-11-03", gender: "Male", nationality: "Tunisian", address: "Boulevard Zerktouni, Tunis", phone: "+216 22 332 014", cin: "BK998234", passport: "TN4421987", passportExp: "2029-02-14", emergencyName: "Salma El Amri", emergencyPhone: "+216 22 110 998" }) },
  { id: "ADM-2403", fullName: "Amina Toure", role: "Cargo Operations Admin", airport: "DJE — Djerba-Zarzis", email: "a.toure@avia.tn", submittedAt: "2025-04-19T11:48:00Z", status: "resubmitted", avatar: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=200", rejectionNote: "Passport document was unreadable and emergency phone format was invalid.", rejectedFields: ["passportDoc", "emergencyPhone"], fields: baseFields({ photo: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=400", dob: "1987-06-19", nationality: "Tunisian", address: "Plateau, Djerba", phone: "+216 77 884 2210", cin: "SN5523117", passport: "TN9821443", passportExp: "2030-12-01", emergencyName: "Moussa Toure", emergencyPhone: "+216 77 110 4488" }) },
  { id: "ADM-2404", fullName: "Hassan Bouzid", role: "Boarding Gate Admin", airport: "NBE — Enfidha-Hammamet", email: "h.bouzid@avia.tn", submittedAt: "2025-04-18T08:12:00Z", status: "approved", avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200", fields: baseFields({ photo: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400", gender: "Male", nationality: "Tunisian", address: "Hydra, Enfidha", phone: "+216 55 224 118" }) },
  { id: "ADM-2405", fullName: "Nadia Kassem", role: "Lounge Services Admin", airport: "TUN — Tunis-Carthage Intl.", email: "n.kassem@avia.tn", submittedAt: "2025-04-22T07:05:00Z", status: "pending", avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200", fields: baseFields({ photo: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400", nationality: "Tunisian", address: "Zamalek, Tunis", phone: "+216 21 884 1122", passportExp: "2026-01-09" }) },
];

/* ─────────────── Status helpers ─────────────── */

const STATUS_META: Record<
  AdminStatus,
  { label: string; tone: string; icon: typeof CheckCircle2 }
> = {
  pending:     { label: "Pending",     tone: "border-warning/40 bg-warning/10 text-warning",       icon: Clock },
  resubmitted: { label: "Resubmitted", tone: "border-primary/40 bg-primary/10 text-primary",       icon: RefreshCw },
  approved:    { label: "Verified",    tone: "border-success/40 bg-success/10 text-success",       icon: CheckCircle2 },
  rejected:    { label: "Rejected",    tone: "border-danger/40 bg-danger/10 text-danger",          icon: X },
};

const FILTERS: Array<{ key: "all" | AdminStatus; label: string }> = [
  { key: "all",         label: "All" },
  { key: "pending",     label: "Pending" },
  { key: "resubmitted", label: "Resubmitted" },
  { key: "approved",    label: "Verified" },
  { key: "rejected",    label: "Rejected" },
];

/* ─────────────── Status badge ─────────────── */

function StatusBadge({ status }: { status: AdminStatus }) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider", meta.tone)}>
      <Icon size={10} /> {meta.label}
    </span>
  );
}

/* ─────────────── Admin grid card ─────────────── */

function AdminCard({ admin, onClick }: { admin: AdminSubmission; onClick: () => void }) {
  return (
    <motion.button
      layout
      onClick={onClick}
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 280, damping: 24 }}
      className="glass-card group relative overflow-hidden p-5 text-left transition hover:border-primary/40"
    >
      <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-primary/10 blur-2xl opacity-60 transition-opacity group-hover:opacity-100" />
      <div className="relative flex items-start gap-4">
        <div className="relative">
          <img
            src={admin.avatar}
            alt={admin.fullName}
            className="h-14 w-14 rounded-xl object-cover ring-2 ring-border transition-colors group-hover:ring-primary/50"
          />
          <span
            className={cn(
              "absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-background",
              admin.status === "approved" ? "bg-success" :
              admin.status === "rejected" ? "bg-danger" :
              admin.status === "resubmitted" ? "bg-primary" : "bg-warning"
            )}
          />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold text-foreground">{admin.fullName}</h3>
          <p className="truncate text-xs text-muted-foreground">{admin.role}</p>
          <div className="mt-1 inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono-num text-[10px] font-bold tracking-wider text-primary">
            {admin.airport.split(" ")[0]}
          </div>
        </div>
      </div>

      <div className="relative mt-4 flex items-center gap-2 text-[11px] text-muted-foreground">
        <MapPin size={11} />
        <span className="truncate">{admin.airport.split("—")[1]?.trim() ?? admin.airport}</span>
      </div>

      <div className="relative mt-4 flex items-center justify-between gap-2 border-t border-border/60 pt-3">
        <StatusBadge status={admin.status} />
        <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground font-mono-num">
          <Calendar size={10} />
          {format(new Date(admin.submittedAt), "MMM d")}
        </span>
      </div>
    </motion.button>
  );
}

/* ─────────────── List item (split view) ─────────────── */

function AdminListItem({
  admin,
  active,
  onClick,
}: {
  admin: AdminSubmission;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      layout
      onClick={onClick}
      whileHover={{ x: 2 }}
      className={cn(
        "group relative w-full overflow-hidden rounded-xl border p-3 text-left transition-colors",
        active
          ? "border-primary/50 bg-primary/10"
          : "border-border bg-[hsl(var(--surface-2))]/60 hover:border-primary/30 hover:bg-[hsl(var(--surface-2))]"
      )}
    >
      {active && (
        <motion.div
          layoutId="adm-list-active"
          className="absolute left-0 top-1/2 h-9 w-1 -translate-y-1/2 rounded-r bg-primary shadow-glow"
        />
      )}
      <div className="flex items-start gap-3">
        <img
          src={admin.avatar}
          alt={admin.fullName}
          className={cn(
            "h-11 w-11 rounded-lg object-cover ring-2 transition-colors",
            active ? "ring-primary/60" : "ring-border"
          )}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="truncate text-sm font-semibold text-foreground">{admin.fullName}</h3>
            <ChevronRight
              size={14}
              className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
            />
          </div>
          <p className="truncate text-xs text-muted-foreground">{admin.role}</p>
          <div className="mt-1 inline-flex items-center gap-1 rounded border border-primary/30 bg-primary/10 px-1.5 py-0.5 font-mono-num text-[9px] font-bold tracking-wider text-primary">
            {admin.airport.split(" ")[0]}
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <StatusBadge status={admin.status} />
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {formatDistanceToNow(new Date(admin.submittedAt), { addSuffix: true })}
            </span>
          </div>
        </div>
      </div>
    </motion.button>
  );
}

/* ─────────────── Field card (with reject toggle) ─────────────── */

function FieldCard({
  field,
  isRejecting,
  isRejected,
  wasRejected,
  onToggle,
}: {
  field: AdminField;
  isRejecting: boolean;
  isRejected: boolean;
  wasRejected: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={cn(
        "relative rounded-xl border p-4 transition-colors",
        isRejected
          ? "border-danger/50 bg-danger/5"
          : wasRejected
            ? "border-primary/40 bg-primary/5"
            : "border-border bg-[hsl(var(--surface-2))]/50"
      )}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
          {field.label}
        </span>
        <div className="flex items-center gap-1.5">
          {wasRejected && !isRejecting && (
            <span className="rounded-md bg-primary/15 px-1.5 py-0.5 font-mono-num text-[9px] font-bold uppercase tracking-wider text-primary">
              Edited
            </span>
          )}
          {isRejecting && (
            <button
              onClick={onToggle}
              className={cn(
                "rounded-md border px-2 py-0.5 text-[10px] font-semibold transition-colors",
                isRejected
                  ? "border-danger bg-danger/15 text-danger"
                  : "border-border text-muted-foreground hover:border-danger/50 hover:text-danger"
              )}
            >
              {isRejected ? "Marked" : "Reject"}
            </button>
          )}
        </div>
      </div>
      {field.type === "image" ? (
        <div className="overflow-hidden rounded-lg border border-border bg-[hsl(var(--surface-3))]">
          <img src={field.value} alt={field.label} className="h-40 w-full object-cover" />
        </div>
      ) : (
        <p className="break-words font-mono-num text-sm text-foreground">{field.value}</p>
      )}
    </div>
  );
}

/* ─────────────── Detail view ─────────────── */

function ReviewDetail({
  admin,
  onApprove,
  onReject,
  onBack,
}: {
  admin: AdminSubmission;
  onApprove: (id: string) => void;
  onReject: (id: string, fields: string[], note: string) => void;
  onBack: () => void;
}) {
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectedFields, setRejectedFields] = useState<string[]>([]);
  const [note, setNote] = useState("");

  const wasRejected = (key: string) => admin.rejectedFields?.includes(key) ?? false;

  const grouped = useMemo(() => {
    const map: Record<FieldGroup, AdminField[]> = { Personal: [], Identification: [], Travel: [], Contact: [] };
    admin.fields.forEach((f) => map[f.group].push(f));
    return map;
  }, [admin]);

  const groupIcons: Record<FieldGroup, typeof User> = {
    Personal: User,
    Identification: IdCard,
    Travel: Plane,
    Contact: Phone,
  };

  const toggleReject = (key: string) =>
    setRejectedFields((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  const submitReject = () => {
    if (rejectedFields.length === 0) return;
    onReject(admin.id, rejectedFields, note.trim());
    setIsRejecting(false);
    setRejectedFields([]);
    setNote("");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="space-y-4"
    >
      {/* Hero header */}
      <div className="glass-card relative overflow-hidden p-6">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/15 blur-3xl" />
        <button
          onClick={onBack}
          className="mb-4 inline-flex items-center gap-1 rounded-md border border-border bg-[hsl(var(--surface-2))]/60 px-2 py-1 text-[11px] font-medium text-muted-foreground hover:border-primary/40 hover:text-foreground lg:hidden"
        >
          <ArrowLeft size={12} /> Back
        </button>
        <div className="relative flex flex-wrap items-start gap-5">
          <img
            src={admin.avatar}
            alt={admin.fullName}
            className="h-20 w-20 rounded-2xl object-cover ring-2 ring-primary/40 shadow-glow"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-bold text-foreground">{admin.fullName}</h2>
              <StatusBadge status={admin.status} />
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">{admin.role}</p>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs">
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <MapPin size={12} className="text-primary" /> {admin.airport}
              </span>
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <Mail size={12} className="text-primary" /> {admin.email}
              </span>
              <span className="inline-flex items-center gap-1.5 text-muted-foreground font-mono-num">
                <Calendar size={12} className="text-primary" />
                Submitted {format(new Date(admin.submittedAt), "MMM d, yyyy 'at' HH:mm")}
              </span>
              <span className="inline-flex items-center gap-1.5 text-muted-foreground font-mono-num">
                <ShieldCheck size={12} className="text-primary" /> {admin.id}
              </span>
            </div>
          </div>
        </div>

        {admin.status === "resubmitted" && admin.rejectionNote && (
          <div className="relative mt-5 flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3.5">
            <RefreshCw size={16} className="mt-0.5 shrink-0 text-primary" />
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-primary">Previous rejection</p>
              <p className="mt-1 text-sm text-foreground/90">{admin.rejectionNote}</p>
            </div>
          </div>
        )}
      </div>

      {/* Field groups */}
      {(Object.keys(grouped) as FieldGroup[]).map((group) => {
        const items = grouped[group];
        if (items.length === 0) return null;
        const Icon = groupIcons[group];
        return (
          <div key={group} className="glass-card p-5">
            <div className="mb-4 flex items-center gap-2 border-b border-border/60 pb-3">
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
                <Icon size={14} />
              </div>
              <h3 className="font-display text-sm font-semibold text-foreground">{group} Information</h3>
              <span className="ml-auto font-mono-num text-[10px] uppercase tracking-wider text-muted-foreground">
                {items.length} fields
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {items.map((f) => (
                <FieldCard
                  key={f.key}
                  field={f}
                  isRejecting={isRejecting}
                  isRejected={rejectedFields.includes(f.key)}
                  wasRejected={wasRejected(f.key)}
                  onToggle={() => toggleReject(f.key)}
                />
              ))}
            </div>
          </div>
        );
      })}

      {/* Reject panel */}
      <AnimatePresence>
        {isRejecting && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="glass-card border-danger/40 p-5">
              <div className="mb-3 flex items-center gap-2">
                <AlertTriangle size={16} className="text-danger" />
                <h4 className="font-display text-sm font-semibold text-foreground">Rejection details</h4>
              </div>
              <p className="mb-3 text-xs text-muted-foreground">
                Mark each field that needs correction above, then add a single explanatory note.
              </p>
              <div className="mb-3 rounded-lg border border-border bg-[hsl(var(--surface-2))]/60 px-3 py-2 text-[11px] text-muted-foreground">
                <span className="font-bold text-foreground">{rejectedFields.length}</span>{" "}
                field{rejectedFields.length === 1 ? "" : "s"} marked for rejection.
              </div>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Explain what needs to be corrected…"
                rows={4}
                className="w-full resize-none rounded-lg border border-border bg-[hsl(var(--surface-2))]/60 p-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/50"
              />
              <div className="mt-3 flex justify-end gap-2">
                <button
                  onClick={() => {
                    setIsRejecting(false);
                    setRejectedFields([]);
                    setNote("");
                  }}
                  className="h-9 rounded-lg border border-border bg-[hsl(var(--surface-2))] px-4 text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  onClick={submitReject}
                  disabled={rejectedFields.length === 0}
                  className="h-9 rounded-lg bg-gradient-danger px-4 text-xs font-semibold text-white shadow-glow disabled:opacity-50"
                >
                  Send rejection
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action bar */}
      {!isRejecting && (admin.status === "pending" || admin.status === "resubmitted") && (
        <div className="glass-card sticky bottom-4 flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="text-xs text-muted-foreground">
            Cross-check identity documents before approving.
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsRejecting(true)}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-danger/40 bg-danger/10 px-4 text-xs font-semibold text-danger transition-colors hover:bg-danger/20"
            >
              <X size={14} /> Reject…
            </button>
            <button
              onClick={() => onApprove(admin.id)}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-gradient-success px-5 text-xs font-bold text-white shadow-glow transition hover:opacity-95"
            >
              <CheckCircle2 size={14} /> Approve & verify
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}

/* ─────────────── Filter dropdown ─────────────── */

function FilterDropdown({
  icon,
  label,
  value,
  active,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "group inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
            active
              ? "border-primary bg-primary/15 text-primary shadow-glow"
              : "border-border bg-[hsl(var(--surface-2))]/60 text-muted-foreground hover:border-primary/40 hover:text-foreground"
          )}
        >
          <span className={cn(active ? "text-primary" : "text-muted-foreground")}>{icon}</span>
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] opacity-80">{label}</span>
          <span className="max-w-[160px] truncate text-foreground">{value}</span>
          <ChevronDown size={13} className="opacity-60 transition-transform group-data-[state=open]:rotate-180" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-[320px] min-w-[240px] overflow-y-auto">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ─────────────── Stat card ─────────────── */

function StatCard({
  label,
  value,
  tone,
  icon: Icon,
}: {
  label: string;
  value: number;
  tone: "warning" | "primary" | "success";
  icon: typeof CheckCircle2;
}) {
  const styles: Record<typeof tone, { fg: string; border: string; glow: string }> = {
    warning: { fg: "text-warning", border: "border-warning/30", glow: "bg-warning/10" },
    primary: { fg: "text-primary", border: "border-primary/30", glow: "bg-primary/10" },
    success: { fg: "text-success", border: "border-success/30", glow: "bg-success/10" },
  } as const;
  const s = styles[tone];
  return (
    <div className={cn("glass-card relative flex items-center justify-between overflow-hidden p-5", s.border)}>
      <div className={cn("absolute -right-8 -top-8 h-24 w-24 rounded-full blur-2xl", s.glow)} />
      <div className="relative">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
        <p className={cn("mt-1 font-mono-num text-3xl font-bold", s.fg)}>{value}</p>
      </div>
      <div className={cn("relative grid h-11 w-11 place-items-center rounded-xl border", s.border, s.glow, s.fg)}>
        <Icon size={18} />
      </div>
    </div>
  );
}

/* ─────────────── Main page ─────────────── */

export default function SuperAdminUsers() {
  const [admins, setAdmins] = useState<AdminSubmission[]>(initialAdmins);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  const [airportFilter, setAirportFilter] = useState<string>("all");
  const [query, setQuery] = useState("");

  const airports = useMemo(
    () => Array.from(new Set(admins.map((a) => a.airport))).sort(),
    [admins]
  );

  const filtered = useMemo(
    () =>
      admins.filter((a) => {
        const matchesFilter = filter === "all" ? true : a.status === filter;
        const matchesAirport = airportFilter === "all" ? true : a.airport === airportFilter;
        const q = query.toLowerCase();
        const matchesQuery =
          !q ||
          a.fullName.toLowerCase().includes(q) ||
          a.id.toLowerCase().includes(q) ||
          a.airport.toLowerCase().includes(q) ||
          a.email.toLowerCase().includes(q);
        return matchesFilter && matchesAirport && matchesQuery;
      }),
    [admins, filter, airportFilter, query]
  );

  const active = admins.find((a) => a.id === activeId) ?? null;

  const counts = useMemo(
    () => ({
      pending: admins.filter((a) => a.status === "pending").length,
      resubmitted: admins.filter((a) => a.status === "resubmitted").length,
      approved: admins.filter((a) => a.status === "approved").length,
    }),
    [admins]
  );

  const handleApprove = (id: string) => {
    setAdmins((prev) =>
      prev.map((a) =>
        a.id === id
          ? { ...a, status: "approved", rejectedFields: [], rejectionNote: undefined }
          : a
      )
    );
  };

  const handleReject = (id: string, fieldKeys: string[], note: string) => {
    setAdmins((prev) =>
      prev.map((a) =>
        a.id === id ? { ...a, status: "rejected", rejectedFields: fieldKeys, rejectionNote: note } : a
      )
    );
  };

  return (
    <AdminShell
      title="Admin Verification"
      subtitle="Review submitted credentials and grant access to the operations network."
      actions={
        active ? (
          <button
            onClick={() => setActiveId(null)}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-[hsl(var(--surface-2))]/60 px-3 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
          >
            <LayoutGrid size={13} /> Back to grid
          </button>
        ) : null
      }
    >
      {/* Stat strip */}
      <div className="mb-2 grid gap-3 sm:grid-cols-3">
        <StatCard label="Awaiting Review" value={counts.pending} tone="warning" icon={Clock} />
        <StatCard label="Resubmitted" value={counts.resubmitted} tone="primary" icon={RefreshCw} />
        <StatCard label="Verified" value={counts.approved} tone="success" icon={CheckCircle2} />
      </div>

      {/* Search + filters */}
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[260px] flex-1">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, ID, email or airport…"
            className="h-10 w-full rounded-lg border border-border bg-[hsl(var(--surface-2))]/60 pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/50"
          />
        </div>

        <FilterDropdown
          icon={<MapPin size={13} />}
          label="Airport"
          value={airportFilter === "all" ? "All Airports" : airportFilter.split(" — ")[0]}
          active={airportFilter !== "all"}
        >
          <DropdownMenuLabel className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Filter by airport
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setAirportFilter("all")} className={cn(airportFilter === "all" && "text-primary")}>
            All Airports
          </DropdownMenuItem>
          {airports.map((ap) => (
            <DropdownMenuItem
              key={ap}
              onClick={() => setAirportFilter(ap)}
              className={cn(airportFilter === ap && "text-primary")}
            >
              {ap}
            </DropdownMenuItem>
          ))}
        </FilterDropdown>

        <FilterDropdown
          icon={<BadgeCheck size={13} />}
          label="Verification"
          value={FILTERS.find((f) => f.key === filter)?.label ?? "All"}
          active={filter !== "all"}
        >
          <DropdownMenuLabel className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Filter by status
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {FILTERS.map((f) => (
            <DropdownMenuItem
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(filter === f.key && "text-primary")}
            >
              {f.label}
            </DropdownMenuItem>
          ))}
        </FilterDropdown>

        {(filter !== "all" || airportFilter !== "all" || query) && (
          <button
            onClick={() => {
              setFilter("all");
              setAirportFilter("all");
              setQuery("");
            }}
            className="rounded-full border border-border bg-[hsl(var(--surface-2))]/60 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-danger/40 hover:text-danger"
          >
            Clear filters
          </button>
        )}

        <span className="ml-auto font-mono-num text-[10px] uppercase tracking-wider text-muted-foreground">
          {filtered.length} results
        </span>
      </div>

      <div className="mt-5">
        <AnimatePresence mode="wait">
          {!active ? (
            <motion.div
              key="grid"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              layout
              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            >
              {filtered.length === 0 ? (
                <div className="col-span-full rounded-xl border border-dashed border-border bg-[hsl(var(--surface-2))]/40 p-12 text-center">
                  <p className="text-sm text-muted-foreground">No admins match this view.</p>
                </div>
              ) : (
                filtered.map((admin) => (
                  <AdminCard key={admin.id} admin={admin} onClick={() => setActiveId(admin.id)} />
                ))
              )}
            </motion.div>
          ) : (
            <motion.div
              key="split"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="grid gap-5 lg:grid-cols-[340px_1fr]"
            >
              <aside className="hidden flex-col gap-2 lg:flex">
                <p className="px-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                  Queue · {filtered.length}
                </p>
                <div className="flex max-h-[calc(100vh-260px)] flex-col gap-2 overflow-y-auto pr-1">
                  {filtered.map((admin) => (
                    <AdminListItem
                      key={admin.id}
                      admin={admin}
                      active={admin.id === active.id}
                      onClick={() => setActiveId(admin.id)}
                    />
                  ))}
                </div>
              </aside>
              <section>
                <ReviewDetail
                  admin={active}
                  onApprove={handleApprove}
                  onReject={handleReject}
                  onBack={() => setActiveId(null)}
                />
              </section>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AdminShell>
  );
}
