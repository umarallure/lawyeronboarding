import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Phone, Mail, MapPin, DollarSign } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Lawyer {
  id: string;
  submission_id: string;
  customer_full_name: string;
  phone_number: string;
  email: string;
  street_address: string;
  city: string;
  state: string;
  zip_code: string;
  date_of_birth: string;
  age: number;
  additional_notes: string;
  lead_vendor?: string;
  // Accident/Incident fields
  accident_date?: string;
  accident_location?: string;
  accident_scenario?: string;
  injuries?: string;
  medical_attention?: string;
  police_attended?: boolean;
  insured?: boolean;
  vehicle_registration?: string;
  insurance_company?: string;
  third_party_vehicle_registration?: string;
  other_party_admit_fault?: boolean;
  passengers_count?: number;
  prior_attorney_involved?: boolean;
  prior_attorney_details?: string;
  contact_name?: string;
  contact_number?: string;
  contact_address?: string;
}

interface LawyerInfoCardProps {
  lawyer: Lawyer;
}

export const LawyerInfoCard = ({ lawyer }: LawyerInfoCardProps) => {
  const { toast } = useToast();

  const copyToClipboard = () => {
    const lawyerInfo = `
Lawyer Information:
Name: ${lawyer.customer_full_name}
Phone: ${lawyer.phone_number}
Email: ${lawyer.email}
Address: ${lawyer.street_address}, ${lawyer.city}, ${lawyer.state} ${lawyer.zip_code}
Date of Birth: ${lawyer.date_of_birth}
Age: ${lawyer.age}

Accident/Incident Information:
Accident Date: ${lawyer.accident_date || 'N/A'}
Accident Location: ${lawyer.accident_location || 'N/A'}
Accident Scenario: ${lawyer.accident_scenario || 'N/A'}
Injuries: ${lawyer.injuries || 'N/A'}
Medical Attention: ${lawyer.medical_attention || 'N/A'}
Police Attended: ${lawyer.police_attended ? 'Yes' : 'No'}
Insured: ${lawyer.insured ? 'Yes' : 'No'}
Vehicle Registration: ${lawyer.vehicle_registration || 'N/A'}
Insurance Company: ${lawyer.insurance_company || 'N/A'}
Third Party Vehicle Registration: ${lawyer.third_party_vehicle_registration || 'N/A'}
Other Party Admit Fault: ${lawyer.other_party_admit_fault ? 'Yes' : 'No'}
Passengers Count: ${lawyer.passengers_count || 0}
Prior Attorney Involved: ${lawyer.prior_attorney_involved ? 'Yes' : 'No'}
Prior Attorney Details: ${lawyer.prior_attorney_details || 'N/A'}

Witness/Contact Information:
Contact Name: ${lawyer.contact_name || 'N/A'}
Contact Number: ${lawyer.contact_number || 'N/A'}
Contact Address: ${lawyer.contact_address || 'N/A'}

Notes: ${lawyer.additional_notes}
Submission ID: ${lawyer.submission_id}
    `.trim();

    navigator.clipboard.writeText(lawyerInfo);
    toast({
      title: "Copied!",
      description: "Lawyer information copied to clipboard",
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2">
          Lawyer Information
        </CardTitle>
        <Button onClick={copyToClipboard} variant="outline" size="sm" className="w-full sm:w-auto">
          <Copy className="h-4 w-4 mr-2" />
          Copy Basic Info
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div>
              <h3 className="font-semibold text-lg">{lawyer.customer_full_name}</h3>
              <p className="text-sm text-muted-foreground">Age: {lawyer.age}</p>
              <p className="text-sm text-muted-foreground">DOB: {lawyer.date_of_birth}</p>
            </div>
            
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4" />
              <span className="break-all">{lawyer.phone_number}</span>
            </div>
            
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              <span className="break-all">{lawyer.email}</span>
            </div>
            
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 mt-1" />
              <div>
                <div>{lawyer.street_address}</div>
                <div>{lawyer.city}, {lawyer.state} {lawyer.zip_code}</div>
              </div>
            </div>
          </div>
          
          <div className="space-y-3">
            <div>
              <h4 className="font-medium">Accident Information</h4>
              {lawyer.accident_date && <p className="text-sm">Date: {lawyer.accident_date}</p>}
              {lawyer.accident_location && <p className="text-sm">Location: {lawyer.accident_location}</p>}
              {lawyer.injuries && <p className="text-sm">Injuries: {lawyer.injuries}</p>}
            </div>
          </div>
        </div>
        
        {lawyer.additional_notes && (
          <div className="mt-4 p-3 bg-muted rounded-lg">
            <h4 className="font-medium mb-2">Additional Notes:</h4>
            <p className="text-sm">{lawyer.additional_notes}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};