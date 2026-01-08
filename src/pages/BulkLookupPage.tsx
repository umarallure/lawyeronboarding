import { useState } from "react";
import BulkLookup from "@/components/BulkLookup";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
 

const BulkLookupPage = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Description */}
          <div className="text-center">
            <p className="text-muted-foreground">
              Upload a CSV file to find duplicate entries with Pending Approval status
            </p>
          </div>

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle>How it works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-semibold mb-2">Input Requirements:</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• CSV file with phone number, lead vendor, and insured name columns</li>
                  <li>• Column headers should contain: phone, lead vendor, insured name</li>
                  <li>• One entry per row to check for duplicates</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2">What it finds:</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Multiple entries with same phone, lead vendor, and insured name</li>
                  <li>• At least one entry must have 'Pending Approval' status</li>
                  <li>• Returns all matching entries for review</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

          {/* Bulk Lookup Component */}
          <BulkLookup />
        </div>
      </div>
    </div>
  );
};

export default BulkLookupPage;