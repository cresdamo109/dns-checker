import { useState } from "react";
import "@/App.css";
import axios from "axios";
import { Search, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function App() {
  const [ipAddress, setIpAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState("");

  const handleQuery = async () => {
    if (!ipAddress.trim()) {
      setError("Please enter a DNS server IP address");
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
      setError(e.response?.data?.detail || "Failed to query DNS. Please check the IP address and try again.");
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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <div className="container mx-auto px-4 py-12 max-w-5xl">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              DNS Query Tool
            </h1>
            <p className="text-lg text-gray-600">
              Query multiple DNS servers and retrieve A records
            </p>
          </div>

          {/* Search Card */}
          <Card className="mb-8 shadow-lg border-0 bg-white/80 backdrop-blur-sm" data-testid="search-card">
            <CardHeader>
              <CardTitle className="text-2xl">DNS Server IP Address</CardTitle>
              <CardDescription>
                Enter the IP address of the DNS server you want to query
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
                  className="px-8 py-6 text-lg bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Querying...
                    </>
                  ) : (
                    <>
                      <Search className="mr-2 h-5 w-5" />
                      Query DNS
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
            <div className="space-y-4" data-testid="results-container">
              <div className="text-center mb-6">
                <p className="text-lg text-gray-700">
                  Query Results for DNS Server: <span className="font-semibold text-blue-600">{results.query_ip}</span>
                </p>
              </div>

              <div className="grid gap-4">
                {results.results.map((result, index) => (
                  <Card
                    key={index}
                    data-testid={`result-card-${index}`}
                    className="shadow-md border-0 bg-white/80 backdrop-blur-sm hover:shadow-lg transition-shadow"
                  >
                    <CardHeader className="pb-3">
                      <CardTitle className="text-xl text-gray-800">
                        {result.domain}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {result.error ? (
                        <div className="flex items-center text-red-600" data-testid={`error-${index}`}>
                          <AlertCircle className="h-4 w-4 mr-2" />
                          <span>{result.error}</span>
                        </div>
                      ) : result.ip_addresses.length > 0 ? (
                        <div className="space-y-2" data-testid={`ip-addresses-${index}`}>
                          {result.ip_addresses.map((ip, ipIndex) => (
                            <div
                              key={ipIndex}
                              className="px-4 py-2 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg font-mono text-gray-800"
                            >
                              {ip}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-500">No A records found</p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Info Section */}
          {!results && !error && !loading && (
            <Card className="bg-white/60 backdrop-blur-sm border-0 shadow-md" data-testid="info-card">
              <CardContent className="pt-6">
                <h3 className="text-lg font-semibold mb-3 text-gray-800">Domains queried:</h3>
                <ul className="space-y-2 text-gray-700">
                  <li className="flex items-center">
                    <span className="w-2 h-2 bg-blue-600 rounded-full mr-3"></span>
                    wl.none.hjrp-server.com
                  </li>
                  <li className="flex items-center">
                    <span className="w-2 h-2 bg-purple-600 rounded-full mr-3"></span>
                    wl.med.hjrp-server.com
                  </li>
                  <li className="flex items-center">
                    <span className="w-2 h-2 bg-indigo-600 rounded-full mr-3"></span>
                    wl.hi.hjrp-server.com
                  </li>
                  <li className="flex items-center">
                    <span className="w-2 h-2 bg-pink-600 rounded-full mr-3"></span>
                    bl.hjrp-server.com
                  </li>
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
