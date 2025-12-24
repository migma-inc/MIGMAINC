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
          <h1 className="text-4xl font-bold migma-gold-text mb-8">Visa Service Terms & Conditions</h1>
          
          <div className="space-y-6 text-gray-300">
            <section>
              <h2 className="text-2xl font-bold text-gold-light mb-4">1. Service Agreement</h2>
              <p className="leading-relaxed">
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. 
                Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gold-light mb-4">2. Service Description</h2>
              <p className="leading-relaxed mb-4">
                Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. 
                Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Consultation and application guidance</li>
                <li>Document preparation and review</li>
                <li>Interview preparation (if applicable)</li>
                <li>Application submission assistance</li>
                <li>Follow-up support throughout the process</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gold-light mb-4">3. Payment Terms</h2>
              <p className="leading-relaxed mb-4">
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Payments are processed securely through our payment partners:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong>Credit/Debit Card & PIX:</strong> Processed through Stripe</li>
                <li><strong>Zelle:</strong> Transfer verification required</li>
                <li>All prices are listed in USD</li>
                <li>Additional dependent fees apply as indicated</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gold-light mb-4">4. Refund Policy</h2>
              <p className="leading-relaxed">
                Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, 
                totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gold-light mb-4">5. Client Responsibilities</h2>
              <p className="leading-relaxed mb-4">
                Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Provide accurate and complete information</li>
                <li>Submit requested documents in a timely manner</li>
                <li>Attend scheduled consultations and interviews</li>
                <li>Respond promptly to our communications</li>
                <li>Comply with all visa requirements and regulations</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gold-light mb-4">6. Service Limitations</h2>
              <p className="leading-relaxed">
                At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praesentium voluptatum deleniti atque corrupti 
                quos dolores et quas molestias excepturi sint occaecati cupiditate non provident.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gold-light mb-4">7. Confidentiality</h2>
              <p className="leading-relaxed">
                Similique sunt in culpa qui officia deserunt mollitia animi, id est laborum et dolorum fuga. 
                Et harum quidem rerum facilis est et expedita distinctio.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gold-light mb-4">8. Liability</h2>
              <p className="leading-relaxed">
                Nam libero tempore, cum soluta nobis est eligendi optio cumque nihil impedit quo minus id quod maxime placeat 
                facere possimus, omnis voluptas assumenda est, omnis dolor repellendus.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gold-light mb-4">9. Governing Law</h2>
              <p className="leading-relaxed">
                Temporibus autem quibusdam et aut officiis debitis aut rerum necessitatibus saepe eveniet ut et voluptates 
                repudiandae sint et molestiae non recusandae.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gold-light mb-4">10. Contact Information</h2>
              <p className="leading-relaxed mb-4">
                For questions regarding these terms, please contact us:
              </p>
              <div className="bg-black/50 rounded-lg p-4 space-y-2">
                <p><strong className="text-gold-light">MIGMA INC</strong></p>
                <p>Email: info@migma.com</p>
                <p>Phone: +1 (XXX) XXX-XXXX</p>
              </div>
            </section>

            <div className="border-t border-gold-medium/30 pt-6 mt-8">
              <p className="text-sm text-gray-400">
                Last Updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

























