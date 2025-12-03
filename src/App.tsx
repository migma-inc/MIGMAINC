
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { GlobalPartner } from './pages/GlobalPartner';
import { PartnerTerms } from './pages/PartnerTerms';
import { ThankYou } from './pages/ThankYou';
import { PartnerTermsSuccess } from './pages/PartnerTermsSuccess';
import { Dashboard } from './pages/Dashboard';
import { DashboardContent } from './pages/Dashboard';
import { ApplicationDetailPage } from './pages/ApplicationDetailPage';
import { ContractsPage } from './pages/ContractsPage';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/global-partner" element={<GlobalPartner />} />
        <Route path="/global-partner/thank-you" element={<ThankYou />} />
        <Route path="/partner-terms" element={<PartnerTerms />} />
        <Route path="/partner-terms/success" element={<PartnerTermsSuccess />} />
        <Route path="/dashboard" element={<Dashboard />}>
          <Route index element={<DashboardContent />} />
          <Route path="applications/:id" element={<ApplicationDetailPage />} />
          <Route path="contracts" element={<ContractsPage />} />
        </Route>
        <Route path="/" element={<Navigate to="/global-partner" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
