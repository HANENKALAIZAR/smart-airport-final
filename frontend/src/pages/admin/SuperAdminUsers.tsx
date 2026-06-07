import { useMemo, useState, useEffect, useCallback, useRef } from "react";
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
  Plus,
  Trash2,
  Loader2,
  Archive,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { AdminShell } from "@/components/admin/AdminShell";
import { cn } from "@/components/admin/ui/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/admin/ui/dropdown-menu";
import { useLanguage } from "../../context/LanguageContext";
import { TUNISIAN_AIRPORTS } from "../../context/AirportContext";
import {
  apiListAdmins,
  apiCreateAdmin,
  apiDeleteAdmin,
  apiSuggestEmail,
  apiCheckDuplicate,
  apiCheckEmail,
  apiGetAdminReview,
  apiPostIdReview,
  apiToggleProfileEdit,
  apiReopenVerification,
  apiArchiveAdmin,
  apiPermanentlyRejectAdmin,
} from "../../services/adminApi";

/* ─────────────── Types & Data ─────────────── */

export type AdminStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "resubmitted"
  | "expired"
  | "archived"
  | "permanently_rejected";

type FieldGroup = "Personal" | "Identification" | "Travel" | "Contact";

export interface AdminField {
  key: string;
  label: string;
  value: string;
  type?: "text" | "image" | "date";
  group: FieldGroup;
}

export interface AdminSubmission {
  id: number;
  displayId: string;
  fullName: string;
  role: string;
  airport: string;
  airportIata: string;
  email: string;
  personalEmail: string;
  submittedAt: string;
  status: AdminStatus;
  avatar: string;
  rejectionNote?: string;
  rejectedFields?: string[];
  profile_edit_unlocked?: boolean;
  profile_unlock_identity?: boolean;
  profile_unlock_passport?: boolean;
  profile_unlock_cin_doc?: boolean;
  profile_unlock_contact?: boolean;
}

const AVATAR_POOL = [
  "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200",
  "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=200",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200",
  "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200",
];

/* ─────────────── Status helpers ─────────────── */

const STATUS_META: Record<
  AdminStatus,
  { label: string; tone: string; icon: typeof CheckCircle2 }
> = {
  pending:     { label: "Pending",     tone: "border-warning/40 bg-warning/10 text-warning",       icon: Clock },
  resubmitted: { label: "Resubmitted", tone: "border-amber/40 bg-amber/10 text-amber",       icon: RefreshCw },
  approved:    { label: "Verified",    tone: "border-success/40 bg-success/10 text-success",       icon: CheckCircle2 },
  rejected:    { label: "Rejected",    tone: "border-danger/40 bg-danger/10 text-danger",          icon: X },
  expired:     { label: "Expired",     tone: "border-rose-500/40 bg-rose-500/10 text-rose-500",    icon: AlertTriangle },
  archived:    { label: "Archived",    tone: "border-slate-500/40 bg-slate-500/10 text-slate-400", icon: Archive },
  permanently_rejected: { label: "Perm Rejected", tone: "border-rose-700/40 bg-rose-700/10 text-rose-600", icon: X },
};

const FILTERS: Array<{ key: "all" | AdminStatus; label: string }> = [
  { key: "all",         label: "All" },
  { key: "pending",     label: "Pending" },
  { key: "resubmitted", label: "Resubmitted" },
  { key: "approved",    label: "Verified" },
  { key: "rejected",    label: "Rejected" },
  { key: "expired",     label: "Expired" },
  { key: "archived",    label: "Archived" },
  { key: "permanently_rejected", label: "Perm Rejected" },
];

/* ─────────────── Status badge ─────────────── */

function StatusBadge({ status }: { status: AdminStatus }) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider", meta.tone)}>
      <Icon size={10} className={status === "resubmitted" ? "animate-spin" : ""} /> {meta.label}
    </span>
  );
}

/* ─────────────── Admin grid card ─────────────── */

function AdminCard({ admin, onClick }: { admin: AdminSubmission; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="glass-card group relative bg-gradient-to-br from-navy-mid to-navy-deep backdrop-blur-md border border-white/5 overflow-hidden p-5 text-left transition-all duration-300 hover:border-amber/40 hover:-translate-y-1 hover:shadow-lg"
    >
      <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-amber/10 blur-2xl opacity-60 transition-opacity duration-300 group-hover:opacity-100" />
      <div className="relative flex items-start gap-4">
        <div className="relative">
          <img
            src={admin.avatar}
            alt={admin.fullName}
            className="h-14 w-14 rounded-xl object-cover ring-2 ring-border transition-colors duration-300 group-hover:ring-amber/50"
          />
          <span
            className={cn(
              "absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-background",
              admin.status === "approved" ? "bg-success" :
              admin.status === "rejected" ? "bg-danger" :
              admin.status === "resubmitted" ? "bg-amber" :
              admin.status === "expired" ? "bg-rose-500" :
              admin.status === "archived" ? "bg-slate-500" :
              admin.status === "permanently_rejected" ? "bg-rose-800" : "bg-warning"
            )}
          />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold text-foreground">{admin.fullName}</h3>
          <p className="truncate text-xs text-white/60">{admin.role}</p>
          <div className="mt-1 inline-flex items-center gap-1.5 rounded-md border border-amber/30 bg-amber/10 px-2 py-0.5 font-mono-num text-[10px] font-bold tracking-wider text-amber">
            {admin.airportIata}
          </div>
        </div>
      </div>

      <div className="relative mt-4 flex items-center gap-2 text-[11px] text-white/60">
        <MapPin size={11} />
        <span className="truncate">{admin.airport.includes("—") ? admin.airport.split("—")[1]?.trim() : admin.airport}</span>
      </div>

      <div className="relative mt-4 flex items-center justify-between gap-2 border-t border-border/60 pt-3">
        <StatusBadge status={admin.status} />
        <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-white/60 font-mono-num">
          <Calendar size={10} />
          {format(new Date(admin.submittedAt), "MMM d")}
        </span>
      </div>
    </button>
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
    <button
      onClick={onClick}
      className={cn(
        "sa-queue-item group relative w-full flex items-center gap-[12px] min-h-[72px] rounded-[16px] border p-[12px_14px] text-left transition-all duration-[180ms] ease-in-out",
        active
          ? "active border-amber/50 bg-amber/10"
          : "border-border bg-navy-mid/60 backdrop-blur-md hover:border-amber/30 hover:bg-navy-mid"
      )}
    >
      {active && (
        <div className="sa-queue-indicator absolute left-0 top-1/2 h-9 w-1 -translate-y-1/2 rounded-r bg-amber shadow-[0_0_15px_oklch(0.78_0.16_75/0.15)]" />
      )}
      <img
        src={admin.avatar}
        alt={admin.fullName}
        className={cn(
          "sa-queue-avatar shrink-0 h-[48px] w-[48px] rounded-[14px] object-cover ring-1 transition-colors duration-[180ms]",
          active ? "ring-amber/60" : "ring-border"
        )}
      />
      <div className="min-w-0 flex-1 flex flex-col justify-center">
        <h3 className="sa-queue-name truncate text-[14px] font-bold text-foreground leading-tight">{admin.fullName}</h3>
        <p className="sa-queue-role truncate text-[11px] text-white/60 mt-0.5">{admin.role}</p>
      </div>
      <ChevronRight
        size={16}
        className="sa-queue-arrow shrink-0 text-white/60 transition-all duration-[180ms] group-hover:translate-x-[2px]"
      />
    </button>
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
        "sa-field-card relative rounded-xl border p-4 transition-colors duration-250",
        isRejected
          ? "border-danger/50 bg-danger/5"
          : wasRejected
            ? "border-amber/40 bg-amber/5"
            : "border-border bg-navy-mid/50 backdrop-blur-md"
      )}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <span className="sa-field-label text-[10px] font-bold uppercase tracking-[0.16em] text-white/60">
          {field.label}
        </span>
        <div className="flex items-center gap-1.5">
          {wasRejected && !isRejecting && (
            <span className="rounded-md bg-amber/15 px-1.5 py-0.5 font-mono-num text-[9px] font-bold uppercase tracking-wider text-amber">
              Edited
            </span>
          )}
          {isRejecting && (
            <button
              onClick={onToggle}
              className={cn(
                "rounded-md border px-2 py-0.5 text-[10px] font-semibold transition-colors duration-150",
                isRejected
                  ? "border-danger bg-danger/15 text-danger"
                  : "border-border text-white/60 hover:border-danger/50 hover:text-danger"
              )}
            >
              {isRejected ? "Marked" : "Reject"}
            </button>
          )}
        </div>
      </div>
      {field.type === "image" ? (
        <div className="overflow-hidden rounded-lg border border-border bg-navy-deep">
          <img src={field.value} alt={field.label} className="h-40 w-full object-cover" />
        </div>
      ) : (
        <p className="sa-field-value break-words font-mono-num text-sm text-foreground">{field.value}</p>
      )}
    </div>
  );
}

/* ─────────────── Detail view ─────────────── */

function ReviewDetail({
  admin,
  reviewDetail,
  reviewLoading,
  onApprove,
  onReject,
  onBack,
  onDeleteRequest,
  onToggleEdit,
  onReopenVerification,
  onArchiveAdmin,
  onPermanentlyRejectAdmin,
}: {
  admin: AdminSubmission;
  reviewDetail: any;
  reviewLoading: boolean;
  onApprove: (id: number) => void;
  onReject: (id: number, fields: string[], note: string) => void;
  onBack: () => void;
  onDeleteRequest: (admin: AdminSubmission) => void;
  onToggleEdit: (userId: number, section: string, currentUnlock: boolean) => void;
  onReopenVerification: (id: number) => void;
  onArchiveAdmin: (id: number) => void;
  onPermanentlyRejectAdmin: (id: number) => void;
}) {
  const { t } = useLanguage();
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectedFields, setRejectedFields] = useState<string[]>([]);
  const [note, setNote] = useState("");

  const wasRejected = (key: string) => {
    if (!reviewDetail || !reviewDetail.rejected_fields) return false;
    return reviewDetail.rejected_fields.includes(key);
  };

  const reviewFields = useMemo(() => {
    if (!reviewDetail) return [];
    return [
      { key: "fullName", label: "Full Name", value: reviewDetail.full_name || "—", group: "Personal" },
      { key: "dob", label: "Date of Birth", value: reviewDetail.date_of_birth ? String(reviewDetail.date_of_birth).slice(0, 10) : "—", type: "date", group: "Personal" },
      { key: "gender", label: "Gender", value: reviewDetail.gender || "—", group: "Personal" },
      { key: "nationality", label: "Nationality", value: reviewDetail.nationality || "—", group: "Personal" },
      { key: "address", label: "Residential Address", value: reviewDetail.residential_address || "—", group: "Personal" },
      
      { key: "phone", label: "Phone Number", value: reviewDetail.phone_number || "—", group: "Contact" },
      { key: "emergencyName", label: "Emergency Contact Name", value: reviewDetail.emergency_contact_name || "—", group: "Contact" },
      { key: "emergencyPhone", label: "Emergency Contact Phone", value: reviewDetail.emergency_contact_phone || "—", group: "Contact" },
      { key: "emergencyRelationship", label: "Emergency Relationship", value: reviewDetail.emergency_contact_relationship || "—", group: "Contact" },
      
      { key: "cin", label: "CIN Number", value: reviewDetail.cin_number || "—", group: "Identification" },
      { key: "cinDoc", label: "CIN Front Document", value: reviewDetail.cin_document_url || "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=600", type: "image", group: "Identification" },
      { key: "cinDocBack", label: "CIN Back Document", value: reviewDetail.cin_document_back_url || "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=600", type: "image", group: "Identification" },
      
      { key: "passport", label: "Passport Number", value: reviewDetail.passport_number || "—", group: "Travel" },
      { key: "passportExp", label: "Passport Expiry", value: reviewDetail.passport_expiry_date ? String(reviewDetail.passport_expiry_date).slice(0, 10) : "—", type: "date", group: "Travel" },
      { key: "passportDoc", label: "Passport Document", value: reviewDetail.passport_document_url || "https://images.unsplash.com/photo-1569959220744-ff553533f492?w=600", type: "image", group: "Travel" }
    ] as AdminField[];
  }, [reviewDetail]);

  const grouped = useMemo(() => {
    const map: Record<FieldGroup, AdminField[]> = { Personal: [], Identification: [], Travel: [], Contact: [] };
    reviewFields.forEach((f) => map[f.group].push(f));
    return map;
  }, [reviewFields]);

  const groupIcons: Record<FieldGroup, typeof User> = {
    Personal: User,
    Identification: IdCard,
    Travel: Plane,
    Contact: Phone,
  };

  const toggleReject = (key: string) =>
    setRejectedFields((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  const submitReject = () => {
    if (rejectedFields.length === 0 || !note.trim()) return;
    onReject(admin.id, rejectedFields, note.trim());
    setIsRejecting(false);
    setRejectedFields([]);
    setNote("");
  };

  return (
    <div className="space-y-4 transition-all duration-300">
      {/* Hero header */}
      <div className="glass-card relative overflow-hidden p-6">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-amber/15 blur-3xl" />
        
        <div className="mb-4 flex items-center justify-between">
          <button
            onClick={onBack}
            className="sa-back-btn inline-flex items-center gap-1 rounded-md border border-border bg-navy-mid/60 backdrop-blur-md px-2 py-1 text-[11px] font-medium text-white/60 hover:border-amber/40 hover:text-foreground lg:hidden"
          >
            <ArrowLeft size={12} /> {t('back') || 'Back'}
          </button>
          
          {localStorage.getItem('admin_role') === 'super_admin' && (
            <div className="ml-auto flex items-center gap-2">
              {reviewDetail && admin.status !== "expired" && admin.status !== "archived" && admin.status !== "permanently_rejected" && (
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => onToggleEdit(admin.id, 'identity', !!reviewDetail.profile_unlock_identity)}
                    className={cn(
                      "inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition cursor-pointer",
                      reviewDetail.profile_unlock_identity
                        ? "border-amber/55 bg-amber/20 text-amber hover:bg-amber/30"
                        : "border-white/10 bg-white/5 text-white/70 hover:border-white/20 hover:bg-white/10"
                    )}
                  >
                    <ShieldCheck size={12} />
                    {reviewDetail.profile_unlock_identity ? "Lock Identity" : "Unlock Identity"}
                  </button>
                  <button
                    onClick={() => onToggleEdit(admin.id, 'passport', !!reviewDetail.profile_unlock_passport)}
                    className={cn(
                      "inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition cursor-pointer",
                      reviewDetail.profile_unlock_passport
                        ? "border-amber/55 bg-amber/20 text-amber hover:bg-amber/30"
                        : "border-white/10 bg-white/5 text-white/70 hover:border-white/20 hover:bg-white/10"
                    )}
                  >
                    <ShieldCheck size={12} />
                    {reviewDetail.profile_unlock_passport ? "Lock Passport" : "Unlock Passport"}
                  </button>
                  <button
                    onClick={() => onToggleEdit(admin.id, 'cin_doc', !!reviewDetail.profile_unlock_cin_doc)}
                    className={cn(
                      "inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition cursor-pointer",
                      reviewDetail.profile_unlock_cin_doc
                        ? "border-amber/55 bg-amber/20 text-amber hover:bg-amber/30"
                        : "border-white/10 bg-white/5 text-white/70 hover:border-white/20 hover:bg-white/10"
                    )}
                  >
                    <ShieldCheck size={12} />
                    {reviewDetail.profile_unlock_cin_doc ? "Lock CIN Doc" : "Unlock CIN Doc"}
                  </button>
                  <button
                    onClick={() => onToggleEdit(admin.id, 'contact', !!reviewDetail.profile_unlock_contact)}
                    className={cn(
                      "inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition cursor-pointer",
                      reviewDetail.profile_unlock_contact
                        ? "border-amber/55 bg-amber/20 text-amber hover:bg-amber/30"
                        : "border-white/10 bg-white/5 text-white/70 hover:border-white/20 hover:bg-white/10"
                    )}
                  >
                    <ShieldCheck size={12} />
                    {reviewDetail.profile_unlock_contact ? "Lock Contact" : "Unlock Contact"}
                  </button>
                </div>
              )}
              
              <button
                onClick={() => onDeleteRequest(admin)}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-danger/30 bg-danger/10 px-3 text-[11px] font-semibold text-danger transition hover:border-danger/60 hover:bg-danger/15 cursor-pointer"
              >
                <Trash2 size={12} /> {t('admin_users_delete_admin') || 'Delete Admin'}
              </button>
            </div>
          )}
        </div>

        <div className="relative flex flex-wrap items-start gap-5">
          <img
            src={admin.avatar}
            alt={admin.fullName}
            className="h-20 w-20 rounded-2xl object-cover ring-2 ring-amber/40 shadow-[0_0_15px_oklch(0.78_0.16_75/0.15)]"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-bold text-foreground">{admin.fullName}</h2>
              <StatusBadge status={admin.status} />
            </div>
            <p className="sa-subtext mt-0.5 text-sm text-white/60">{admin.role}</p>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs">
              <span className="sa-subtext inline-flex items-center gap-1.5 text-white/60">
                <MapPin size={12} className="text-amber" /> {admin.airport}
              </span>
              <span className="sa-subtext inline-flex items-center gap-1.5 text-white/60">
                <Mail size={12} className="text-amber" /> {admin.email}
              </span>
              <span className="sa-subtext inline-flex items-center gap-1.5 text-white/60 font-mono-num">
                <Calendar size={12} className="text-amber" />
                {t('admin_users_submitted') || 'Submitted'} {format(new Date(admin.submittedAt), "MMM d, yyyy 'at' HH:mm")}
              </span>
              <span className="sa-subtext inline-flex items-center gap-1.5 text-white/60 font-mono-num">
                <ShieldCheck size={12} className="text-amber" /> {admin.displayId}
              </span>
            </div>
          </div>
        </div>

        {admin.status === "resubmitted" && admin.rejectionNote && (
          <div className="relative mt-5 flex items-start gap-3 rounded-xl border border-amber/30 bg-amber/5 p-3.5">
            <RefreshCw size={16} className="mt-0.5 shrink-0 text-amber animate-spin" />
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-amber">{t('admin_users_previous_rejection') || 'Previous rejection'}</p>
              <p className="mt-1 text-sm text-foreground/90">{admin.rejectionNote}</p>
            </div>
          </div>
        )}
      </div>

      {reviewLoading ? (
        <div className="glass-card flex flex-col items-center justify-center py-16 text-center">
          <Loader2 size={36} className="animate-spin text-amber mb-3" />
          <p className="sa-subtext text-sm text-white/60 font-medium">{t('admin_users_retrieving_credentials') || 'Retrieving verification credentials…'}</p>
        </div>
      ) : !reviewDetail ? (
        <div className="glass-card flex flex-col items-center justify-center py-16 text-center">
          <AlertTriangle size={36} className="text-warning mb-3" />
          <p className="sa-subtext text-sm text-white/60 font-medium">{t('admin_users_no_onboarding') || "Admin hasn't completed onboarding profile yet."}</p>
        </div>
      ) : (
        <>
          {/* Field groups */}
          {(Object.keys(grouped) as FieldGroup[]).map((group) => {
            const items = grouped[group];
            if (items.length === 0) return null;
            const Icon = groupIcons[group];
            return (
              <div key={group} className="glass-card p-5">
                <div className="mb-4 flex items-center gap-2 border-b border-border/60 pb-3">
                  <div className="grid h-8 w-8 place-items-center rounded-lg bg-amber/10 text-amber">
                    <Icon size={14} />
                  </div>
                  <h3 className="sa-group-header font-display text-sm font-semibold text-foreground">{group} {t('admin_users_information') || 'Information'}</h3>
                  <span className="sa-group-subtext ml-auto font-mono-num text-[10px] uppercase tracking-wider text-white/60">
                    {items.length} {t('admin_users_fields_suffix') || 'fields'}
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
          {isRejecting && (
            <div className="glass-card border-danger/40 p-5 transition-all duration-350 overflow-hidden">
              <div className="mb-3 flex items-center gap-2">
                <AlertTriangle size={16} className="text-danger" />
                <h4 className="font-display text-sm font-semibold text-foreground">{t('admin_users_rejection_details') || 'Rejection details'}</h4>
              </div>
              <p className="mb-3 text-xs text-white/60 font-medium">
                {t('admin_users_rejection_instructions') || 'Mark each incorrect field above, then write a detailed explanation note.'}
              </p>
              <div className="mb-3 rounded-lg border border-border bg-navy-mid/60 backdrop-blur-md px-3 py-2 text-[11px] text-white/60 font-medium">
                <span className="font-bold text-white">{rejectedFields.length}</span>{" "}
                {rejectedFields.length === 1 ? (t('admin_users_field_singular') || 'field') : (t('admin_users_field_plural') || 'fields')} {t('admin_users_marked_rejection') || 'marked for rejection.'}
              </div>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t('admin_users_rejection_placeholder') || 'Describe what corrections are required…'}
                rows={4}
                className="w-full resize-none rounded-lg border border-slate-700 bg-navy-deep p-3 text-sm text-white placeholder:text-slate-400 outline-none transition-colors duration-250 focus:border-amber focus:ring-1 focus:ring-amber"
              />
              <div className="mt-3 flex justify-end gap-2">
                <button
                  onClick={() => {
                    setIsRejecting(false);
                    setRejectedFields([]);
                    setNote("");
                  }}
                  className="h-9 rounded-lg border border-border bg-navy-mid px-4 text-xs font-medium text-white/60 hover:text-foreground"
                >
                  {t('cancel') || 'Cancel'}
                </button>
                <button
                  onClick={submitReject}
                  disabled={rejectedFields.length === 0 || !note.trim()}
                  className="h-9 rounded-lg bg-gradient-danger px-4 text-xs font-semibold text-white shadow-[0_0_15px_oklch(0.78_0.16_75/0.15)] disabled:opacity-40"
                >
                  {t('admin_users_send_rejection') || 'Send rejection'}
                </button>
              </div>
            </div>
          )}

          {/* Action bar */}
          {!isRejecting && (admin.status === "pending" || admin.status === "resubmitted") && (
            <div className="glass-card sticky bottom-4 flex flex-wrap items-center justify-between gap-3 p-4 z-10 bg-navy-deep/90 backdrop-blur-lg backdrop-blur">
              <p className="text-xs text-white/60 font-medium">
                {t('admin_users_verify_identity_note') || 'Verify identity documentation before approving airport system permissions.'}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsRejecting(true)}
                  className="inline-flex h-10 items-center gap-2 rounded-lg border border-danger/40 bg-danger/10 px-4 text-xs font-semibold text-danger transition-colors duration-250 hover:bg-danger/20"
                >
                  <X size={14} /> {t('admin_users_reject') || 'Reject…'}
                </button>
                <button
                  onClick={() => onApprove(admin.id)}
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-gradient-success px-5 text-xs font-bold text-white shadow-[0_0_15px_oklch(0.78_0.16_75/0.15)] transition duration-250 hover:opacity-95"
                >
                  <CheckCircle2 size={14} /> {t('admin_users_approve_verify') || 'Approve & verify'}
                </button>
              </div>
            </div>
          )}

          {admin.status === "expired" && (
            <div className="glass-card sticky bottom-4 flex flex-wrap items-center justify-between gap-3 p-4 z-10 bg-navy-deep/90 backdrop-blur-lg backdrop-blur">
              <p className="text-xs text-white/60 font-medium">
                This verification request has expired. Select an administrative action.
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => onReopenVerification(admin.id)}
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-gradient-success px-4 text-xs font-bold text-white shadow-[0_0_15px_oklch(0.78_0.16_75/0.15)] transition duration-250 hover:opacity-95 cursor-pointer"
                >
                  <RefreshCw size={14} /> Reopen Verification
                </button>
                <button
                  onClick={() => onArchiveAdmin(admin.id)}
                  className="inline-flex h-10 items-center gap-2 rounded-lg border border-amber/40 bg-amber/10 px-4 text-xs font-semibold text-amber transition-colors duration-250 hover:bg-amber/20 cursor-pointer"
                >
                  <Archive size={14} /> Archive Account
                </button>
                <button
                  onClick={() => onPermanentlyRejectAdmin(admin.id)}
                  className="inline-flex h-10 items-center gap-2 rounded-lg border border-danger/40 bg-danger/10 px-4 text-xs font-semibold text-danger transition-colors duration-250 hover:bg-danger/20 cursor-pointer"
                >
                  <AlertTriangle size={14} /> Permanently Reject
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
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
            "sa-filter-btn group inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all duration-250",
            active
              ? "active border-amber bg-amber/15 text-amber shadow-[0_0_15px_oklch(0.78_0.16_75/0.15)]"
              : "border-border bg-navy-mid/60 backdrop-blur-md text-white/60 hover:border-amber/40 hover:text-foreground"
          )}
        >
          <span className={cn("sa-filter-icon", active ? "text-amber" : "text-white/60")}>{icon}</span>
          <span className="sa-filter-label text-[10px] font-bold uppercase tracking-[0.18em] opacity-80">{label}</span>
          <span className="sa-filter-value max-w-[160px] truncate text-foreground">{value}</span>
          <ChevronDown size={13} className="sa-filter-chevron opacity-60 transition-transform duration-250 group-data-[state=open]:rotate-180" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="sa-filter-menu max-h-[320px] z-[9999] min-w-[240px] overflow-y-auto bg-navy-deep border border-amber/20 shadow-xl shadow-[0_0_15px_rgba(245,158,11,0.1)] p-1 text-slate-100">
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
  tone: "warning" | "primary" | "success" | "danger";
  icon: typeof CheckCircle2;
}) {
  const styles = {
    warning: { fg: "text-warning", border: "border-warning/30", glow: "bg-warning/10" },
    primary: { fg: "text-amber", border: "border-amber/30", glow: "bg-amber/10" },
    success: { fg: "text-success", border: "border-success/30", glow: "bg-success/10" },
    danger: { fg: "text-danger", border: "border-danger/30", glow: "bg-danger/10" },
  };
  const s = styles[tone];
  return (
    <div className={cn("glass-card relative flex bg-gradient-to-br from-navy-mid to-navy-deep backdrop-blur-md border border-white/5 items-center justify-between overflow-hidden p-5", s.border)}>
      <div className={cn("absolute -right-8 -top-8 h-24 w-24 rounded-full blur-2xl", s.glow)} />
      <div className="relative">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/60">{label}</p>
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
  const { t } = useLanguage();
  const [admins, setAdmins] = useState<AdminSubmission[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  const [airportFilter, setAirportFilter] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewDetail, setReviewDetail] = useState<any>(null);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  /* Invite form */
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", workEmail: "", personalEmail: "", airport: "TUN" });
  const [workEmailStatus, setWorkEmailStatus] = useState<"checking" | "available" | "taken" | null>(null);
  const [workEmailWarning, setWorkEmailWarning] = useState("");
  const [workEmailEdited, setWorkEmailEdited] = useState(false);
  const [dupState, setDupState] = useState<"idle" | "checking" | "warning" | "bypassed">("idle");
  const [dupInfo, setDupInfo] = useState<any>(null);
  const [bypassDuplicate, setBypassDuplicate] = useState(false);

  /* Delete & Toast states */
  const [deleteConfirm, setDeleteConfirm] = useState<AdminSubmission | null>(null);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    msg: string;
    title?: string;
    details?: string;
    loginId?: string;
  } | null>(null);

  const emailRef = useRef<any>(null);
  const nameRef = useRef<any>(null);

  const showToast = useCallback((
    type: "success" | "error",
    msg: string,
    title?: string,
    details?: string,
    loginId?: string
  ) => {
    setToast({ type, msg, title, details, loginId });
    setTimeout(() => setToast(null), 7000); // Expanded timer to allow reading detailed multi-line toast
  }, []);

  const airportLabel = (iata: string) => {
    const ap = TUNISIAN_AIRPORTS.find((a) => a.iata === iata);
    return ap ? `${ap.iata} — ${ap.name}` : iata;
  };

  /* Fetch Admins */
  const fetchAdmins = useCallback(async () => {
    setLoading(true);
    const { data, error } = await apiListAdmins();
    setLoading(false);
    if (error) {
      showToast("error", `Could not load admins: ${error}`);
      return;
    }

    const formatted = (data || []).map((u: any) => {
      const status: AdminStatus =
        u.verification_status === "expired_verification" ? "expired" :
        u.verification_status === "archived" ? "archived" :
        u.verification_status === "permanently_rejected" ? "permanently_rejected" :
        u.verification_status === "approved" || u.verification_status === "verified" ? "approved" :
        u.verification_status === "rejected" || u.verification_status === "correction_required" ? "rejected" :
        u.verification_status === "resubmitted" ? "resubmitted" : "pending";

      return {
        id: u.id,
        displayId: `ADM-${String(u.id).padStart(4, "0")}`,
        fullName: u.full_name || "Unnamed Admin",
        role: u.profile_complete ? "Operations Admin" : "Onboarding Admin",
        airport: airportLabel(u.airport_iata || ""),
        airportIata: u.airport_iata || "—",
        email: u.email || "",
        personalEmail: u.personal_email || "",
        submittedAt: u.created_at || new Date().toISOString(),
        status,
        avatar: u.profile_photo_url || AVATAR_POOL[u.id % AVATAR_POOL.length],
        rejectionNote: u.rejection_reason || undefined,
        rejectedFields: u.rejected_fields || undefined,
        profile_edit_unlocked: !!u.profile_edit_unlocked,
        profile_unlock_identity: !!u.profile_unlock_identity,
        profile_unlock_passport: !!u.profile_unlock_passport,
        profile_unlock_cin_doc: !!u.profile_unlock_cin_doc,
        profile_unlock_contact: !!u.profile_unlock_contact,
      };
    });
    setAdmins(formatted);
  }, [showToast]);

  useEffect(() => {
    fetchAdmins();
  }, [fetchAdmins]);

  /* Load Review Details */
  useEffect(() => {
    if (activeId === null) {
      setReviewDetail(null);
      return;
    }
    const loadReview = async () => {
      setReviewLoading(true);
      const { data, error } = await apiGetAdminReview(Number(activeId));
      setReviewLoading(false);
      if (error) {
        showToast("error", `Failed to retrieve credentials: ${error}`);
        setActiveId(null);
        return;
      }
      setReviewDetail(data);
    };
    loadReview();
  }, [activeId, showToast]);

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
          a.displayId.toLowerCase().includes(q) ||
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
      expired: admins.filter((a) => a.status === "expired").length,
    }),
    [admins]
  );

  /* Approve Submission */
  const handleApprove = async (id: number) => {
    setReviewSubmitting(true);
    const { error } = await apiPostIdReview(id, "approve", undefined, []);
    setReviewSubmitting(false);
    if (error) {
      showToast("error", `Approval failed: ${error}`);
      return;
    }
    showToast("success", "ID credentials successfully verified & approved.");
    setActiveId(null);
    await fetchAdmins();
  };

  /* Reject Submission */
  const handleReject = async (id: number, fields: string[], reason: string) => {
    const keyMap: Record<string, string> = {
      fullName: "full_name",
      dob: "date_of_birth",
      gender: "gender",
      nationality: "nationality",
      address: "residential_address",
      phone: "phone_number",
      cin: "cin_number",
      cinDoc: "cin_document_url",
      cinDocBack: "cin_document_back_url",
      passport: "passport_number",
      passportExp: "passport_expiry_date",
      passportDoc: "passport_document_url",
      emergencyName: "emergency_contact_name",
      emergencyPhone: "emergency_contact_phone",
      emergencyRelationship: "emergency_contact_relationship"
    };

    const databaseFields = fields.map(f => keyMap[f] || f);

    setReviewSubmitting(true);
    const { error } = await apiPostIdReview(id, "reject", reason, databaseFields);
    setReviewSubmitting(false);
    if (error) {
      showToast("error", `Rejection failed: ${error}`);
      return;
    }
    showToast("success", "Credentials rejected. Modification request sent to admin.");
    setActiveId(null);
    await fetchAdmins();
  };

  /* Delete Account */
  const handleDelete = async (target: AdminSubmission) => {
    const { error } = await apiDeleteAdmin(target.id);
    if (error) {
      showToast("error", `Deletion failed: ${error}`);
    } else {
      showToast("success", `Admin account '${target.fullName}' deleted successfully.`);
      setActiveId(null);
      await fetchAdmins();
    }
    setDeleteConfirm(null);
  };

  const handleToggleEdit = useCallback(async (userId: number, section: string, currentUnlock: boolean) => {
    const nextUnlock = !currentUnlock;
    setReviewSubmitting(true);
    const { data, error } = await apiToggleProfileEdit(userId, nextUnlock, section);
    setReviewSubmitting(false);
    if (error) {
      showToast("error", `Failed to toggle profile edit: ${error}`);
      return;
    }
    showToast("success", data?.message || `Profile edit unlock status updated.`);
    const key = `profile_unlock_${section}` as any;
    setReviewDetail((prev: any) => {
      if (prev && prev.id === userId) {
        const updated = { ...prev, [key]: nextUnlock };
        updated.profile_edit_unlocked = !!(
          updated.profile_unlock_identity ||
          updated.profile_unlock_passport ||
          updated.profile_unlock_cin_doc ||
          updated.profile_unlock_contact
        );
        return updated;
      }
      return prev;
    });
    setAdmins((prev) =>
      prev.map((a) => {
        if (a.id === userId) {
          const updated = { ...a, [key]: nextUnlock };
          updated.profile_edit_unlocked = !!(
            updated.profile_unlock_identity ||
            updated.profile_unlock_passport ||
            updated.profile_unlock_cin_doc ||
            updated.profile_unlock_contact
          );
          return updated;
        }
        return a;
      })
    );
  }, [showToast]);

  /* Reopen Verification */
  const handleReopenVerification = useCallback(async (userId: number) => {
    setReviewSubmitting(true);
    const { error } = await apiReopenVerification(userId);
    setReviewSubmitting(false);
    if (error) {
      showToast("error", `Failed to reopen verification: ${error}`);
      return;
    }
    showToast("success", "Verification reopened. Admin has been notified.");
    setActiveId(null);
    setReviewDetail(null);
    await fetchAdmins();
  }, [showToast, fetchAdmins]);

  /* Archive Admin Account */
  const handleArchiveAdmin = useCallback(async (userId: number) => {
    if (!window.confirm("Are you sure you want to archive this administrator account? This will set the account status to archived and deactivate their login.")) {
      return;
    }
    setReviewSubmitting(true);
    const { error } = await apiArchiveAdmin(userId);
    setReviewSubmitting(false);
    if (error) {
      showToast("error", `Failed to archive account: ${error}`);
      return;
    }
    showToast("success", "Account successfully archived.");
    setActiveId(null);
    setReviewDetail(null);
    await fetchAdmins();
  }, [showToast, fetchAdmins]);

  /* Permanently Reject Admin */
  const handlePermanentlyRejectAdmin = useCallback(async (userId: number) => {
    if (!window.confirm("Are you sure you want to permanently reject this administrator? This action is irreversible and the account will be deactivated.")) {
      return;
    }
    setReviewSubmitting(true);
    const { error } = await apiPermanentlyRejectAdmin(userId);
    setReviewSubmitting(false);
    if (error) {
      showToast("error", `Failed to permanently reject: ${error}`);
      return;
    }
    showToast("success", "Admin has been permanently rejected and deactivated.");
    setActiveId(null);
    setReviewDetail(null);
    await fetchAdmins();
  }, [showToast, fetchAdmins]);

  /* Email availability check */
  const checkWorkEmail = useCallback((email: string) => {
    clearTimeout(emailRef.current);
    if (!email || !email.includes("@")) {
      setWorkEmailStatus(null);
      return;
    }
    setWorkEmailStatus("checking");
    emailRef.current = setTimeout(async () => {
      const { data } = await apiCheckEmail(email);
      setWorkEmailStatus(data?.available ? "available" : "taken");
    }, 500);
  }, []);

  /* Generate email suggestion */
  const suggestWorkEmail = useCallback(async (name: string, airport: string) => {
    if (!name.trim() || !airport) return;
    setWorkEmailStatus("checking");
    setWorkEmailWarning("");
    const { data, error } = await apiSuggestEmail(name, airport);
    if (error || !data) {
      setWorkEmailStatus(null);
      return;
    }
    const suggested = data.email;
    const primary = data.all_suggestions?.[0] || "";
    setForm((f) => ({ ...f, workEmail: suggested }));
    if (data.is_fallback && primary && primary.toLowerCase() !== suggested.toLowerCase()) {
      setWorkEmailWarning(`${primary} taken — fallback: ${suggested}`);
    }
    const { data: avail } = await apiCheckEmail(suggested);
    setWorkEmailStatus(avail?.available ? "available" : "taken");
  }, []);

  /* Duplicate name check */
  const checkDuplicate = useCallback((name: string, airport: string) => {
    clearTimeout(nameRef.current);
    if (!name.trim() || name.length < 3) {
      setDupState("idle");
      return;
    }
    setDupState("checking");
    nameRef.current = setTimeout(async () => {
      const { data } = await apiCheckDuplicate(name, airport);
      if (data?.duplicate) {
        setDupState("warning");
        setDupInfo(data.existing);
      } else {
        setDupState("idle");
        setDupInfo(null);
      }
    }, 500);
  }, []);

  const handleNameChange = (name: string) => {
    setForm((f) => ({ ...f, name }));
    setWorkEmailEdited(false);
    setBypassDuplicate(false);
    setDupState("idle");
    checkDuplicate(name, form.airport);
    if (!workEmailEdited) suggestWorkEmail(name, form.airport);
  };

  const handleAirportChange = (airport: string) => {
    setForm((f) => ({ ...f, airport }));
    if (!workEmailEdited && form.name.trim()) suggestWorkEmail(form.name, airport);
  };

  const handleWorkEmailChange = (email: string) => {
    setForm((f) => ({ ...f, workEmail: email }));
    setWorkEmailEdited(true);
    checkWorkEmail(email);
  };

  const personalOk = useMemo(() => {
    return form.personalEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.personalEmail);
  }, [form.personalEmail]);

  const canSubmit = useMemo(() => {
    return (
      form.name.trim() &&
      form.workEmail.trim() &&
      form.personalEmail.trim() &&
      personalOk &&
      workEmailStatus === "available" &&
      dupState !== "checking" &&
      (dupState !== "warning" || bypassDuplicate) &&
      !saving
    );
  }, [form, personalOk, workEmailStatus, dupState, bypassDuplicate, saving]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    const { data, error } = await apiCreateAdmin({
      full_name: form.name.trim(),
      airport_iata: form.airport,
      work_email: form.workEmail.trim(),
      personal_email: form.personalEmail.trim(),
      bypass_duplicate: bypassDuplicate,
    });
    setSaving(false);
    if (error) {
      showToast("error", `Invitation error: ${error}`);
      return;
    }
    showToast(
      "success",
      `Admin account created! Credentials sent to: ${form.personalEmail.trim()} (Login ID: ${data.email})`,
      "Admin Account Created Successfully",
      `Invitation credentials have been dispatched to: ${form.personalEmail.trim()}`,
      data.email
    );
    setModalOpen(false);
    await fetchAdmins();
  };

  return (
    <AdminShell
      title={t('admin_users_title') || 'Admin Verification'}
      subtitle={t('admin_users_subtitle') || 'Review submitted credentials and grant access to the operations network.'}
      actions={
        <div className="flex items-center gap-2">
          {active ? (
            <button
              onClick={() => {
                setActiveId(null);
                setReviewDetail(null);
              }}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-navy-mid/60 backdrop-blur-md px-3 text-xs font-medium text-white/60 transition-all duration-250 hover:border-amber/40 hover:text-amber"
            >
              <LayoutGrid size={13} /> {t('admin_users_back_to_grid') || 'Back to grid'}
            </button>
          ) : (
            <button
              onClick={() => {
                setModalOpen(true);
                setBypassDuplicate(false);
                setDupState("idle");
                setWorkEmailStatus(null);
                setWorkEmailWarning("");
                setForm({ name: "", workEmail: "", personalEmail: "", airport: TUNISIAN_AIRPORTS[0]?.iata || "TUN" });
              }}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-amber px-4 text-xs font-semibold text-navy-deep transition-colors hover:bg-amber/95 shadow-[0_0_15px_oklch(0.78_0.16_75/0.15)]"
            >
              <Plus size={14} /> {t('admin_users_invite_admin') || 'Invite Admin'}
            </button>
          )}
        </div>
      }
    >
      {/* Stat strip */}
      <div className="mb-2 grid gap-3 sm:grid-cols-4">
        <StatCard label={t('admin_users_awaiting_review') || 'Awaiting Review'} value={counts.pending} tone="warning" icon={Clock} />
        <StatCard label={t('admin_users_resubmitted') || 'Resubmitted'} value={counts.resubmitted} tone="primary" icon={RefreshCw} />
        <StatCard label={t('admin_users_verified') || 'Verified'} value={counts.approved} tone="success" icon={CheckCircle2} />
        <StatCard label="Expired" value={counts.expired} tone="danger" icon={AlertTriangle} />
      </div>

      {/* Search + filters */}
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[260px] flex-1">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/60" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('admin_users_search_label') || 'Search by name, ID, email or airport…'}
            className="h-10 w-full rounded-lg border border-slate-700 bg-navy-deep pl-9 pr-3 text-sm text-white outline-none transition-colors duration-250 placeholder:text-slate-400 focus:border-amber focus:ring-1 focus:ring-amber"
          />
        </div>

        <FilterDropdown
          icon={<MapPin size={13} />}
          label={t('admin_users_airport_filter') || 'Airport'}
          value={airportFilter === "all" ? (t('admin_users_all_airports') || 'All Airports') : airportFilter.split(" — ")[0]}
          active={airportFilter !== "all"}
        >
          <DropdownMenuLabel className="sa-filter-menu-label text-[10px] uppercase tracking-[0.2em] text-white/60 font-semibold">
            {t('admin_users_verification_filter_by_airport') || 'Filter by airport'}
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="sa-filter-separator" />
          <DropdownMenuItem onClick={() => setAirportFilter("all")} className={cn("sa-filter-item cursor-pointer focus:bg-amber/10 focus:text-amber hover:bg-amber/10 hover:text-amber transition-colors", airportFilter === "all" ? "active text-amber bg-amber/10 font-semibold" : "text-slate-300")}>
            {t('admin_users_all_airports') || 'All Airports'}
          </DropdownMenuItem>
          {airports.map((ap) => (
            <DropdownMenuItem
              key={ap}
              onClick={() => setAirportFilter(ap)}
              className={cn("sa-filter-item cursor-pointer focus:bg-amber/10 focus:text-amber hover:bg-amber/10 hover:text-amber transition-colors", airportFilter === ap ? "active text-amber bg-amber/10 font-semibold" : "text-slate-300")}
            >
              {ap}
            </DropdownMenuItem>
          ))}
        </FilterDropdown>

        <FilterDropdown
          icon={<BadgeCheck size={13} />}
          label={t('admin_users_verification_filter') || 'Verification'}
          value={FILTERS.find((f) => f.key === filter)?.label ?? (t('admin_users_all') || 'All')}
          active={filter !== "all"}
        >
          <DropdownMenuLabel className="sa-filter-menu-label text-[10px] uppercase tracking-[0.2em] text-white/60 font-semibold">
            {t('admin_users_verification_filter_by_status') || 'Filter by status'}
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="sa-filter-separator" />
          {FILTERS.map((f) => (
            <DropdownMenuItem
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn("sa-filter-item cursor-pointer focus:bg-amber/10 focus:text-amber hover:bg-amber/10 hover:text-amber transition-colors", filter === f.key ? "active text-amber bg-amber/10 font-semibold" : "text-slate-300")}
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
            className="sa-clear-filters rounded-full border border-border bg-navy-mid/60 backdrop-blur-md px-3 py-1.5 text-xs font-medium text-white/60 transition-colors duration-250 hover:border-danger/40 hover:text-danger"
          >
            {t('admin_users_clear_filters') || 'Clear filters'}
          </button>
        )}

        <span className="ml-auto font-mono-num text-[10px] uppercase tracking-wider text-white/60 font-medium">
          {filtered.length} {t('admin_users_results_suffix') || 'results'}
        </span>
      </div>

      {/* Main lists/splits */}
      <div className="mt-5">
        {loading ? (
          <div className="glass-card flex flex-col items-center justify-center py-20 text-center">
            <Loader2 size={40} className="animate-spin text-amber mb-3" />
            <p className="text-sm text-white/60 font-medium">{t('loading') || 'Loading…'}</p>
          </div>
        ) : !active ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 transition-all duration-300">
            {filtered.length === 0 ? (
              <div className="col-span-full rounded-xl border border-dashed border-border bg-navy-mid/40 backdrop-blur-md p-12 text-center">
                <AlertTriangle size={32} className="text-white/60 opacity-50 mx-auto mb-2" />
                <p className="text-sm text-white/60 font-medium">{t('admin_users_no_results') || 'No admins match this view.'}</p>
              </div>
            ) : (
              filtered.map((admin) => (
                <AdminCard key={admin.id} admin={admin} onClick={() => setActiveId(admin.id)} />
              ))
            )}
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[340px_1fr] transition-all duration-300">
            <aside className="hidden flex-col gap-3 lg:flex">
              <p className="sa-queue-header px-1 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-white/60">
                Queue &middot; {filtered.length}
              </p>
              <div className="flex max-h-[calc(100vh-260px)] flex-col gap-[12px] overflow-y-auto pr-2 pb-6">
                {filtered.map((admin) => (
                  <AdminListItem
                    key={admin.id}
                    admin={admin}
                    active={admin.id === active.id}
                    onClick={() => {
                      setActiveId(admin.id);
                      setReviewDetail(null);
                    }}
                  />
                ))}
              </div>
            </aside>
            <section>
              <ReviewDetail
                admin={active}
                reviewDetail={reviewDetail}
                reviewLoading={reviewLoading || reviewSubmitting}
                onApprove={handleApprove}
                onReject={handleReject}
                onBack={() => {
                  setActiveId(null);
                  setReviewDetail(null);
                }}
                onDeleteRequest={(target) => setDeleteConfirm(target)}
                onToggleEdit={handleToggleEdit}
                onReopenVerification={handleReopenVerification}
                onArchiveAdmin={handleArchiveAdmin}
                onPermanentlyRejectAdmin={handlePermanentlyRejectAdmin}
              />
            </section>
          </div>
        )}
      </div>

      {/* Invite Admin Modal */}
      {modalOpen && (
        <div className="admin-modal-backdrop transition-all duration-250">
          <div className="admin-modal max-w-[500px] bg-navy-deep backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/5 p-5">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-amber/10 border border-amber/20 flex items-center justify-center shadow-[0_0_15px_oklch(0.78_0.16_75/0.15)]">
                  <ShieldCheck size={18} className="text-amber" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">{t('admin_users_create_new_admin') || 'Create new admin'}</h3>
                  <p className="text-[11px] text-white/60 mt-0.5 font-medium">{t('admin_users_invite_email_note') || 'An access credentials email will be sent automatically.'}</p>
                </div>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-white/60 hover:bg-white/5 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSave}>
              <div className="p-6 space-y-4">
                {/* Duplicate warning */}
                {dupState === "warning" && (
                  <div className="rounded-xl border border-warning/30 bg-warning/5 p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle size={16} className="text-warning animate-pulse" />
                      <span className="font-bold text-warning text-xs uppercase tracking-wider">{t('admin_users_possible_duplicate') || 'Possible Duplicate'}</span>
                    </div>
                    <p className="text-xs text-white/60 leading-relaxed font-medium">
                      An administrator named <strong className="text-white">"{dupInfo?.full_name}"</strong> is already assigned to <strong className="text-white">{airportLabel(dupInfo?.airport_iata)}</strong>.
                      Registered: {dupInfo?.created_at ? format(new Date(dupInfo.created_at), "MMM d, yyyy") : "—"}.
                      <br />Confirm if this is a different administrator?
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setBypassDuplicate(true);
                          setDupState("bypassed");
                          suggestWorkEmail(form.name, form.airport);
                        }}
                        className="flex-1 py-1.5 rounded-lg border border-warning/40 bg-warning/10 text-xs font-bold text-warning hover:bg-warning/20 transition duration-150"
                      >
                        {t('admin_users_yes_different') || 'Yes, different person'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setModalOpen(false)}
                        className="flex-1 py-1.5 rounded-lg border border-danger/30 bg-danger/10 text-xs font-bold text-danger hover:bg-danger/20 transition duration-150"
                      >
                        {t('cancel') || 'Cancel'}
                      </button>
                    </div>
                  </div>
                )}

                {bypassDuplicate && (
                  <div className="rounded-lg border border-success/20 bg-success/5 px-3 py-2 text-[11px] text-success font-medium">
                    🪪 Admin duplicate bypass is active. A welcome verification email will be dispatched.
                  </div>
                )}

                {/* Name */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/60 block">
                    {t('admin_users_full_name') || 'Full Name'}
                  </label>
                  <div className="relative">
                    <input
                      required
                      type="text"
                      value={form.name}
                      onChange={(e) => handleNameChange(e.target.value)}
                      placeholder="e.g. hanen kalaizar"
                      disabled={dupState === "warning" || saving}
                      className="h-10 w-full rounded-lg border border-slate-700 bg-navy-deep px-3 text-sm text-white placeholder:text-slate-400 outline-none focus:border-amber focus:ring-1 focus:ring-amber transition-all"
                    />
                    {dupState === "checking" && (
                      <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-white/60" />
                    )}
                  </div>
                </div>

                {/* Generated work email */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/60 block">
                    {t('admin_users_generated_login_email') || 'Generated Login Email'}
                  </label>
                  <div className="relative">
                    <input
                      required
                      type="email"
                      value={form.workEmail}
                      onChange={(e) => handleWorkEmailChange(e.target.value)}
                      placeholder="hanen.kalaizar@tun-airport.tn"
                      disabled={dupState === "warning" || saving}
                      className={cn(
                        "h-10 w-full rounded-lg border border-slate-700 bg-navy-deep px-3 text-sm text-white placeholder:text-slate-400 outline-none focus:border-amber focus:ring-1 focus:ring-amber transition-all",
                        workEmailStatus === "taken" && "border-danger/40 focus:border-danger/60",
                        workEmailStatus === "available" && "border-success/40 focus:border-success/60"
                      )}
                    />
                    {workEmailStatus === "checking" && (
                      <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-white/60" />
                    )}
                    {workEmailStatus === "available" && (
                      <CheckCircle2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-success" />
                    )}
                    {workEmailStatus === "taken" && (
                      <X size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-danger" />
                    )}
                  </div>
                  <p
                    className={cn(
                      "text-[10px] mt-0.5",
                      workEmailStatus === "taken" && "text-danger",
                      workEmailStatus === "available" && "text-success",
                      workEmailWarning && "text-warning",
                      !workEmailStatus && !workEmailWarning && "text-white/60"
                    )}
                  >
                    {workEmailStatus === "taken" ? (t('admin_users_email_taken') || 'This work email address is already in use.') :
                     workEmailStatus === "available" ? (t('admin_users_email_available') || 'Email is available for registration login.') :
                     workEmailWarning ? workEmailWarning : (t('admin_users_email_hint') || 'Auto-generated work email address from fullname.')}
                  </p>
                </div>

                {/* Personal email */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/60 block">
                    {t('admin_users_personal_email') || 'Personal Email Address'}
                  </label>
                  <div className="relative">
                    <input
                      required
                      type="email"
                      value={form.personalEmail}
                      onChange={(e) => setForm((f) => ({ ...f, personalEmail: e.target.value }))}
                      placeholder="hanen.kalaizar@gmail.com"
                      disabled={dupState === "warning" || saving}
                      className={cn(
                        "h-10 w-full rounded-lg border border-slate-700 bg-navy-deep px-3 text-sm text-white placeholder:text-slate-400 outline-none focus:border-amber focus:ring-1 focus:ring-amber transition-all",
                        form.personalEmail && !personalOk && "border-danger/40 focus:border-danger/60",
                        form.personalEmail && personalOk && "border-success/40 focus:border-success/60"
                      )}
                    />
                    {form.personalEmail && personalOk && (
                      <CheckCircle2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-success" />
                    )}
                    {form.personalEmail && !personalOk && (
                      <X size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-danger" />
                    )}
                  </div>
                  <p className={cn("text-[10px] mt-0.5", form.personalEmail && !personalOk ? "text-danger" : "text-white/60")}>
                    {form.personalEmail && !personalOk ? (t('admin_users_invalid_personal_email') || 'Enter a valid personal email format.') : (t('admin_users_personal_email_hint') || 'Welcome login invitation link will be sent here.')}
                  </p>
                </div>

                {/* Airport selection */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/60 block">
                    {t('admin_users_airport_scope') || 'Airport Access Scope'}
                  </label>
                  <select
                    value={form.airport}
                    onChange={(e) => handleAirportChange(e.target.value)}
                    disabled={dupState === "warning" || saving}
                    className="h-10 w-full rounded-lg border border-slate-700 bg-navy-deep px-3 text-sm text-white outline-none cursor-pointer focus:border-amber focus:ring-1 focus:ring-amber transition-all"
                  >
                    {TUNISIAN_AIRPORTS.map((a) => (
                      <option key={a.iata} value={a.iata} className="bg-navy-deep text-white">
                        {a.name} ({a.iata})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-2 border-t border-white/5 p-4">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  disabled={saving}
                  className="h-9 px-4 rounded-lg text-xs font-semibold text-white/60 hover:text-white"
                >
                  {t('cancel') || 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={!canSubmit || saving}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-amber px-4 text-xs font-semibold text-navy-deep transition-all hover:bg-amber/90 shadow-[0_0_15px_oklch(0.78_0.16_75/0.2)] hover:shadow-[0_0_20px_oklch(0.78_0.16_75/0.4)] disabled:opacity-40"
                >
                  {saving ? (
                    <>
                      <Loader2 size={13} className="animate-spin" /> {t('admin_users_creating') || 'Creating…'}
                    </>
                  ) : (
                    <>
                      <Mail size={13} /> {t('admin_users_send_invitation') || 'Send Invitation'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Admin Modal */}
      {deleteConfirm && (
        <div className="admin-modal-backdrop transition-all duration-250">
          <div className="admin-modal max-w-md bg-navy-deep backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/5 p-5 bg-danger/5">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-danger/10 border border-danger/20 flex items-center justify-center">
                  <AlertTriangle size={16} className="text-danger animate-pulse" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">{t('admin_users_confirm_deletion') || 'Confirm Deletion'}</h3>
                  <p className="text-[10px] text-white/60 mt-0.5 font-medium">{t('admin_users_deletion_warning') || 'This action is permanent and cannot be undone.'}</p>
                </div>
              </div>
              <button
                onClick={() => setDeleteConfirm(null)}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-white/60 hover:bg-white/5 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-6">
              <p className="text-sm text-foreground/90 leading-relaxed font-medium">
                {t('admin_users_delete_confirm_msg') || 'Are you sure you want to permanently delete administrator account'} <span className="font-semibold text-danger">{deleteConfirm.fullName}</span>?
                {t('admin_users_delete_revoke_msg') || 'This will immediately revoke their dashboard authorization, security credentials, and access to all airport operation systems.'}
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-white/5 p-4 bg-navy-deep/20">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="h-9 px-4 rounded-lg text-xs font-semibold text-white/60 hover:text-white"
              >
                {t('cancel') || 'Cancel'}
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="h-9 px-4 rounded-lg text-xs font-semibold bg-danger text-white hover:bg-danger/80 transition duration-150"
              >
                {t('admin_users_delete_permanently') || 'Delete permanently'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Toast System */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-[9999] max-w-md w-[380px] sm:w-[420px] transition-all duration-300 animate-in fade-in slide-in-from-bottom-5">
          <div
            className={cn(
              "flex gap-3 rounded-xl border p-4 shadow-2xl backdrop-blur-md bg-navy-deep/95 backdrop-blur-xl border-white/10 text-white",
              toast.type === "success"
                ? "border-success/35 shadow-success/5"
                : "border-danger/35 shadow-danger/5"
            )}
          >
            <div className="mt-0.5 flex-shrink-0">
              {toast.type === "success" ? (
                <CheckCircle2 className="text-success h-5 w-5" />
              ) : (
                <AlertTriangle className="text-danger h-5 w-5 animate-bounce" />
              )}
            </div>
            
            <div className="flex-1 space-y-1.5 min-w-0 pr-1">
              {toast.title ? (
                <>
                  <h4 className="text-xs font-bold tracking-wider text-white uppercase">
                    {toast.title}
                  </h4>
                  {toast.details && (
                    <p className="text-xs text-white/60 leading-relaxed font-medium">
                      {toast.details}
                    </p>
                  )}
                  {toast.loginId && (
                    <div className="mt-2.5 rounded-lg bg-navy-mid/80 border border-white/5 p-2.5 flex flex-col gap-1">
                      <span className="text-[9px] font-bold uppercase tracking-widest text-white/60">
                        {t('admin_users_generated_login_id') || 'Generated Login ID'}
                      </span>
                      <span className="font-mono text-[11px] text-amber font-semibold break-all leading-none">
                        {toast.loginId}
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-xs font-medium leading-relaxed">{toast.msg}</p>
              )}
            </div>

            <button
              onClick={() => setToast(null)}
              className="flex-shrink-0 h-5 w-5 rounded flex items-center justify-center text-white/60 hover:bg-white/5 hover:text-white transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}
    </AdminShell>
  );
}