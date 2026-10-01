"use client";

import { useEffect, useState } from "react";
import { RedundancyView } from "./correlation_client";
import { DifficultyView } from "./difficulty_client";

const TABS = [
  { id: "correlation", label: "Benchmark correlation" },
  { id: "domain", label: "Domain coverage" },
  { id: "difficulty", label: "Item difficulty" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function LandscapeTabs() {
  const [tab, setTab] = useState<TabId>(() => TABS.find(t => t.id === new URLSearchParams(location.hash.slice(1)).get("tab"))?.id ?? "correlation");

  useEffect(() => { const params = new URLSearchParams(location.hash.slice(1)); params.set("tab", tab); history.replaceState(null, "", `#${params}`); }, [tab]);

  useEffect(() => { const domains = document.getElementById("landscape-domains"); if (domains) domains.hidden = tab !== "domain"; }, [tab]);

  return (
    <div>
      <div className="landscape-folder-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            aria-pressed={tab === t.id}
            onClick={() => setTab(t.id)}
            className="landscape-folder-tab"
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className={tab === "correlation" ? "landscape-content landscape-folder-panel" : tab === "difficulty" ? "landscape-folder-difficulty" : ""}>
        {tab === "correlation" && <RedundancyView />}
        {tab === "difficulty" && <DifficultyView />}
      </div>
    </div>
  );
}
