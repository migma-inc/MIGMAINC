
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
import { Dashboard, DashboardContent } from './pages/Dashboard';
import { ApplicationDetailPage } from './pages/ApplicationDetailPage';
import { ContractsPage } from './pages/ContractsPage';
import { BookACallPage } from './pages/BookACallPage';
import { BookACallDetailPage } from './pages/BookACallDetailPage';
import { VisaCheckoutPage as VisaCheckout } from './features/visa-checkout';
import { CheckoutSuccess } from './pages/CheckoutSuccess';
import { CheckoutCancel } from './pages/CheckoutCancel';
import { ZellePaymentProcessing } from './pages/ZellePaymentProcessing';
import { VisaServiceTerms } from './pages/VisaServiceTerms';
import { SellerLogin } from './pages/SellerLogin';
import { SellerRegister } from './pages/SellerRegister';
import { SellerDashboardLayout } from './pages/seller/SellerDashboardLayout';
import { SellerOverview } from './pages/seller/SellerOverview';
import { SellerAnalytics } from './pages/seller/SellerAnalytics';
import { SellerCommissions } from './pages/seller/SellerCommissions';
import { SellerFunnel } from './pages/seller/SellerFunnel';
import { SellerOrders } from './pages/seller/SellerOrders';
import { SellerLinks } from './pages/seller/SellerLinks';
import { SellerLeads } from './pages/seller/SellerLeads';
import { SellerOrderDetail } from './pages/SellerOrderDetail';
import { SellerRoute } from './components/seller/SellerRoute';
import { VisaOrdersPage } from './pages/VisaOrdersPage';
import { VisaOrderDetailPage } from './pages/VisaOrderDetailPage';
import { ZelleApprovalPage } from './pages/ZelleApprovalPage';
import { SellersPage } from './pages/SellersPage';
import { ContactMessagesPage } from './pages/ContactMessagesPage';
import { ContactMessageDetail } from './pages/ContactMessageDetail';
import { SupportTicket } from './pages/SupportTicket';
import { VisaContractResubmit } from './pages/VisaContractResubmit';
import { ContractTemplatesPage } from './pages/ContractTemplatesPage';
import { ViewSignedContract } from './pages/ViewSignedContract';
import { ViewVisaOrderContract } from './pages/ViewVisaOrderContract';
import { ScheduleMeetingPage } from './pages/admin/ScheduleMeetingPage';
import { AdminSellerAnalytics } from './pages/admin/AdminSellerAnalytics';
import { AdminRoute } from './components/admin/AdminRoute';
import { SlackReportsPage } from './pages/admin/SlackReportsPage';
import { VisaContractApprovalPage } from './pages/VisaContractApprovalPage';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/services" element={<Services />} />
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/support/ticket" element={<SupportTicket />} />
        <Route path="/book-a-call" element={<BookACall />} />
        <Route path="/book-a-call/thank-you" element={<BookACallThankYou />} />
        <Route path="/legal/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/legal/website-terms" element={<WebsiteTerms />} />
        <Route path="/legal/cookies" element={<Cookies />} />
        <Route path="/legal/global-partner-terms" element={<GlobalPartnerTerms />} />
        <Route path="/legal/visa-service-terms" element={<VisaServiceTerms />} />
        <Route path="/global-partner" element={<GlobalPartner />} />
        <Route path="/checkout/visa/:productSlug" element={<VisaCheckout />} />
        <Route path="/checkout/visa/resubmit" element={<VisaContractResubmit />} />
        <Route path="/checkout/success" element={<CheckoutSuccess />} />
        <Route path="/checkout/cancel" element={<CheckoutCancel />} />
        <Route path="/checkout/zelle/processing" element={<ZellePaymentProcessing />} />

        {/* Seller Routes */}
        <Route path="/seller/login" element={<SellerLogin />} />
        <Route path="/seller/register" element={<SellerRegister />} />
        <Route path="/seller/dashboard" element={<SellerRoute><SellerDashboardLayout /></SellerRoute>}>
          <Route index element={<SellerOverview />} />
          <Route path="analytics" element={<SellerAnalytics />} />
          <Route path="commissions" element={<SellerCommissions />} />
          <Route path="funnel" element={<SellerFunnel />} />
          <Route path="orders" element={<SellerOrders />} />
          <Route path="links" element={<SellerLinks />} />
          <Route path="leads" element={<SellerLeads />} />
        </Route>
        <Route path="/seller/orders/:orderId" element={<SellerRoute><SellerOrderDetail /></SellerRoute>} />

        <Route path="/global-partner/thank-you" element={<ThankYou />} />
        <Route path="/partner-terms" element={<PartnerTerms />} />
        <Route path="/partner-terms/success" element={<PartnerTermsSuccess />} />
        <Route path="/view-contract" element={<ViewSignedContract />} />
        <Route path="/view-visa-contract" element={<ViewVisaOrderContract />} />
        <Route path="/dashboard" element={<Dashboard />}>
          <Route index element={<DashboardContent />} />
          <Route path="applications/:id" element={<ApplicationDetailPage />} />
          <Route path="book-a-call" element={<BookACallPage />} />
          <Route path="book-a-call/:id" element={<BookACallDetailPage />} />
          <Route path="contracts" element={<ContractsPage />} />
          <Route path="visa-orders" element={<VisaOrdersPage />} />
          <Route path="visa-orders/:id" element={<VisaOrderDetailPage />} />
          <Route path="visa-contract-approval" element={<VisaContractApprovalPage />} />
          <Route path="zelle-approval" element={<ZelleApprovalPage />} />
          <Route path="sellers" element={<SellersPage />} />
          <Route path="sellers/:sellerId/analytics" element={<AdminRoute><AdminSellerAnalytics /></AdminRoute>} />
          <Route path="contact-messages" element={<ContactMessagesPage />} />
          <Route path="contact-messages/:id" element={<ContactMessageDetail />} />
          <Route path="contract-templates" element={<ContractTemplatesPage />} />
          <Route path="schedule-meeting" element={<ScheduleMeetingPage />} />
          <Route path="slack-reports" element={<SlackReportsPage />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
