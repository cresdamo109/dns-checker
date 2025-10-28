import { useState } from "react";
import "@/App.css";
import axios from "axios";
import { Search, Loader2, AlertCircle, CheckCircle, XCircle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function App() {
  const [ipAddress, setIpAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState("");

  const handleQuery = async () => {
    if (!ipAddress.trim()) {
      setError("Please enter an IP address to check");
      return;
    }

    setLoading(true);
    setError("");
    setResults(null);

    try {
      const response = await axios.post(`${API}/dns-query`, {
        ip: ipAddress.trim()
      });
      setResults(response.data);
    } catch (e) {
      console.error(e);
      setError(e.response?.data?.detail || "Failed to query DNS blacklists. Please check the IP address and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleQuery();
    }
  };

  return (
    <div className="App">
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50">
        <div className="container mx-auto px-4 py-12 max-w-5xl">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
              DNS Blacklist Checker
            </h1>
            <p className="text-lg text-gray-600">
              Check if an IP address is listed in DNS blacklists (DNSBL/RBL)
            </p>
          </div>

          {/* Search Card */}
          <Card className="mb-8 shadow-lg border-0 bg-white/80 backdrop-blur-sm" data-testid="search-card">
            <CardHeader>
              <CardTitle className="text-2xl">IP Address to Check</CardTitle>
              <CardDescription>
                Enter an IPv4 address to check against multiple DNS blacklists
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3">
                <Input
                  data-testid="ip-input"
                  type="text"
                  placeholder="e.g., 8.8.8.8"
                  value={ipAddress}
                  onChange={(e) => setIpAddress(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="text-lg py-6"
                  disabled={loading}
                />
                <Button
                  data-testid="query-button"
                  onClick={handleQuery}
                  disabled={loading}
                  className="px-8 py-6 text-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Checking...
                    </>
                  ) : (
                    <>
                      <Search className="mr-2 h-5 w-5" />
                      Check IP
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Error Alert */}
          {error && (
            <Alert variant="destructive" className="mb-8" data-testid="error-alert">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Results */}
          {results && (
            <div className="space-y-6" data-testid="results-container">
              {/* Summary Card */}
              <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Checked IP Address</p>
                      <p className="text-2xl font-bold text-gray-800">{results.query_ip}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Reversed IP (for DNSBL lookup)</p>
                      <p className="text-xl font-mono text-gray-700">{results.reversed_ip}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Info about listing */}
              <Alert className="bg-blue-50 border-blue-200" data-testid="info-alert">
                <Info className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800">
                  Each blacklist is queried by looking up: <span className="font-mono">{results.reversed_ip}.[domain]</span>
                  <br />
                  If a DNS A record is returned, the IP is listed on that blacklist.
                </AlertDescription>
              </Alert>

              {/* Blacklist Results */}
              <div className="space-y-4">
                <h2 className="text-2xl font-semibold text-gray-800 mb-4">Blacklist Results</h2>
                
                <div className="grid gap-4">
                  {results.results.map((result, index) => (
                    <Card
                      key={index}
                      data-testid={`result-card-${index}`}
                      className="shadow-md border-0 bg-white/80 backdrop-blur-sm hover:shadow-lg transition-shadow"
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-xl text-gray-800">
                            {result.domain}
                          </CardTitle>
                          {!result.error && (
                            result.is_listed ? (
                              <Badge variant="destructive" className="text-sm px-3 py-1" data-testid={`status-listed-${index}`}>
                                <XCircle className="w-4 h-4 mr-1" />
                                LISTED
                              </Badge>
                            ) : (
                              <Badge className="bg-green-600 hover:bg-green-700 text-sm px-3 py-1" data-testid={`status-not-listed-${index}`}>
                                <CheckCircle className="w-4 h-4 mr-1" />
                                NOT LISTED
                              </Badge>
                            )
                          )}
                        </div>
                      </CardHeader>
                      <CardContent>
                        {result.error ? (
                          <div className="flex items-center text-amber-600" data-testid={`error-${index}`}>
                            <AlertCircle className="h-4 w-4 mr-2" />
                            <span>{result.error}</span>
                          </div>
                        ) : result.is_listed ? (
                          <div className="space-y-2" data-testid={`listed-info-${index}`}>
                            <p className="text-sm text-gray-600 mb-2">This IP is listed on this blacklist. Response:</p>
                            {result.response_ips.map((ip, ipIndex) => (
                              <div
                                key={ipIndex}
                                className="px-4 py-2 bg-gradient-to-r from-red-50 to-orange-50 rounded-lg font-mono text-gray-800 border border-red-200"
                              >
                                {ip}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-green-700 flex items-center" data-testid={`not-listed-info-${index}`}>
                            <CheckCircle className="h-4 w-4 mr-2" />
                            This IP is not listed on this blacklist (clean)
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Info Section */}
          {!results && !error && !loading && (
            <Card className="bg-white/60 backdrop-blur-sm border-0 shadow-md" data-testid="info-card">
              <CardContent className="pt-6">
                <h3 className="text-lg font-semibold mb-3 text-gray-800">Blacklists checked:</h3>
                <ul className="space-y-2 text-gray-700">
                  <li className="flex items-center">
                    <span className="w-2 h-2 bg-emerald-600 rounded-full mr-3"></span>
                    wl.none.hjrp-server.com
                  </li>
                  <li className="flex items-center">
                    <span className="w-2 h-2 bg-teal-600 rounded-full mr-3"></span>
                    wl.med.hjrp-server.com
                  </li>
                  <li className="flex items-center">
                    <span className="w-2 h-2 bg-cyan-600 rounded-full mr-3"></span>
                    wl.hi.hjrp-server.com
                  </li>
                  <li className="flex items-center">
                    <span className="w-2 h-2 bg-blue-600 rounded-full mr-3"></span>
                    bl.hjrp-server.com
                  </li>
                </ul>
                <div className="mt-6 p-4 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-lg">
                  <p className="text-sm text-gray-700">
                    <strong>How it works:</strong> Your IP is reversed (e.g., 1.2.3.4 becomes 4.3.2.1) and combined with each blacklist domain. 
                    If a DNS record is found, your IP is listed on that blacklist.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
