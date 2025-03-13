import { Card, CardContent } from "@/components/ui/card";
import { MapPin, AlertCircle, CheckCircle, Globe, Server, Clock, Building, MapIcon } from "lucide-react";
import { GeoData } from "@/types";
import { motion } from "framer-motion";

interface ProxyTestResultsProps {
  isLoading: boolean;
  error: string | null;
  geoData: GeoData | null;
}

export function ProxyTestResults({ isLoading, error, geoData }: ProxyTestResultsProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
    >
      <Card className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 overflow-hidden shadow-xl rounded-xl h-full">
        <CardContent className="p-6">
          <div className="flex items-center space-x-3 mb-6">
            <div className="relative flex-shrink-0">
              <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-blue-500 rounded-full blur opacity-75"></div>
              <div className="relative bg-gray-900 rounded-full p-2">
                <Globe className="h-5 w-5 text-white" />
              </div>
            </div>
            <h3 className="text-xl font-bold text-white">Geolocation Details</h3>
          </div>

          {/* Loading state */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="relative">
                <div className="h-24 w-24 rounded-full border-t-2 border-b-2 border-purple-500 animate-spin"></div>
                <div className="absolute top-0 left-0 h-24 w-24 rounded-full border-t-2 border-b-2 border-blue-500 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
              </div>
              <p className="mt-6 text-sm text-gray-300 font-medium">Testing proxy connection...</p>
            </div>
          )}

          {/* Empty state */}
          {!isLoading && !error && !geoData && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="relative">
                <div className="absolute -inset-1 bg-gradient-to-r from-purple-600/20 to-blue-500/20 rounded-full blur-md"></div>
                <div className="relative bg-gray-800 rounded-full p-6">
                  <MapPin className="h-12 w-12 text-gray-400" />
                </div>
              </div>
              <h3 className="mt-6 text-lg font-medium text-white">No proxy tested yet</h3>
              <p className="mt-2 text-sm text-gray-400 max-w-xs mx-auto">Enter your proxy credentials and test the connection to see geolocation details.</p>
            </div>
          )}

          {/* Error state */}
          {!isLoading && error && (
            <motion.div 
              className="mt-2"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2 }}
            >
              <div className="rounded-xl bg-red-900/20 border border-red-700/50 p-5">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <div className="p-2 bg-red-900/50 rounded-full">
                      <AlertCircle className="h-6 w-6 text-red-400" />
                    </div>
                  </div>
                  <div className="ml-4">
                    <h3 className="text-base font-medium text-red-300">Proxy Test Failed</h3>
                    <div className="mt-2 text-sm text-red-200">
                      <p>{error}</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Success state */}
          {!isLoading && !error && geoData && (
            <motion.div 
              className="mt-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
            >
              <div className="rounded-xl bg-green-900/20 border border-green-700/50 p-5 mb-6">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <div className="p-2 bg-green-900/50 rounded-full">
                      <CheckCircle className="h-6 w-6 text-green-400" />
                    </div>
                  </div>
                  <div className="ml-4">
                    <h3 className="text-base font-medium text-green-300">Proxy test successful!</h3>
                    <p className="mt-1 text-sm text-green-200">Connection established successfully.</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {renderGeoItem("Country", geoData.country, <MapIcon className="h-5 w-5 text-purple-400" />)}
                {renderGeoItem("City", geoData.city, <MapPin className="h-5 w-5 text-blue-400" />)}
                {renderGeoItem("Region", geoData.region, <Globe className="h-5 w-5 text-purple-400" />)}
                {renderGeoItem("Postal Code", geoData.postalCode, <MapPin className="h-5 w-5 text-blue-400" />)}
                {renderGeoItem("Coordinates", 
                  geoData.latitude && geoData.longitude ? `${geoData.latitude}, ${geoData.longitude}` : "-", 
                  <MapPin className="h-5 w-5 text-purple-400" />
                )}
                {renderGeoItem("Timezone", geoData.timezone, <Clock className="h-5 w-5 text-blue-400" />)}
                {renderGeoItem("ASN", geoData.asn, <Server className="h-5 w-5 text-purple-400" />)}
                {renderGeoItem("Organization", geoData.organization, <Building className="h-5 w-5 text-blue-400" />)}
              </div>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
  
  function renderGeoItem(label: string, value: string | null | undefined, icon: React.ReactNode) {
    return (
      <div className="bg-gray-900/50 rounded-lg p-4 flex items-center">
        <div className="mr-3">
          {icon}
        </div>
        <div>
          <p className="text-xs text-gray-400">{label}</p>
          <p className="text-sm font-medium text-white">{value || "-"}</p>
        </div>
      </div>
    );
  }
}
