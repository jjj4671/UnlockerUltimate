import { BarChart, Clock, AlertTriangle, CheckCheck, RotateCcw, Activity, Share2, Database } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Stats } from "@/types";

interface StatCardsProps {
  stats: Stats;
  onReset?: () => void;
}

export function StatCards({ stats, onReset }: StatCardsProps) {
  const successRate = stats.totalRequests > 0 
    ? ((stats.totalRequests - stats.failedRequests) / stats.totalRequests * 100).toFixed(0) 
    : "0";
  
  const avgResponseTime = stats.totalRequests > 0 
    ? stats.avgResponseTime.toFixed(2) 
    : "0.00";
  
  const failureRate = stats.totalRequests > 0
    ? (stats.failedRequests / stats.totalRequests * 100).toFixed(0)
    : "0";
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg leading-6 font-medium text-white flex items-center">
          <Activity className="mr-2 h-5 w-5 text-blue-400" />
          Performance Overview
        </h3>
        {onReset && (
          <Button
            onClick={onReset}
            variant="outline"
            size="sm"
            className="text-gray-300 border-gray-600 hover:bg-gray-700"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset Stats
          </Button>
        )}
      </div>
      
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card className="bg-gray-800 border-gray-700 overflow-hidden shadow rounded-lg">
          <CardContent className="p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-indigo-500 rounded-md p-2">
                <BarChart className="h-5 w-5 text-white" />
              </div>
              <div className="ml-3 flex-1">
                <div className="text-xs font-medium text-gray-300 truncate">
                  Total Requests
                </div>
                <div className="text-lg font-medium text-white">
                  {stats.totalRequests}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gray-800 border-gray-700 overflow-hidden shadow rounded-lg">
          <CardContent className="p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-green-500 rounded-md p-2">
                <CheckCheck className="h-5 w-5 text-white" />
              </div>
              <div className="ml-3 flex-1">
                <div className="text-xs font-medium text-gray-300 truncate">
                  Success Rate
                </div>
                <div className="text-lg font-medium text-white">
                  {successRate}%
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gray-800 border-gray-700 overflow-hidden shadow rounded-lg">
          <CardContent className="p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-red-500 rounded-md p-2">
                <AlertTriangle className="h-5 w-5 text-white" />
              </div>
              <div className="ml-3 flex-1">
                <div className="text-xs font-medium text-gray-300 truncate">
                  Failed Requests
                </div>
                <div className="text-lg font-medium text-white">
                  {stats.failedRequests}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gray-800 border-gray-700 overflow-hidden shadow rounded-lg">
          <CardContent className="p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-blue-500 rounded-md p-2">
                <Clock className="h-5 w-5 text-white" />
              </div>
              <div className="ml-3 flex-1">
                <div className="text-xs font-medium text-gray-300 truncate">
                  Avg. Response Time
                </div>
                <div className="text-lg font-medium text-white">
                  {avgResponseTime}s
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      <div className="mt-6">
        <Card className="bg-gray-800 border-gray-700">
          <CardContent className="p-5">
            <h4 className="text-md font-medium text-white mb-4 flex items-center">
              <Share2 className="mr-2 h-4 w-4 text-indigo-400" />
              Success/Failure Distribution
            </h4>
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-green-400">Success ({successRate}%)</span>
                  <span className="text-gray-400">{stats.totalRequests - stats.failedRequests} requests</span>
                </div>
                <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-green-500 rounded-full"
                    style={{ width: `${successRate}%` }}
                  ></div>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-red-400">Failure ({failureRate}%)</span>
                  <span className="text-gray-400">{stats.failedRequests} requests</span>
                </div>
                <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-red-500 rounded-full"
                    style={{ width: `${failureRate}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      <div className="mt-6">
        <Card className="bg-gray-800 border-gray-700">
          <CardContent className="p-5">
            <h4 className="text-md font-medium text-white mb-4 flex items-center">
              <Database className="mr-2 h-4 w-4 text-blue-400" />
              Performance Insights
            </h4>
            <div className="text-sm text-gray-300 space-y-3">
              <p>
                • {parseInt(successRate) > 80 ? "Strong" : parseInt(successRate) > 50 ? "Moderate" : "Poor"} unlocker 
                performance with {successRate}% success rate.
              </p>
              <p>
                • Average response time of {avgResponseTime}s across {stats.totalRequests} requests.
              </p>
              {stats.totalRequests > 0 && (
                <p>
                  • {stats.failedRequests === 0 
                    ? "No failures detected in this test batch." 
                    : `${stats.failedRequests} failed requests identified. Consider adjusting headers or cookies.`}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
