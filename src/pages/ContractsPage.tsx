import { useState, useEffect } from 'react';
import { FileText, Download, Eye, FileDown, User, MapPin, Hash, FileCode, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { fetchAcceptedContracts, getContractPdfUrl, getCvFileUrl, type AcceptedContract } from '@/lib/contracts';
import { Badge } from '@/components/ui/badge';

export function ContractsPage() {
  const [contracts, setContracts] = useState<AcceptedContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedContract, setSelectedContract] = useState<AcceptedContract | null>(null);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [showCvModal, setShowCvModal] = useState(false);

  useEffect(() => {
    loadContracts();
  }, []);

  const loadContracts = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchAcceptedContracts();
      setContracts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load contracts');
    } finally {
      setLoading(false);
    }
  };

  const handleViewContract = (contract: AcceptedContract) => {
    setSelectedContract(contract);
    setShowPdfModal(true);
  };

  const handleDownloadContract = async (contract: AcceptedContract) => {
    const pdfUrl = getContractPdfUrl(contract);
    if (!pdfUrl) {
      alert('Contract PDF not available');
      return;
    }

    try {
      const response = await fetch(pdfUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `contract_${contract.application?.full_name || contract.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Error downloading contract:', err);
      alert('Failed to download contract');
    }
  };

  const handleViewCv = (contract: AcceptedContract) => {
    if (!contract.application?.cv_file_path) {
      alert('CV not available');
      return;
    }
    setSelectedContract(contract);
    setShowCvModal(true);
  };

  const handleDownloadCv = async (contract: AcceptedContract) => {
    if (!contract.application?.cv_file_path) {
      alert('CV not available');
      return;
    }

    const cvUrl = getCvFileUrl(contract.application.cv_file_path);
    if (!cvUrl) {
      alert('CV URL not available');
      return;
    }

    try {
      const response = await fetch(cvUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = contract.application.cv_file_name || 'cv.pdf';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Error downloading CV:', err);
      alert('Failed to download CV');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-medium mx-auto"></div>
          <p className="mt-4 text-gray-400">Loading contracts...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-red-300 mb-4">{error}</p>
              <Button onClick={loadContracts} variant="outline" className="border-gold-medium/50 bg-black/50 text-white hover:bg-gold-medium/30 hover:text-gold-light">Retry</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold migma-gold-text mb-2">Accepted Contracts</h1>
        <p className="text-gray-400">View and manage all accepted partner contracts</p>
      </div>

      {contracts.length === 0 ? (
        <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <FileText className="w-16 h-16 text-gray-500 mx-auto mb-4" />
              <p className="text-gray-400 text-lg">No accepted contracts yet</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {contracts.map((contract) => (
            <Card key={contract.id} className="hover:shadow-lg transition-shadow bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-xl mb-2 text-white">
                      {contract.application?.full_name || 'Unknown Partner'}
                    </CardTitle>
                    <div className="flex flex-wrap gap-2 text-sm text-gray-400">
                      <span className="flex items-center gap-1">
                        <User className="w-4 h-4" />
                        {contract.application?.email}
                      </span>
                      <span>•</span>
                      <span>{contract.application?.country}</span>
                      <span>•</span>
                      <span>Accepted: {formatDate(contract.accepted_at)}</span>
                    </div>
                  </div>
                  <Badge variant="default" className="bg-green-600 text-white">
                    Accepted
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {/* Legal Information Section */}
                {(contract.contract_version || contract.contract_hash || contract.geolocation_country || contract.signature_name) && (
                  <div className="mb-4 p-3 bg-black/30 rounded-lg border border-gold-medium/20">
                    <h4 className="text-sm font-semibold text-gold-light mb-3 flex items-center gap-2">
                      <FileCode className="w-4 h-4" />
                      Legal Records
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      {contract.contract_version && (
                        <div className="flex items-start gap-2">
                          <FileCode className="w-4 h-4 text-gold-medium mt-0.5 flex-shrink-0" />
                          <div>
                            <span className="text-gray-400">Contract Version:</span>
                            <span className="text-white ml-2 font-mono">{contract.contract_version}</span>
                          </div>
                        </div>
                      )}
                      {contract.contract_hash && (
                        <div className="flex items-start gap-2">
                          <Hash className="w-4 h-4 text-gold-medium mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <span className="text-gray-400">Contract Hash:</span>
                            <span className="text-white ml-2 font-mono text-xs break-all">{contract.contract_hash.substring(0, 32)}...</span>
                          </div>
                        </div>
                      )}
                      {(contract.geolocation_country || contract.geolocation_city) && (
                        <div className="flex items-start gap-2">
                          <MapPin className="w-4 h-4 text-gold-medium mt-0.5 flex-shrink-0" />
                          <div>
                            <span className="text-gray-400">Location:</span>
                            <span className="text-white ml-2">
                              {[contract.geolocation_city, contract.geolocation_country].filter(Boolean).join(', ') || 'N/A'}
                            </span>
                          </div>
                        </div>
                      )}
                      {contract.signature_name && (
                        <div className="flex items-start gap-2">
                          <User className="w-4 h-4 text-gold-medium mt-0.5 flex-shrink-0" />
                          <div>
                            <span className="text-gray-400">Digital Signature:</span>
                            <span className="text-white ml-2">{contract.signature_name}</span>
                          </div>
                        </div>
                      )}
                      {contract.ip_address && (
                        <div className="flex items-start gap-2">
                          <Globe className="w-4 h-4 text-gold-medium mt-0.5 flex-shrink-0" />
                          <div>
                            <span className="text-gray-400">IP Address:</span>
                            <span className="text-white ml-2 font-mono text-xs">{contract.ip_address}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  {contract.contract_pdf_url && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewContract(contract)}
                        className="flex items-center gap-2 border-gold-medium/50 bg-black/50 text-white hover:bg-gold-medium/30 hover:text-gold-light"
                      >
                        <Eye className="w-4 h-4" />
                        View Contract
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownloadContract(contract)}
                        className="flex items-center gap-2 border-gold-medium/50 bg-black/50 text-white hover:bg-gold-medium/30 hover:text-gold-light"
                      >
                        <Download className="w-4 h-4" />
                        Download Contract
                      </Button>
                    </>
                  )}
                  {contract.application?.cv_file_path && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewCv(contract)}
                        className="flex items-center gap-2 border-gold-medium/50 bg-black/50 text-white hover:bg-gold-medium/30 hover:text-gold-light"
                      >
                        <Eye className="w-4 h-4" />
                        View CV
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownloadCv(contract)}
                        className="flex items-center gap-2 border-gold-medium/50 bg-black/50 text-white hover:bg-gold-medium/30 hover:text-gold-light"
                      >
                        <FileDown className="w-4 h-4" />
                        Download CV
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* PDF Modal */}
      {showPdfModal && selectedContract && selectedContract.contract_pdf_url && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gold-medium/30">
              <h3 className="text-lg font-semibold text-white">
                Contract - {selectedContract.application?.full_name}
              </h3>
              <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownloadContract(selectedContract)}
                    className="border-gold-medium/50 bg-black/50 text-white hover:bg-gold-medium/30 hover:text-gold-light"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </Button>
                <Button variant="outline" size="sm" onClick={() => setShowPdfModal(false)} className="border-gold-medium/50 bg-black/50 text-white hover:bg-black/50 hover:text-white">
                  Close
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <iframe
                src={selectedContract.contract_pdf_url}
                className="w-full h-full min-h-[600px] border-0"
                title="Contract PDF"
              />
            </div>
          </div>
        </div>
      )}

      {/* CV Modal */}
      {showCvModal && selectedContract && selectedContract.application?.cv_file_path && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gold-medium/30">
              <h3 className="text-lg font-semibold text-white">
                CV - {selectedContract.application?.full_name}
              </h3>
              <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownloadCv(selectedContract)}
                    className="border-gold-medium/50 bg-black/50 text-white hover:bg-gold-medium/30 hover:text-gold-light"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </Button>
                <Button variant="outline" size="sm" onClick={() => setShowCvModal(false)} className="border-gold-medium/50 bg-black/50 text-white hover:bg-black/50 hover:text-white">
                  Close
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <iframe
                src={getCvFileUrl(selectedContract.application.cv_file_path) || ''}
                className="w-full h-full min-h-[600px] border-0"
                title="CV PDF"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

