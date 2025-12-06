
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Home } from './pages/Home';
import { Services } from './pages/Services';
import { About } from './pages/About';
import { Contact } from './pages/Contact';
import { BookACall } from './pages/BookACall';
import { BookACallThankYou } from './pages/BookACallThankYou';
import { PrivacyPolicy } from './pages/PrivacyPolicy';
import { WebsiteTerms } from './pages/WebsiteTerms';
import { Cookies } from './pages/Cookies';
import { GlobalPartnerTerms } from './pages/GlobalPartnerTerms';
import { GlobalPartner } from './pages/GlobalPartner';
import { PartnerTerms } from './pages/PartnerTerms';
import { ThankYou } from './pages/ThankYou';
import { PartnerTermsSuccess } from './pages/PartnerTermsSuccess';
import { Dashboard } from './pages/Dashboard';
import { DashboardContent } from './pages/Dashboard';
import { ApplicationDetailPage } from './pages/ApplicationDetailPage';
import { ContractsPage } from './pages/ContractsPage';
import { BookACallPage } from './pages/BookACallPage';
import { BookACallDetailPage } from './pages/BookACallDetailPage';
import { VisaCheckout } from './pages/VisaCheckout';
import { CheckoutSuccess } from './pages/CheckoutSuccess';
import { CheckoutCancel } from './pages/CheckoutCancel';
import { VisaServiceTerms } from './pages/VisaServiceTerms';
import { SellerLogin } from './pages/SellerLogin';
import { SellerRegister } from './pages/SellerRegister';
import { SellerDashboard } from './pages/SellerDashboard';
import { SellerOrderDetail } from './pages/SellerOrderDetail';
import { SellerRoute } from './components/seller/SellerRoute';
import { VisaOrdersPage } from './pages/VisaOrdersPage';
import { VisaOrderDetailPage } from './pages/VisaOrderDetailPage';
import { ZelleApprovalPage } from './pages/ZelleApprovalPage';
import { SellersPage } from './pages/SellersPage';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/services" element={<Services />} />
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/book-a-call" element={<BookACall />} />
        <Route path="/book-a-call/thank-you" element={<BookACallThankYou />} />
        <Route path="/legal/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/legal/website-terms" element={<WebsiteTerms />} />
        <Route path="/legal/cookies" element={<Cookies />} />
        <Route path="/legal/global-partner-terms" element={<GlobalPartnerTerms />} />
        <Route path="/legal/visa-service-terms" element={<VisaServiceTerms />} />
        <Route path="/global-partner" element={<GlobalPartner />} />
        <Route path="/checkout/visa/:productSlug" element={<VisaCheckout />} />
        <Route path="/checkout/success" element={<CheckoutSuccess />} />
        <Route path="/checkout/cancel" element={<CheckoutCancel />} />
        
        {/* Seller Routes */}
        <Route path="/seller/login" element={<SellerLogin />} />
        <Route path="/seller/register" element={<SellerRegister />} />
        <Route path="/seller/dashboard" element={<SellerRoute><SellerDashboard /></SellerRoute>} />
        <Route path="/seller/orders/:orderId" element={<SellerRoute><SellerOrderDetail /></SellerRoute>} />
        
        <Route path="/global-partner/thank-you" element={<ThankYou />} />
        <Route path="/partner-terms" element={<PartnerTerms />} />
        <Route path="/partner-terms/success" element={<PartnerTermsSuccess />} />
        <Route path="/dashboard" element={<Dashboard />}>
          <Route index element={<DashboardContent />} />
          <Route path="applications/:id" element={<ApplicationDetailPage />} />
          <Route path="book-a-call" element={<BookACallPage />} />
          <Route path="book-a-call/:id" element={<BookACallDetailPage />} />
          <Route path="contracts" element={<ContractsPage />} />
          <Route path="visa-orders" element={<VisaOrdersPage />} />
          <Route path="visa-orders/:id" element={<VisaOrderDetailPage />} />
          <Route path="zelle-approval" element={<ZelleApprovalPage />} />
          <Route path="sellers" element={<SellersPage />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
