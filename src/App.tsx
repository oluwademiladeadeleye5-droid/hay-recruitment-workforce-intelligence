import React from 'react';
import { WorkforceProvider, useWorkforce } from './context/WorkforceContext';
import { AppShell } from './components/AppShell';
import { Employee360Drawer } from './components/Employee360Drawer';
import { ToastContainer } from './components/ToastContainer';
import { LandingPage } from './pages/LandingPage';
import { ExecutiveOverviewPage } from './pages/ExecutiveOverviewPage';
import { WatchlistPage } from './pages/WatchlistPage';
import { DirectoryPage } from './pages/DirectoryPage';
import { InsightsActionHubPage } from './pages/InsightsActionHubPage';
import { DataHubPage } from './pages/DataHubPage';

const ActivePageRouter: React.FC = () => {
  const { activePage } = useWorkforce();

  switch (activePage) {
    case 'overview':
    case 'matrix':
      return <ExecutiveOverviewPage />;
    case 'watchlist':
      return <WatchlistPage />;
    case 'directory':
      return <DirectoryPage />;
    case 'insights':
    case 'copilot':
      return <InsightsActionHubPage />;
    case 'data-hub':
    case 'reports':
    case 'settings':
      return <DataHubPage />;
    default:
      return <ExecutiveOverviewPage />;
  }
};

const RootExperience: React.FC = () => {
  const { activeView } = useWorkforce();

  if (activeView === 'landing') {
    return <LandingPage />;
  }

  return (
    <AppShell>
      <ActivePageRouter />
    </AppShell>
  );
};

export default function App() {
  return (
    <WorkforceProvider>
      <RootExperience />
      <Employee360Drawer />
      <ToastContainer />
    </WorkforceProvider>
  );
}
