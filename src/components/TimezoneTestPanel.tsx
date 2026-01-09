import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  getTodayDateEST, 
  getCurrentTimestampEST, 
  formatDateESTLocale,
  getCurrentDateEST 
} from '@/lib/dateUtils';

export const TimezoneTestPanel: React.FC = () => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [testResults, setTestResults] = useState<any>({});

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const runTests = () => {
    const systemTime = new Date();
    const estDate = getCurrentDateEST();
    
    const results = {
      systemTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      systemTime: systemTime.toLocaleString(),
      systemUTC: systemTime.toISOString(),
      
      // EST Utility Functions
      getTodayDateEST: getTodayDateEST(),
      getCurrentTimestampEST: getCurrentTimestampEST(), 
      formatDateESTLocale: formatDateESTLocale(),
      getCurrentDateEST: estDate.toLocaleString(),
      getCurrentDateEST_ISO: estDate.toISOString(),
      
      // Manual EST calculation for comparison
      manualEST: new Date(systemTime.getTime() - (5 * 60 * 60 * 1000)).toISOString(),
      manualEDT: new Date(systemTime.getTime() - (4 * 60 * 60 * 1000)).toISOString(),
      
      // Test DST detection
      isDSTPeriod: (() => {
        const year = systemTime.getFullYear();
        const marchSecondSunday = new Date(year, 2, 8 + (7 - new Date(year, 2, 8).getDay()) % 7);
        const novemberFirstSunday = new Date(year, 10, 1 + (7 - new Date(year, 10, 1).getDay()) % 7);
        return systemTime >= marchSecondSunday && systemTime < novemberFirstSunday;
      })(),
      
      timestamp: new Date().toLocaleString()
    };
    
    setTestResults(results);
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>EST Timezone Testing Panel</CardTitle>
        <p className="text-sm text-gray-600">
          Current System Time: {currentTime.toLocaleString()}
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Button onClick={runTests} className="mb-4">
            Run EST Tests
          </Button>
          
          {Object.keys(testResults).length > 0 && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold mb-2">Test Results:</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                {Object.entries(testResults).map(([key, value]) => (
                  <div key={key} className="flex justify-between border-b pb-1">
                    <span className="font-medium text-blue-600">{key}:</span>
                    <span className="text-right">{String(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <h3 className="font-semibold text-blue-800 mb-2">Testing Instructions:</h3>
            <ol className="list-decimal list-inside space-y-1 text-sm text-blue-700">
              <li>Click "Run EST Tests" to see current timezone calculations</li>
              <li>Check if <code>getTodayDateEST</code> matches EST date format (YYYY-MM-DD)</li>
              <li>Verify <code>getCurrentTimestampEST</code> shows correct EST time</li>
              <li>Compare manual EST/EDT calculations with utility functions</li>
              <li>Test during DST transition periods (March/November)</li>
              <li>Test creating new entries in Daily Deal Flow page</li>
              <li>Test date filtering to ensure consistency</li>
            </ol>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};