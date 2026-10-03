import { createRoot } from "react-dom/client";
import { DataSummaryClient } from "./components/schema/data_summary_client";

const root = document.getElementById("schema-coverage");
if (root) createRoot(root).render(<DataSummaryClient />);
