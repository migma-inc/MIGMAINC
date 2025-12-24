import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export const VisaServiceTerms = () => {
  return (
    <div className="min-h-screen bg-black py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <Link to="/" className="inline-flex items-center text-gold-light hover:text-gold-medium transition mb-8">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Home
        </Link>

        <div className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 rounded-lg p-8 border border-gold-medium/30">
          <h1 className="text-4xl font-bold migma-gold-text mb-8">Website Terms of Use – MIGMA Inc.</h1>
          
          <div className="space-y-6 text-gray-300">
            <section>
              <p className="leading-relaxed">
                These Website Terms of Use ("Terms") govern your access to and use of the website operated by MIGMA Inc. ("MIGMA", "we", "our", or "us"). By accessing or using this website, you agree to be bound by these Terms. If you do not agree, you must discontinue use of the website.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gold-light mb-4">1. Acceptance of Terms</h2>
              <p className="leading-relaxed">
                By accessing, browsing, or using this website, you acknowledge that you have read, understood, and agreed to these Terms, as well as our Privacy Policy and any other legal notices published on the website.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gold-light mb-4">2. Use License</h2>
              <p className="leading-relaxed mb-4">
                MIGMA grants you a limited, non-exclusive, non-transferable, and revocable license to access and use the website for informational and personal purposes only.
              </p>
              <p className="leading-relaxed mb-4">
                You may not:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Modify, copy, reproduce, distribute, or republish website content without prior written consent</li>
                <li>Use the website for unlawful or prohibited purposes</li>
                <li>Attempt to gain unauthorized access to systems or data</li>
                <li>Use the website in a manner that could damage, disable, or impair its operation</li>
              </ul>
              <p className="leading-relaxed mt-4">
                All intellectual property rights remain the exclusive property of MIGMA or its licensors.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gold-light mb-4">3. Disclaimer</h2>
              <p className="leading-relaxed mb-4">
                The content on this website is provided for general informational purposes only. MIGMA makes no warranties or representations regarding the accuracy, completeness, or reliability of any content.
              </p>
              <p className="leading-relaxed mb-4">
                MIGMA does not provide legal, immigration, governmental, or regulatory services, and nothing on this website constitutes professional advice of any kind.
              </p>
              <p className="leading-relaxed">
                Use of the website and reliance on its content is at your own risk.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gold-light mb-4">4. Limitations of Liability</h2>
              <p className="leading-relaxed">
                To the fullest extent permitted by law, MIGMA shall not be liable for any direct, indirect, incidental, consequential, or special damages arising out of or related to the use or inability to use this website, including but not limited to loss of data, revenue, or business opportunities.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gold-light mb-4">5. Accuracy of Materials</h2>
              <p className="leading-relaxed">
                While MIGMA strives to keep website content accurate and up to date, we do not warrant that all materials are current, complete, or free from errors. MIGMA reserves the right to modify content at any time without notice.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gold-light mb-4">6. Links to Third-Party Websites</h2>
              <p className="leading-relaxed mb-4">
                This website may contain links to third-party websites for convenience or informational purposes. MIGMA does not control, endorse, or assume responsibility for the content, policies, or practices of third-party websites.
              </p>
              <p className="leading-relaxed">
                Access to third-party websites is at your own discretion and risk.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gold-light mb-4">7. Modifications</h2>
              <p className="leading-relaxed">
                MIGMA reserves the right to revise or update these Terms at any time without prior notice. Changes become effective upon publication on the website. Continued use of the website after updates constitutes acceptance of the revised Terms.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gold-light mb-4">8. Governing Law</h2>
              <p className="leading-relaxed">
                These Terms shall be governed by and construed in accordance with the laws of the State of Arizona, United States, without regard to conflict of law principles.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gold-light mb-4">9. Contact</h2>
              <p className="leading-relaxed mb-4">
                For questions regarding these Terms, please contact:
              </p>
              <div className="bg-black/50 rounded-lg p-4 space-y-2">
                <p>
                  <a href="mailto:adm@migmainc.com" className="text-gold-light hover:text-gold-medium transition">
                    adm@migmainc.com
                  </a>
                </p>
              </div>
            </section>

            <div className="border-t border-gold-medium/30 pt-6 mt-8">
              <p className="text-sm text-gray-400">
                ©️ MIGMA Inc. – All rights reserved.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};














