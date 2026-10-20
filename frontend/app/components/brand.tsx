import { useTranslation } from "react-i18next";
import { Link } from "react-router";

export function Brand() {
  const { t } = useTranslation();
  return (
    <Link
      to="/"
      aria-label={t("common.numdockHome")}
      className="inline-flex items-center gap-2.5 rounded-sm text-lg font-semibold tracking-tight"
    >
      <svg
        width="28"
        height="28"
        viewBox="0 0 28 28"
        fill="none"
        aria-hidden="true"
        className="text-primary"
      >
        <rect
          x="1"
          y="1"
          width="26"
          height="26"
          rx="7"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="M8 19V9l12 10V9M7 22h14"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      NumDock
    </Link>
  );
}
