import { Plane } from "lucide-react";

/** Compact hero icon — proportional to headings (reference: cyan glow, dark plane, no oversized block). */
export function GlowingIcon() {
  return (
    <div className="relative w-28 h-28 sm:w-32 sm:h-32 mx-auto mb-6 shrink-0">
      {/* Soft outer glow */}
      <div
        className="absolute -inset-2 rounded-2xl bg-cyan-500/25 blur-xl"
        aria-hidden
      />
      <div
        className="absolute -inset-1 rounded-2xl bg-cyan-400/20 blur-md"
        aria-hidden
      />

      {/* Icon tile — matches reference: rounded square, cyan fill, dark plane */}
      <div className="relative w-full h-full rounded-2xl bg-gradient-to-br from-cyan-400 to-cyan-600 border border-cyan-300/40 shadow-lg shadow-cyan-500/30 flex items-center justify-center">
        <Plane className="w-12 h-12 sm:w-14 sm:h-14 text-gray-900" strokeWidth={2} />
      </div>
    </div>
  );
}

export default GlowingIcon;
