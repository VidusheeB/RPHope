// Red placeholder box for images we don't have yet.
export default function FillerBox({
  label,
  className = "",
  rounded = "rounded",
}: {
  label?: string;
  className?: string;
  rounded?: string;
}) {
  return (
    <div
      role="img"
      aria-label={label ? `Placeholder: ${label}` : "Image placeholder"}
      className={`flex items-center justify-center border-2 border-red-700 bg-red-600/80 text-center text-[10px] font-semibold uppercase tracking-wide text-white ${rounded} ${className}`}
    >
      {label}
    </div>
  );
}
