import { useMemo, useState } from "react";
import {
  UserCircle, Mail, Phone, MapPin, IdCard, FileText, Plane, Calendar,
  Globe, ShieldCheck, Lock, Eye, EyeOff, Pencil, Save, X, Check, AlertCircle,
  Camera, Download, ShieldAlert,
} from "lucide-react";

/* ─────────────────────────────────────────────────────────────────
   Admin Profile — read-only by default, partial edit mode,
   password section, matches admin dashboard theme (dark + light)
   ───────────────────────────────────────────────────────────────── */

type ProfileData = {
  // Personal
  fullName: string;
  dateOfBirth: string;
  gender: string;
  nationality: string;
  residentialAddress: string;
  // Identification
  cinNumber: string;
  cinDocument: { name: string; size: string; uploaded: string };
  // Travel
  passportNumber: string;
  passportExpiry: string;
  passportDocument: { name: string; size: string; uploaded: string };
  // Contact
  phoneNumber: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  email: string;
};

const INITIAL: ProfileData = {
  fullName: "Sarah Admin",
  dateOfBirth: "1989-04-12",
  gender: "Female",
  nationality: "Tunisian",
  residentialAddress: "12 Avenue Habib Bourguiba, Tunis 1001",
  cinNumber: "08-742-119",
  cinDocument: { name: "cin_scan_v2.pdf", size: "2.4 MB", uploaded: "Verified" },
  passportNumber: "P992811400",
  passportExpiry: "2029-08-30",
  passportDocument: { name: "passport_main.pdf", size: "1.8 MB", uploaded: "Processing" },
  phoneNumber: "+216 71 754 000",
  emergencyContactName: "Karim Admin",
  emergencyContactPhone: "+216 22 113 458",
  email: "sarah.admin@tun-airport.tn",
};

const EDITABLE = new Set<keyof ProfileData>([
  "phoneNumber", "residentialAddress", "emergencyContactName", "emergencyContactPhone",
]);

export default function AdminProfilePage() {
  const [data, setData] = useState<ProfileData>(INITIAL);
  const [draft, setDraft] = useState<ProfileData>(INITIAL);
  const [editing, setEditing] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof ProfileData, string>>>({});

  const startEdit = () => { setDraft(data); setErrors({}); setEditing(true); };
  const cancelEdit = () => { setDraft(data); setErrors({}); setEditing(false); };

  const validate = (d: ProfileData) => {
    const e: Partial<Record<keyof ProfileData, string>> = {};
    const phoneRx = /^\+?[0-9 ()-]{7,20}$/;
    if (!phoneRx.test(d.phoneNumber)) e.phoneNumber = "Enter a valid phone number";
    if (!d.residentialAddress.trim() || d.residentialAddress.length < 6) e.residentialAddress = "Address is too short";
    if (!d.emergencyContactName.trim() || d.emergencyContactName.length < 2) e.emergencyContactName = "Contact name required";
    if (!phoneRx.test(d.emergencyContactPhone)) e.emergencyContactPhone = "Enter a valid phone number";
    return e;
  };

  const save = () => {
    const e = validate(draft);
    setErrors(e);
    if (Object.keys(e).length > 0) {
      setToast({ type: "error", msg: "Please correct the highlighted fields." });
      setTimeout(() => setToast(null), 3200);
      return;
    }
    setData(draft);
    setEditing(false);
    setToast({ type: "success", msg: "Profile updated successfully." });
    setTimeout(() => setToast(null), 3200);
  };

  const onChange = (k: keyof ProfileData, v: string) => setDraft(d => ({ ...d, [k]: v }));

  return (
    <>
      <div className="admin-page__header">
        <div>
          <h1 className="admin-page__title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <UserCircle size={22} style={{ color: "var(--adm-accent)" }} /> Profile Settings
          </h1>
          <p className="admin-page__subtitle">Manage your identity documents and administrative contact information.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {!editing ? (
            <button className="admin-btn admin-btn--primary" onClick={startEdit}>
              <Pencil size={14} /> <span>Edit Profile</span>
            </button>
          ) : (
            <>
              <button className="admin-btn admin-btn--outline" onClick={cancelEdit}>
                <X size={14} /> <span>Cancel</span>
              </button>
              <button className="admin-btn admin-btn--primary" onClick={save}>
                <Save size={14} /> <span>Save Changes</span>
              </button>
            </>
          )}
        </div>
      </div>

      {toast && (
        <div style={{
          marginBottom: "1rem", padding: "0.75rem 1rem", borderRadius: 10,
          display: "flex", alignItems: "center", gap: 10,
          background: toast.type === "success" ? "rgba(52,211,153,0.10)" : "rgba(248,113,113,0.10)",
          border: `1px solid ${toast.type === "success" ? "rgba(52,211,153,0.35)" : "rgba(248,113,113,0.35)"}`,
          color: toast.type === "success" ? "#10B981" : "#DC2626",
          fontSize: "0.85rem", fontWeight: 600,
        }}>
          {toast.type === "success" ? <Check size={16} /> : <AlertCircle size={16} />}
          {toast.msg}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: "1.25rem", alignItems: "flex-start" }}>
        {/* LEFT — avatar card + integrity */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <div className="admin-card" style={{ padding: "1.5rem", textAlign: "center" }}>
            <div style={{ position: "relative", width: 120, height: 120, margin: "0 auto 1rem" }}>
              <div style={{
                width: 120, height: 120, borderRadius: "50%",
                background: "linear-gradient(135deg,#F59E0B,#FBBF24)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "2.2rem", fontWeight: 700, color: "#0A1628",
                border: "4px solid var(--adm-card)",
                boxShadow: "0 8px 24px rgba(245,158,11,0.25)",
              }}>SA</div>
              <button
                aria-label="Change photo"
                style={{
                  position: "absolute", bottom: 0, right: 6, width: 32, height: 32,
                  borderRadius: "50%", border: "2px solid var(--adm-card)",
                  background: "var(--adm-accent)", color: "#0A1628", cursor: "pointer",
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                }}>
                <Camera size={14} />
              </button>
            </div>
            <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--adm-text)" }}>{data.fullName}</div>
            <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--adm-accent)", letterSpacing: "0.08em", marginTop: 4 }}>
              CLEARANCE LEVEL 4
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: "1rem" }}>
              <button className="admin-btn admin-btn--outline admin-btn--compact" style={{ justifyContent: "center" }}>Change Photo</button>
              <button className="admin-btn admin-btn--compact" style={{
                justifyContent: "center", background: "transparent",
                border: "1px solid transparent", color: "#EF4444", fontWeight: 600,
              }}>Remove Image</button>
            </div>
          </div>

          <div className="admin-card" style={{ padding: "1.25rem" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.85rem", fontWeight: 700, color: "var(--adm-text)" }}>
                <ShieldCheck size={15} style={{ color: "var(--adm-accent)" }} /> Identity Integrity
              </div>
              <span style={{ color: "#10B981" }}><Check size={16} /></span>
            </div>
            <Row label="Last ID Check" value="12 Oct 2026" />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 8 }}>
              <span style={{ fontSize: "0.78rem", color: "var(--adm-text-muted)" }}>Status</span>
              <span style={{
                fontSize: "0.65rem", fontWeight: 800, letterSpacing: "0.08em",
                padding: "3px 8px", borderRadius: 6,
                background: "rgba(16,185,129,0.15)", color: "#10B981",
                border: "1px solid rgba(16,185,129,0.3)",
              }}>ACTIVE</span>
            </div>
          </div>
        </div>

        {/* RIGHT — sections */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {/* Personal Info */}
          <Section title="Personal Information" subtitle="Identity and demographics on file.">
            <Grid cols={2}>
              <ReadField label="Full Name" value={data.fullName} icon={UserCircle} />
              <ReadField label="Date of Birth" value={fmtDate(data.dateOfBirth)} icon={Calendar} />
              <ReadField label="Gender" value={data.gender} icon={UserCircle} />
              <ReadField label="Nationality" value={data.nationality} icon={Globe} />
              <EditField
                label="Residential Address"
                value={editing ? draft.residentialAddress : data.residentialAddress}
                editable={EDITABLE.has("residentialAddress")}
                editing={editing}
                error={errors.residentialAddress}
                onChange={v => onChange("residentialAddress", v)}
                icon={MapPin}
                fullWidth
              />
            </Grid>
          </Section>

          {/* Legal Identification */}
          <Section title="Legal Identification" subtitle="Sensitive document data for authority verification.">
            <Grid cols={2}>
              <ReadField label="CIN (National ID Card)" value={data.cinNumber} icon={IdCard} verified />
              <ReadField label="Passport Number" value={data.passportNumber} icon={Plane} status="processing" />
              <ReadField label="Passport Expiry" value={fmtDate(data.passportExpiry)} icon={Calendar} />
            </Grid>
            <div style={{ marginTop: "1rem", fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.10em", color: "var(--adm-text-muted)", textTransform: "uppercase" }}>
              Uploaded Documents
            </div>
            <Grid cols={2}>
              <DocumentCard icon={FileText} {...data.cinDocument} accent="#34D399" />
              <DocumentCard icon={Plane} {...data.passportDocument} accent="#FBBF24" />
            </Grid>
          </Section>

          {/* Contact Registry */}
          <Section title="Contact Registry" subtitle="Communication channels for official notifications.">
            <Grid cols={2}>
              <ReadField label="Email Address" value={data.email} icon={Mail} />
              <EditField
                label="Phone Number"
                value={editing ? draft.phoneNumber : data.phoneNumber}
                editable={EDITABLE.has("phoneNumber")}
                editing={editing}
                error={errors.phoneNumber}
                onChange={v => onChange("phoneNumber", v)}
                icon={Phone}
              />
              <EditField
                label="Emergency Contact Name"
                value={editing ? draft.emergencyContactName : data.emergencyContactName}
                editable={EDITABLE.has("emergencyContactName")}
                editing={editing}
                error={errors.emergencyContactName}
                onChange={v => onChange("emergencyContactName", v)}
                icon={UserCircle}
              />
              <EditField
                label="Emergency Contact Phone"
                value={editing ? draft.emergencyContactPhone : data.emergencyContactPhone}
                editable={EDITABLE.has("emergencyContactPhone")}
                editing={editing}
                error={errors.emergencyContactPhone}
                onChange={v => onChange("emergencyContactPhone", v)}
                icon={Phone}
              />
            </Grid>
          </Section>

          {/* Password */}
          <PasswordSection />
        </div>
      </div>
    </>
  );
}

/* ── helpers ───────────────────────────────────────────── */

function fmtDate(d: string) {
  try {
    return new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  } catch { return d; }
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0" }}>
      <span style={{ fontSize: "0.78rem", color: "var(--adm-text-muted)" }}>{label}</span>
      <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--adm-text)" }}>{value}</span>
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="admin-card" style={{ padding: "1.5rem" }}>
      <div style={{ marginBottom: "1.1rem" }}>
        <h2 style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--adm-text)", marginBottom: 4 }}>{title}</h2>
        <p style={{ fontSize: "0.82rem", color: "var(--adm-text-muted)" }}>{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

function Grid({ cols, children }: { cols: 1 | 2; children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: cols === 2 ? "1fr 1fr" : "1fr", gap: "0.9rem", marginTop: "0.5rem" }}>
      {children}
    </div>
  );
}

function FieldShell({ label, children, fullWidth }: { label: string; children: React.ReactNode; fullWidth?: boolean }) {
  return (
    <div style={{ gridColumn: fullWidth ? "1 / -1" : undefined }}>
      <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--adm-text-muted)", marginBottom: 6 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function ReadField({ label, value, icon: Icon, verified, status }: {
  label: string; value: string; icon: any; verified?: boolean; status?: "processing";
}) {
  return (
    <FieldShell label={label}>
      <div className="admin-profile-readfield" style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "0.65rem 0.85rem", borderRadius: 10,
        background: "var(--adm-input-bg)",
        border: "1px solid var(--adm-border)",
        color: "var(--adm-text)", fontSize: "0.88rem", fontWeight: 500,
      }}>
        <Icon size={15} style={{ color: "var(--adm-text-muted)", flexShrink: 0 }} />
        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</span>
        {verified && <span title="Verified" style={{ color: "#10B981" }}><Check size={14} /></span>}
        {status === "processing" && <span title="Processing" style={{ color: "#F59E0B" }}><AlertCircle size={14} /></span>}
      </div>
    </FieldShell>
  );
}

function EditField({
  label, value, editable, editing, error, onChange, icon: Icon, fullWidth,
}: {
  label: string; value: string; editable: boolean; editing: boolean;
  error?: string; onChange: (v: string) => void; icon: any; fullWidth?: boolean;
}) {
  const active = editable && editing;
  return (
    <FieldShell label={label} fullWidth={fullWidth}>
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "0.5rem 0.85rem", borderRadius: 10,
        background: active ? "var(--adm-card)" : "var(--adm-input-bg)",
        border: `1px solid ${error ? "rgba(239,68,68,0.6)" : active ? "var(--adm-accent)" : "var(--adm-border)"}`,
        boxShadow: active ? "0 0 0 3px var(--adm-accent-light)" : "none",
        transition: "all 180ms ease",
      }}>
        <Icon size={15} style={{ color: active ? "var(--adm-accent)" : "var(--adm-text-muted)", flexShrink: 0 }} />
        <input
          value={value}
          readOnly={!active}
          onChange={e => onChange(e.target.value)}
          style={{
            flex: 1, background: "transparent", border: "none", outline: "none",
            color: "var(--adm-text)", fontSize: "0.88rem", fontWeight: 500,
            cursor: active ? "text" : "default",
          }}
        />
        {editable && !editing && (
          <span title="Editable in edit mode" style={{ color: "var(--adm-text-muted)" }}><Pencil size={12} /></span>
        )}
      </div>
      {error && <div style={{ marginTop: 4, fontSize: "0.72rem", color: "#EF4444" }}>{error}</div>}
    </FieldShell>
  );
}

function DocumentCard({ icon: Icon, name, size, uploaded, accent }: {
  icon: any; name: string; size: string; uploaded: string; accent: string;
}) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "0.85rem 1rem", borderRadius: 12,
      background: "var(--adm-input-bg)",
      border: "1px solid var(--adm-border)",
    }}>
      <div style={{
        width: 38, height: 38, borderRadius: 10,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        background: `${accent}22`, color: accent, flexShrink: 0,
      }}>
        <Icon size={18} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--adm-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
        <div style={{ fontSize: "0.72rem", color: "var(--adm-text-muted)" }}>{size} • {uploaded}</div>
      </div>
      <button aria-label="Download" style={{
        width: 30, height: 30, borderRadius: 8,
        border: "1px solid var(--adm-border)", background: "transparent",
        color: "var(--adm-text-sub)", cursor: "pointer",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
      }}>
        <Download size={14} />
      </button>
    </div>
  );
}

/* ── Password Change ── */

function PasswordSection() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState<{ c: boolean; n: boolean; r: boolean }>({ c: false, n: false, r: false });
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const strength = useMemo(() => calcStrength(next), [next]);
  const match = confirm.length > 0 && confirm === next;
  const mismatch = confirm.length > 0 && confirm !== next;

  const submit = () => {
    if (!current) return fail("Enter your current password.");
    if (next.length < 8) return fail("New password must be at least 8 characters.");
    if (strength.score < 2) return fail("Choose a stronger password.");
    if (next !== confirm) return fail("Passwords do not match.");
    setCurrent(""); setNext(""); setConfirm("");
    setMsg({ type: "success", text: "Password updated successfully." });
    setTimeout(() => setMsg(null), 3200);
  };
  const fail = (text: string) => { setMsg({ type: "error", text }); setTimeout(() => setMsg(null), 3200); };

  return (
    <div className="admin-card" style={{ padding: "1.5rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <ShieldAlert size={18} style={{ color: "var(--adm-accent)" }} />
        <h2 style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--adm-text)" }}>Password & Security</h2>
      </div>
      <p style={{ fontSize: "0.82rem", color: "var(--adm-text-muted)", marginBottom: "1.1rem" }}>
        Update your password to keep your administrator account secure.
      </p>

      {msg && (
        <div style={{
          marginBottom: "0.9rem", padding: "0.65rem 0.85rem", borderRadius: 10,
          background: msg.type === "success" ? "rgba(52,211,153,0.10)" : "rgba(248,113,113,0.10)",
          border: `1px solid ${msg.type === "success" ? "rgba(52,211,153,0.35)" : "rgba(248,113,113,0.35)"}`,
          color: msg.type === "success" ? "#10B981" : "#DC2626",
          fontSize: "0.82rem", fontWeight: 600, display: "flex", alignItems: "center", gap: 8,
        }}>
          {msg.type === "success" ? <Check size={14} /> : <AlertCircle size={14} />} {msg.text}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.9rem" }}>
        <PwField label="Current Password" v={current} setV={setCurrent} show={show.c} toggle={() => setShow(s => ({ ...s, c: !s.c }))} />
        <div />
        <PwField label="New Password" v={next} setV={setNext} show={show.n} toggle={() => setShow(s => ({ ...s, n: !s.n }))} />
        <PwField
          label="Confirm New Password"
          v={confirm}
          setV={setConfirm}
          show={show.r}
          toggle={() => setShow(s => ({ ...s, r: !s.r }))}
          state={mismatch ? "error" : match ? "ok" : undefined}
          hint={mismatch ? "Passwords don't match" : match ? "Passwords match" : undefined}
        />
      </div>

      {next && (
        <div style={{ marginTop: "0.9rem" }}>
          <div style={{ display: "flex", gap: 4 }}>
            {[0, 1, 2, 3].map(i => (
              <div key={i} style={{
                flex: 1, height: 5, borderRadius: 999,
                background: i < strength.score ? strength.color : "var(--adm-border)",
                transition: "background 180ms ease",
              }} />
            ))}
          </div>
          <div style={{ marginTop: 6, fontSize: "0.72rem", color: strength.color, fontWeight: 700, letterSpacing: "0.04em" }}>
            {strength.label}
          </div>
        </div>
      )}

      <div style={{ marginTop: "1.1rem", display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button className="admin-btn admin-btn--outline" onClick={() => { setCurrent(""); setNext(""); setConfirm(""); setMsg(null); }}>
          Discard
        </button>
        <button className="admin-btn admin-btn--primary" onClick={submit}>
          <Lock size={14} /> <span>Update Password</span>
        </button>
      </div>
    </div>
  );
}

function PwField({ label, v, setV, show, toggle, state, hint }: {
  label: string; v: string; setV: (s: string) => void; show: boolean; toggle: () => void;
  state?: "error" | "ok"; hint?: string;
}) {
  const borderColor =
    state === "error" ? "rgba(239,68,68,0.6)" :
    state === "ok" ? "rgba(16,185,129,0.5)" :
    "var(--adm-border)";
  return (
    <div>
      <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--adm-text-muted)", marginBottom: 6 }}>
        {label}
      </label>
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "0.5rem 0.85rem", borderRadius: 10,
        background: "var(--adm-input-bg)",
        border: `1px solid ${borderColor}`,
        transition: "all 180ms ease",
      }}>
        <Lock size={14} style={{ color: "var(--adm-text-muted)", flexShrink: 0 }} />
        <input
          type={show ? "text" : "password"}
          value={v}
          onChange={e => setV(e.target.value)}
          placeholder="••••••••"
          style={{
            flex: 1, background: "transparent", border: "none", outline: "none",
            color: "var(--adm-text)", fontSize: "0.88rem", letterSpacing: show ? "normal" : "0.18em",
          }}
        />
        <button
          type="button" onClick={toggle} aria-label={show ? "Hide password" : "Show password"}
          style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--adm-text-muted)" }}
        >
          {show ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
      {hint && (
        <div style={{ marginTop: 4, fontSize: "0.72rem", color: state === "error" ? "#EF4444" : "#10B981", fontWeight: 600 }}>
          {hint}
        </div>
      )}
    </div>
  );
}

function calcStrength(pw: string): { score: number; label: string; color: string } {
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  const map = [
    { label: "TOO WEAK", color: "#EF4444" },
    { label: "WEAK", color: "#F97316" },
    { label: "FAIR", color: "#F59E0B" },
    { label: "STRONG", color: "#10B981" },
    { label: "VERY STRONG", color: "#059669" },
  ];
  return { score: s, ...map[s] };
}
