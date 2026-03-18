
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
import { VisaCheckoutPage as VisaCheckout, VisaSignatureCheckoutPage as VisaSignatureCheckout } from './features/visa-checkout';
import { CheckoutSuccess } from './pages/CheckoutSuccess';
import { CheckoutCancel } from './pages/CheckoutCancel';
import { ZellePaymentProcessing } from './pages/ZellePaymentProcessing';
import { SplitPaymentRedirect } from './pages/SplitPaymentRedirect';
import { VisaServiceTerms } from './pages/VisaServiceTerms';
import { SellerLogin } from './pages/SellerLogin';
import { ForgotPassword } from './pages/ForgotPassword';
import { ResetPassword } from './pages/ResetPassword';
import { SellerRegister } from './pages/SellerRegister';
import { SellerDashboardLayout } from './pages/seller/SellerDashboardLayout';
import { DashboardOverviewRouter } from './pages/seller/DashboardOverviewRouter';
import { HeadOfSalesTeam } from './pages/seller/HeadOfSalesTeam';
import { HeadOfSalesOrders } from './pages/seller/HeadOfSalesOrders';
import { HeadOfSalesCommissions } from './pages/seller/HeadOfSalesCommissions';
import { HeadOfSalesTotalSales } from './pages/seller/HeadOfSalesTotalSales';
import { SellerAnalytics } from './pages/seller/SellerAnalytics';
import { SellerCommissions } from './pages/seller/SellerCommissions';
import { SellerFunnel } from './pages/seller/SellerFunnel';
import { SellerOrders } from './pages/seller/SellerOrders';
import { SellerLinks } from './pages/seller/SellerLinks';
import { SellerLeads } from './pages/seller/SellerLeads';
import { SellerOrderDetail } from './pages/SellerOrderDetail';
import { SellerZelleApprovalPage } from './pages/seller/SellerZelleApprovalPage';
import { HosVisaContractApprovalPage } from './pages/seller/HosVisaContractApprovalPage';
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
import { AdminSellerOrders } from './pages/admin/AdminSellerOrders';
import { AdminRoute } from './components/admin/AdminRoute';
import { SlackReportsPage } from './pages/admin/SlackReportsPage';
import { AdminHoSAnalytics } from './pages/admin/AdminHoSAnalytics';
import { VisaContractApprovalPage } from './pages/VisaContractApprovalPage';
import { AdminProfile } from './pages/admin/AdminProfile';
import { HeadOfSalesManagement } from './pages/admin/HeadOfSalesManagement';
import { SendExistingContracts } from './pages/admin/SendExistingContracts';
import { CouponManagement } from './pages/admin/CouponManagement';
import { EB3RecurringManagement } from './pages/admin/EB3RecurringManagement';
import { EB3RecurringDetail } from './pages/admin/EB3RecurringDetail';
import { ScholarshipRecurringManagement } from './pages/admin/ScholarshipRecurringManagement';
import { ScholarshipRecurringDetail } from './pages/admin/ScholarshipRecurringDetail';
import { AdminSyncSales } from './pages/admin/AdminSyncSales';
import { EB3InstallmentCheckout } from './pages/EB3InstallmentCheckout';
import { NotFound } from './pages/NotFound';

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
        <Route path="/checkout/contract/:productSlug" element={<VisaSignatureCheckout />} />
        <Route path="/checkout/visa/resubmit" element={<VisaContractResubmit />} />
        <Route path="/checkout/eb3-installment/:installmentId" element={<EB3InstallmentCheckout />} />
        <Route path="/checkout/success" element={<CheckoutSuccess />} />
        <Route path="/checkout/cancel" element={<CheckoutCancel />} />
        <Route path="/checkout/zelle/processing" element={<ZellePaymentProcessing />} />
        <Route path="/checkout/split-payment/redirect" element={<SplitPaymentRedirect />} />

        {/* Generic Password Recovery Routes */}
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Seller Routes */}
        <Route path="/seller/login" element={<SellerLogin />} />
        <Route path="/seller/register" element={<SellerRegister />} />
        <Route path="/seller/dashboard" element={<SellerRoute><SellerDashboardLayout /></SellerRoute>}>
          <Route index element={<DashboardOverviewRouter />} />
          {import.meta.env.DEV && (
            <>
              <Route path="team" element={<HeadOfSalesTeam />} />
              <Route path="team-orders" element={<HeadOfSalesOrders />} />
              <Route path="team-commissions" element={<HeadOfSalesCommissions />} />
              <Route path="team-total-sales" element={<HeadOfSalesTotalSales />} />
              <Route path="team-contract-approval" element={<HosVisaContractApprovalPage />} />
            </>
          )}
          <Route path="analytics" element={<SellerAnalytics />} />
          <Route path="commissions" element={<SellerCommissions />} />
          <Route path="funnel" element={<SellerFunnel />} />
          <Route path="orders" element={<SellerOrders />} />
          <Route path="links" element={<SellerLinks />} />
          <Route path="leads" element={<SellerLeads />} />
          <Route path="zelle-approvals" element={<SellerZelleApprovalPage />} />
        </Route>
        <Route path="/seller/orders/:orderId" element={<SellerRoute><SellerOrderDetail /></SellerRoute>} />

        <Route path="/global-partner/thank-you" element={<ThankYou />} />
        <Route path="/partner-terms" element={<PartnerTerms />} />
        <Route path="/partner-terms/success" element={<PartnerTermsSuccess />} />
        <Route path="/view-contract" element={<ViewSignedContract />} />
        <Route path="/view-visa-contract" element={<ViewVisaOrderContract />} />
        <Route path="/onboarding/closer" element={<iframe src="/onboarding/closer.html" style={{ width: '100%', height: '100vh', border: 'none' }} />} />
        <Route path="/onboarding/operations" element={<iframe src="/onboarding/operations.html" style={{ width: '100%', height: '100vh', border: 'none' }} />} />
        <Route path="/onboarding/mentor" element={<iframe src="/onboarding/mentor.html" style={{ width: '100%', height: '100vh', border: 'none' }} />} />
        <Route path="/pipeline-manager-reports" element={<iframe src="/pipeline-manager-reports.html" style={{ width: '100%', height: '100vh', border: 'none' }} />} />

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
          {import.meta.env.DEV && (
            <>
              <Route path="head-of-sales" element={<AdminRoute><HeadOfSalesManagement /></AdminRoute>} />
              <Route path="head-of-sales/:hosId/analytics" element={<AdminRoute><AdminHoSAnalytics /></AdminRoute>} />
            </>
          )}
          <Route path="sellers/:sellerId/analytics" element={<AdminRoute><AdminSellerAnalytics /></AdminRoute>} />
          <Route path="sellers/:sellerId/orders" element={<AdminRoute><AdminSellerOrders /></AdminRoute>} />
          <Route path="contact-messages" element={<ContactMessagesPage />} />
          <Route path="contact-messages/:id" element={<ContactMessageDetail />} />
          <Route path="contract-templates" element={<ContractTemplatesPage />} />
          <Route path="schedule-meeting" element={<ScheduleMeetingPage />} />
          <Route path="slack-reports" element={<SlackReportsPage />} />
          <Route path="eb3-recurring" element={<EB3RecurringManagement />} />
          <Route path="eb3-recurring/:id" element={<EB3RecurringDetail />} />
          <Route path="scholarship-recurring" element={<ScholarshipRecurringManagement />} />
          <Route path="scholarship-recurring/:id" element={<ScholarshipRecurringDetail />} />
          <Route path="profile" element={<AdminProfile />} />
          <Route path="send-existing-contracts" element={<SendExistingContracts />} />
          <Route path="links" element={<SellerLinks />} />
          <Route path="coupons" element={<CouponManagement />} />
          <Route path="sync-sales" element={<AdminRoute><AdminSyncSales /></AdminRoute>} />
        </Route>

        {/* Catch-all 404 Route */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  );
}

export default App;
