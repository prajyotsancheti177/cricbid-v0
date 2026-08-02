import { NavLink } from "react-router-dom";

export interface TabDef {
  label: string;
  to: string;
  end?: boolean;
}

/**
 * Cricbuzz-style sticky horizontal tab bar. Scrollable on narrow screens,
 * active tab gets a primary underline.
 */
export default function TabBar({ tabs, top = "top-14" }: { tabs: TabDef[]; top?: string }) {
  return (
    <nav className={`sticky ${top} z-10 bg-panel border-b border-bdr`}>
      <div className="max-w-2xl mx-auto flex overflow-x-auto no-scrollbar">
        {tabs.map(t => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) => `tab-link flex-1 ${isActive ? "tab-link-active" : "hover:text-white"}`}
          >
            {t.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
