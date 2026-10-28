
import { LoaderCircle } from "lucide-react";

const variants = {
  primary:
    "bg-acc text-onAcc hover:opacity-90 border border-transparent",
  secondary:
    "bg-surface text-text border border-line hover:bg-hover",
  ghost:
    "bg-transparent text-muted hover:bg-hover hover:text-text border border-transparent",
};

export default function Button({
  children,
  variant = "primary",
  type = "button",
  loading = false,
  disabled = false,
  className = "",
  ...props
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={[
        "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5",
        "text-sm font-semibold transition-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acc",
        "disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant] || variants.primary,
        className,
      ].join(" ")}
      {...props}
    >
      {loading && <LoaderCircle size={16} className="animate-spin" />}
      {children}
    </button>
  );
}
