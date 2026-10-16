
import { LoaderCircle } from "lucide-react";

const variants = {
  primary:
    "bg-acc text-onAcc hover:opacity-90 border border-transparent",
  secondary:
    "border border-line bg-surface text-text hover:bg-hover",
  ghost:
    "border border-transparent bg-transparent text-muted hover:bg-hover hover:text-text",
  danger:
    "border border-transparent bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-950 dark:text-red-300 dark:hover:bg-red-900",
};

const sizes = {
  sm: "min-h-8 px-3 text-xs",
  md: "min-h-9 px-4 text-sm",
  lg: "min-h-11 px-5 text-sm",
};

export default function Button({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  type = "button",
  onClick,
  className = "",
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acc disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant] || variants.primary} ${sizes[size] || sizes.md} ${className}`}
    >
      {loading && (
        <LoaderCircle size={16} className="animate-spin" />
      )}

      {children}
    </button>
  );
}
