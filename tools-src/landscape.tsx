import { createRoot } from 'react-dom/client';
import { LandscapeTabs } from './components/landscape/tabs';
const root = document.getElementById('landscape-tool');
if (root) createRoot(root).render(<LandscapeTabs />);
