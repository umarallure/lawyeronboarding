import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';

type CenterCreateLeadModalProps = {
  open: boolean;
  onClose: () => void;
  onLeadCreated: () => void;
  leadVendor: string;
};

type LawyerFormData = {
  customer_full_name: string;
  phone_number: string;
  street_address: string;
  city: string;
  state: string;
  zip_code: string;
  email: string;
  date_of_birth: string;
  age: string;
  social_security: string;
  health_conditions: string;
  carrier: string;
  product_type: string;
  coverage_amount: string;
  monthly_premium: string;
  draft_date: string;
  future_draft_date: string;
  beneficiary_routing: string;
  beneficiary_account: string;
  additional_notes: string;
  birth_state: string;
  driver_license: string;
  existing_coverage: string;
  previous_applications: string;
  height: string;
  weight: string;
  doctors_name: string;
  tobacco_use: string;
  medications: string;
  beneficiary_information: string;
  institution_name: string;
  account_type: string;
};

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
];

export const CenterCreateLeadModal = ({ open, onClose, onLeadCreated, leadVendor }: CenterCreateLeadModalProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<LawyerFormData>({
    customer_full_name: '',
    phone_number: '',
    street_address: '',
    city: '',
    state: '',
    zip_code: '',
    email: '',
    date_of_birth: '',
    age: '',
    social_security: '',
    health_conditions: '',
    carrier: '',
    product_type: '',
    coverage_amount: '',
    monthly_premium: '',
    draft_date: '',
    future_draft_date: '',
    beneficiary_routing: '',
    beneficiary_account: '',
    additional_notes: '',
    birth_state: '',
    driver_license: '',
    existing_coverage: 'NO',
    previous_applications: 'NO',
    height: '',
    weight: '',
    doctors_name: '',
    tobacco_use: 'NO',
    medications: '',
    beneficiary_information: '',
    institution_name: '',
    account_type: 'Checking',
  });

  const generateSubmissionId = () => {
    const randomNumber = Math.floor(Math.random() * 10000000000).toString().padStart(10, '0');
    return `CBB${randomNumber}`;
  };

  const handleInputChange = (field: keyof LawyerFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    // Validate required fields
    if (!formData.customer_full_name.trim()) {
      toast({
        title: "Validation Error",
        description: "Customer name is required.",
        variant: "destructive",
      });
      return;
    }

    if (!formData.phone_number.trim()) {
      toast({
        title: "Validation Error",
        description: "Phone number is required.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const submissionId = generateSubmissionId();
      
      // Prepare the lawyer data
      const lawyerData = {
        submission_id: submissionId,
        submission_date: new Date().toISOString(),
        customer_full_name: formData.customer_full_name.trim(),
        phone_number: formData.phone_number.trim(),
        street_address: formData.street_address.trim() || null,
        city: formData.city.trim() || null,
        state: formData.state || null,
        zip_code: formData.zip_code.trim() || null,
        email: formData.email.trim() || null,
        date_of_birth: formData.date_of_birth || null,
        age: formData.age ? parseInt(formData.age) : null,
        social_security: formData.social_security.trim() || null,
        health_conditions: formData.health_conditions.trim() || null,
        carrier: formData.carrier.trim() || null,
        product_type: formData.product_type.trim() || null,
        coverage_amount: formData.coverage_amount ? parseFloat(formData.coverage_amount) : null,
        monthly_premium: formData.monthly_premium ? parseFloat(formData.monthly_premium) : null,
        draft_date: formData.draft_date.trim() || null,
        future_draft_date: formData.future_draft_date.trim() || null,
        beneficiary_routing: formData.beneficiary_routing.trim() || null,
        beneficiary_account: formData.beneficiary_account.trim() || null,
        additional_notes: formData.additional_notes.trim() || null,
        lead_vendor: leadVendor, // Auto-set from logged-in center
        birth_state: formData.birth_state.trim() || null,
        driver_license: formData.driver_license.trim() || null,
        existing_coverage: formData.existing_coverage || 'NO',
        previous_applications: formData.previous_applications || 'NO',
        height: formData.height.trim() || null,
        weight: formData.weight.trim() || null,
        doctors_name: formData.doctors_name.trim() || null,
        tobacco_use: formData.tobacco_use || 'NO',
        medications: formData.medications.trim() || null,
        beneficiary_information: formData.beneficiary_information.trim() || null,
        institution_name: formData.institution_name.trim() || null,
        account_type: formData.account_type || 'Checking',
        is_callback: false,
        buffer_agent: '',
        agent: '',
        user_id: null,
      };

      const { error } = await supabase
        .from('leads')
        .insert([lawyerData]);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Lawyer created successfully! Submission ID: ${submissionId}`,
      });

      onLeadCreated();
      handleClose();
    } catch (error: any) {
      console.error('Error creating lawyer:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create lawyer. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    // Reset form
    setFormData({
      customer_full_name: '',
      phone_number: '',
      street_address: '',
      city: '',
      state: '',
      zip_code: '',
      email: '',
      date_of_birth: '',
      age: '',
      social_security: '',
      health_conditions: '',
      carrier: '',
      product_type: '',
      coverage_amount: '',
      monthly_premium: '',
      draft_date: '',
      future_draft_date: '',
      beneficiary_routing: '',
      beneficiary_account: '',
      additional_notes: '',
      birth_state: '',
      driver_license: '',
      existing_coverage: 'NO',
      previous_applications: 'NO',
      height: '',
      weight: '',
      doctors_name: '',
      tobacco_use: 'NO',
      medications: '',
      beneficiary_information: '',
      institution_name: '',
      account_type: 'Checking',
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] w-[95vw] sm:w-full">
        <DialogHeader>
          <DialogTitle>Create New Lawyer</DialogTitle>
          <DialogDescription>
            Fill in the lawyer information. Fields marked with * are required.
            <br />
            <span className="text-sm text-muted-foreground">Lead Vendor: <span className="font-semibold">{leadVendor}</span></span>
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[60vh] pr-4">
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5">
              <TabsTrigger value="basic">Basic Info</TabsTrigger>
              <TabsTrigger value="personal">Personal</TabsTrigger>
              <TabsTrigger value="insurance">Insurance</TabsTrigger>
              <TabsTrigger value="health">Health</TabsTrigger>
              <TabsTrigger value="banking">Banking</TabsTrigger>
            </TabsList>

            {/* Basic Information Tab */}
            <TabsContent value="basic" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="customer_full_name">Customer Full Name *</Label>
                  <Input
                    id="customer_full_name"
                    value={formData.customer_full_name}
                    onChange={(e) => handleInputChange('customer_full_name', e.target.value)}
                    placeholder="John Doe"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone_number">Phone Number *</Label>
                  <Input
                    id="phone_number"
                    value={formData.phone_number}
                    onChange={(e) => handleInputChange('phone_number', e.target.value)}
                    placeholder="(555) 123-4567"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    placeholder="customer@email.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="date_of_birth">Date of Birth</Label>
                  <Input
                    id="date_of_birth"
                    type="date"
                    value={formData.date_of_birth}
                    onChange={(e) => handleInputChange('date_of_birth', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="age">Age</Label>
                  <Input
                    id="age"
                    type="number"
                    value={formData.age}
                    onChange={(e) => handleInputChange('age', e.target.value)}
                    placeholder="65"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="social_security">Social Security Number</Label>
                  <Input
                    id="social_security"
                    value={formData.social_security}
                    onChange={(e) => handleInputChange('social_security', e.target.value)}
                    placeholder="123-45-6789"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="street_address">Street Address</Label>
                <Input
                  id="street_address"
                  value={formData.street_address}
                  onChange={(e) => handleInputChange('street_address', e.target.value)}
                  placeholder="123 Main Street"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => handleInputChange('city', e.target.value)}
                    placeholder="Los Angeles"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <Select value={formData.state} onValueChange={(value) => handleInputChange('state', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent>
                      {US_STATES.map(state => (
                        <SelectItem key={state} value={state}>{state}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="zip_code">Zip Code</Label>
                  <Input
                    id="zip_code"
                    value={formData.zip_code}
                    onChange={(e) => handleInputChange('zip_code', e.target.value)}
                    placeholder="90001"
                  />
                </div>
              </div>
            </TabsContent>

            {/* Personal Information Tab */}
            <TabsContent value="personal" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="birth_state">Birth State</Label>
                  <Select value={formData.birth_state} onValueChange={(value) => handleInputChange('birth_state', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select birth state" />
                    </SelectTrigger>
                    <SelectContent>
                      {US_STATES.map(state => (
                        <SelectItem key={state} value={state}>{state}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="driver_license">Driver License</Label>
                  <Input
                    id="driver_license"
                    value={formData.driver_license}
                    onChange={(e) => handleInputChange('driver_license', e.target.value)}
                    placeholder="DL123456"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="height">Height</Label>
                  <Input
                    id="height"
                    value={formData.height}
                    onChange={(e) => handleInputChange('height', e.target.value)}
                    placeholder="5.10"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="weight">Weight (lbs)</Label>
                  <Input
                    id="weight"
                    value={formData.weight}
                    onChange={(e) => handleInputChange('weight', e.target.value)}
                    placeholder="180"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="beneficiary_information">Beneficiary Information</Label>
                <Textarea
                  id="beneficiary_information"
                  value={formData.beneficiary_information}
                  onChange={(e) => handleInputChange('beneficiary_information', e.target.value)}
                  placeholder="Spouse: Jane Doe, DOB: 01/15/1965"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="additional_notes">Additional Notes</Label>
                <Textarea
                  id="additional_notes"
                  value={formData.additional_notes}
                  onChange={(e) => handleInputChange('additional_notes', e.target.value)}
                  placeholder="Any additional information..."
                  rows={4}
                />
              </div>
            </TabsContent>

            {/* Insurance Information Tab */}
            <TabsContent value="insurance" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="carrier">Carrier</Label>
                  <Input
                    id="carrier"
                    value={formData.carrier}
                    onChange={(e) => handleInputChange('carrier', e.target.value)}
                    placeholder="AMAM"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="product_type">Product Type</Label>
                  <Input
                    id="product_type"
                    value={formData.product_type}
                    onChange={(e) => handleInputChange('product_type', e.target.value)}
                    placeholder="Level, Graded, Immediate"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="coverage_amount">Coverage Amount ($)</Label>
                  <Input
                    id="coverage_amount"
                    type="number"
                    value={formData.coverage_amount}
                    onChange={(e) => handleInputChange('coverage_amount', e.target.value)}
                    placeholder="10000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="monthly_premium">Monthly Premium ($)</Label>
                  <Input
                    id="monthly_premium"
                    type="number"
                    step="0.01"
                    value={formData.monthly_premium}
                    onChange={(e) => handleInputChange('monthly_premium', e.target.value)}
                    placeholder="45.50"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="draft_date">Draft Date</Label>
                  <Input
                    id="draft_date"
                    value={formData.draft_date}
                    onChange={(e) => handleInputChange('draft_date', e.target.value)}
                    placeholder="15th of each month"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="future_draft_date">Future Draft Date</Label>
                  <Input
                    id="future_draft_date"
                    value={formData.future_draft_date}
                    onChange={(e) => handleInputChange('future_draft_date', e.target.value)}
                    placeholder="15th of each month"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="existing_coverage">Existing Coverage</Label>
                  <Select value={formData.existing_coverage} onValueChange={(value) => handleInputChange('existing_coverage', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NO">No</SelectItem>
                      <SelectItem value="YES">Yes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="previous_applications">Previous Applications</Label>
                  <Select value={formData.previous_applications} onValueChange={(value) => handleInputChange('previous_applications', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NO">No</SelectItem>
                      <SelectItem value="YES">Yes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            {/* Health Information Tab */}
            <TabsContent value="health" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="health_conditions">Health Conditions</Label>
                <Textarea
                  id="health_conditions"
                  value={formData.health_conditions}
                  onChange={(e) => handleInputChange('health_conditions', e.target.value)}
                  placeholder="High Blood Pressure, Diabetes, etc."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="medications">Medications</Label>
                <Textarea
                  id="medications"
                  value={formData.medications}
                  onChange={(e) => handleInputChange('medications', e.target.value)}
                  placeholder="Lisinopril, Metformin, etc."
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="doctors_name">Doctor's Name</Label>
                  <Input
                    id="doctors_name"
                    value={formData.doctors_name}
                    onChange={(e) => handleInputChange('doctors_name', e.target.value)}
                    placeholder="Dr. John Smith"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tobacco_use">Tobacco Use</Label>
                  <Select value={formData.tobacco_use} onValueChange={(value) => handleInputChange('tobacco_use', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NO">No</SelectItem>
                      <SelectItem value="YES">Yes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            {/* Banking Information Tab */}
            <TabsContent value="banking" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="institution_name">Bank Name</Label>
                  <Input
                    id="institution_name"
                    value={formData.institution_name}
                    onChange={(e) => handleInputChange('institution_name', e.target.value)}
                    placeholder="Bank of America"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="account_type">Account Type</Label>
                  <Select value={formData.account_type} onValueChange={(value) => handleInputChange('account_type', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Checking">Checking</SelectItem>
                      <SelectItem value="Savings">Savings</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="beneficiary_routing">Routing Number</Label>
                  <Input
                    id="beneficiary_routing"
                    value={formData.beneficiary_routing}
                    onChange={(e) => handleInputChange('beneficiary_routing', e.target.value)}
                    placeholder="123456789"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="beneficiary_account">Account Number</Label>
                  <Input
                    id="beneficiary_account"
                    value={formData.beneficiary_account}
                    onChange={(e) => handleInputChange('beneficiary_account', e.target.value)}
                    placeholder="987654321"
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Creating...' : 'Create Lawyer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
