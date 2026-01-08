import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import AetnaStateAvailabilityManager from '@/components/AetnaStateAvailabilityManager';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Shield, MapPin, Building2, Save, RefreshCw, CheckCircle2, Users, AlertTriangle, Info } from 'lucide-react';
import { Database } from '@/integrations/supabase/types';

type Carrier = Database['public']['Tables']['carriers']['Row'];
type State = Database['public']['Tables']['states']['Row'];
type AgentCarrierLicense = Database['public']['Tables']['agent_carrier_licenses']['Row'];
type AgentStateLicense = Database['public']['Tables']['agent_state_licenses']['Row'];

interface AgentProfile {
  id: string;
  email: string;
  display_name: string | null;
  agent_code: string | null;
}

interface UplineInfo {
  upline_user_id: string | null;
  upline_name: string | null;
  relationship_type: string | null;
}

interface OverrideStateInfo {
  carrier_id: string;
  carrier_name: string;
  state_id: string;
  state_name: string;
  requires_upline_license: boolean;
}

export function AgentEligibilityPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  // Agent selection
  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [selectedAgent, setSelectedAgent] = useState<AgentProfile | null>(null);

  // Carriers data
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [agentCarrierLicenses, setAgentCarrierLicenses] = useState<AgentCarrierLicense[]>([]);
  const [carrierChanges, setCarrierChanges] = useState<Map<string, boolean>>(new Map());

  // States data
  const [states, setStates] = useState<State[]>([]);
  const [agentStateLicenses, setAgentStateLicenses] = useState<AgentStateLicense[]>([]);
  const [stateChanges, setStateChanges] = useState<Map<string, boolean>>(new Map());

  // Upline data
  const [uplineInfo, setUplineInfo] = useState<UplineInfo | null>(null);
  const [overrideStates, setOverrideStates] = useState<OverrideStateInfo[]>([]);

  // Find Eligible Agents feature
  const [selectedCarrier, setSelectedCarrier] = useState<string>('');
  const [selectedState, setSelectedState] = useState<string>('');
  const [eligibleAgents, setEligibleAgents] = useState<any[]>([]);
  const [searchingAgents, setSearchingAgents] = useState(false);

  // Loading states
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [agentsLoading, setAgentsLoading] = useState(true);

  // Fetch all licensed agents
  useEffect(() => {
    fetchAgents();
  }, []);

  // Fetch agent-specific data when agent is selected
  useEffect(() => {
    if (selectedAgentId) {
      const agent = agents.find(a => a.id === selectedAgentId);
      setSelectedAgent(agent || null);
      fetchAgentEligibility(selectedAgentId);
      fetchUplineInfo(selectedAgentId);
      fetchOverrideStates();
    } else {
      setSelectedAgent(null);
      setAgentCarrierLicenses([]);
      setAgentStateLicenses([]);
      setCarrierChanges(new Map());
      setStateChanges(new Map());
      setUplineInfo(null);
    }
  }, [selectedAgentId, agents]);

  // Fetch carriers and states on component mount
  useEffect(() => {
    fetchCarriersAndStates();
  }, []);

  const fetchAgents = async () => {
    setAgentsLoading(true);
    try {
      // Fetch agents who have license records (either carrier or state licenses)
      const { data: carrierLicenses, error: carrierError } = await supabase
        .from('agent_carrier_licenses')
        .select('agent_user_id');

      if (carrierError) throw carrierError;

      const { data: stateLicenses, error: stateError } = await supabase
        .from('agent_state_licenses')
        .select('agent_user_id');

      if (stateError) throw stateError;

      // Get unique user IDs from both license tables
      const allUserIds = new Set<string>();
      carrierLicenses?.forEach(l => l.agent_user_id && allUserIds.add(l.agent_user_id));
      stateLicenses?.forEach(l => l.agent_user_id && allUserIds.add(l.agent_user_id));

      // Also include the specific user ID you mentioned
      allUserIds.add('d68d18e4-9deb-4282-b4d0-1e6e6a0789e9');

      const userIds = Array.from(allUserIds);

      console.log('User IDs with licenses:', userIds);

      if (userIds.length === 0) {
        console.warn('No licensed agents found');
        setAgents([]);
        setAgentsLoading(false);
        return;
      }

      // Fetch profiles for these agents
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, user_id, display_name, agent_code')
        .in('user_id', userIds)
        .order('display_name');

      if (profilesError) throw profilesError;

      console.log('Profiles fetched:', profiles);

      // Create agent profiles
      const agentProfiles: AgentProfile[] = (profiles || []).map(profile => ({
        id: profile.user_id!,
        email: profile.user_id!, // Using user_id as fallback since email is not available in profiles
        display_name: profile.display_name,
        agent_code: profile.agent_code
      }));

      console.log('Agent profiles created:', agentProfiles);

      setAgents(agentProfiles);
    } catch (error: any) {
      console.error('Error fetching agents:', error);
      toast({
        title: "Error",
        description: `Failed to fetch agents: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setAgentsLoading(false);
    }
  };

  const fetchCarriersAndStates = async () => {
    try {
      // Fetch carriers
      const { data: carriersData, error: carriersError } = await supabase
        .from('carriers')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true })
        .order('carrier_name', { ascending: true });

      if (carriersError) throw carriersError;
      setCarriers(carriersData || []);

      // Fetch states
      const { data: statesData, error: statesError } = await supabase
        .from('states')
        .select('*')
        .eq('is_active', true)
        .order('state_name', { ascending: true });

      if (statesError) throw statesError;
      setStates(statesData || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: `Failed to fetch carriers and states: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  const fetchUplineInfo = async (agentUserId: string) => {
    try {
      // Try direct query with type assertion
      const { data, error } = await supabase
        .from('agent_upline_hierarchy' as any)
        .select('upline_user_id, relationship_type')
        .eq('agent_user_id', agentUserId)
        .eq('is_active', true)
        .maybeSingle();

      if (error) {
        console.error('Error fetching upline hierarchy:', error);
        setUplineInfo(null);
        return;
      }

      if (data && (data as any).upline_user_id) {
        // Fetch upline name separately
        const { data: profileData } = await supabase
          .from('profiles')
          .select('display_name')
          .eq('user_id', (data as any).upline_user_id)
          .maybeSingle();

        setUplineInfo({
          upline_user_id: (data as any).upline_user_id,
          upline_name: profileData?.display_name || null,
          relationship_type: (data as any).relationship_type,
        });
      } else {
        setUplineInfo(null);
      }
    } catch (error: any) {
      console.error('Error fetching upline info:', error);
      setUplineInfo(null);
    }
  };

  const fetchOverrideStates = async () => {
    try {
      // Use raw query since table might not be in generated types yet
      const { data: overrideData, error: overrideError } = await supabase
        .from('carrier_override_states' as any)
        .select(`
          carrier_id,
          state_id,
          requires_upline_license
        `)
        .eq('requires_upline_license', true);

      if (overrideError) {
        console.error('Override states error:', overrideError);
        setOverrideStates([]);
        return;
      }

      // Fetch carrier and state names separately
      const carrierIds = [...new Set(overrideData?.map((item: any) => item.carrier_id) || [])];
      const stateIds = [...new Set(overrideData?.map((item: any) => item.state_id) || [])];

      const { data: carriersData } = await supabase
        .from('carriers')
        .select('id, carrier_name')
        .in('id', carrierIds);

      const { data: statesData } = await supabase
        .from('states')
        .select('id, state_name')
        .in('id', stateIds);

      const carrierMap = new Map(carriersData?.map(c => [c.id, c.carrier_name]));
      const stateMap = new Map(statesData?.map(s => [s.id, s.state_name]));

      const formattedOverrides: OverrideStateInfo[] = (overrideData || []).map((item: any) => ({
        carrier_id: item.carrier_id,
        carrier_name: carrierMap.get(item.carrier_id) || '',
        state_id: item.state_id,
        state_name: stateMap.get(item.state_id) || '',
        requires_upline_license: item.requires_upline_license,
      }));

      setOverrideStates(formattedOverrides);
    } catch (error: any) {
      console.error('Error fetching override states:', error);
      setOverrideStates([]);
    }
  };

  const fetchAgentEligibility = async (agentUserId: string) => {
    setLoading(true);
    try {
      // Fetch carrier licenses
      const { data: carrierLicenses, error: carrierError } = await supabase
        .from('agent_carrier_licenses')
        .select('*')
        .eq('agent_user_id', agentUserId);

      if (carrierError) throw carrierError;
      setAgentCarrierLicenses(carrierLicenses || []);

      // Fetch state licenses
      const { data: stateLicenses, error: stateError } = await supabase
        .from('agent_state_licenses')
        .select('*')
        .eq('agent_user_id', agentUserId);

      if (stateError) throw stateError;
      setAgentStateLicenses(stateLicenses || []);

      // Reset changes
      setCarrierChanges(new Map());
      setStateChanges(new Map());
    } catch (error: any) {
      toast({
        title: "Error",
        description: `Failed to fetch agent eligibility: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const isCarrierLicensed = (carrierId: string): boolean => {
    // Check if there's a pending change
    if (carrierChanges.has(carrierId)) {
      return carrierChanges.get(carrierId)!;
    }
    // Check existing license
    const license = agentCarrierLicenses.find(l => l.carrier_id === carrierId);
    return license?.is_licensed ?? false;
  };

  const isStateLicensed = (stateId: string): boolean => {
    // Check if there's a pending change
    if (stateChanges.has(stateId)) {
      return stateChanges.get(stateId)!;
    }
    // Check existing license
    const license = agentStateLicenses.find(l => l.state_id === stateId);
    return license?.is_licensed ?? false;
  };

  const handleCarrierToggle = (carrierId: string, checked: boolean) => {
    const newChanges = new Map(carrierChanges);
    newChanges.set(carrierId, checked);
    setCarrierChanges(newChanges);
  };

  const handleStateToggle = (stateId: string, checked: boolean) => {
    const newChanges = new Map(stateChanges);
    newChanges.set(stateId, checked);
    setStateChanges(newChanges);
  };

  const saveCarrierChanges = async () => {
    if (!selectedAgentId || carrierChanges.size === 0) return;

    setSaving(true);
    try {
      const updates = Array.from(carrierChanges.entries()).map(async ([carrierId, isLicensed]) => {
        const existingLicense = agentCarrierLicenses.find(l => l.carrier_id === carrierId);

        if (existingLicense) {
          // Update existing record
          return supabase
            .from('agent_carrier_licenses')
            .update({ is_licensed: isLicensed, updated_at: new Date().toISOString() })
            .eq('id', existingLicense.id);
        } else {
          // Insert new record
          return supabase
            .from('agent_carrier_licenses')
            .insert({
              agent_user_id: selectedAgentId,
              carrier_id: carrierId,
              is_licensed: isLicensed
            });
        }
      });

      const results = await Promise.all(updates);
      const errors = results.filter(r => r.error);

      if (errors.length > 0) {
        throw new Error(`Failed to save ${errors.length} carrier license(s)`);
      }

      toast({
        title: "Success",
        description: `Updated ${carrierChanges.size} carrier license(s)`,
      });

      // Refresh data
      await fetchAgentEligibility(selectedAgentId);
    } catch (error: any) {
      toast({
        title: "Error",
        description: `Failed to save carrier licenses: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const saveStateChanges = async () => {
    if (!selectedAgentId || stateChanges.size === 0) return;

    setSaving(true);
    try {
      const updates = Array.from(stateChanges.entries()).map(async ([stateId, isLicensed]) => {
        const existingLicense = agentStateLicenses.find(l => l.state_id === stateId);

        if (existingLicense) {
          // Update existing record
          return supabase
            .from('agent_state_licenses')
            .update({ is_licensed: isLicensed, updated_at: new Date().toISOString() })
            .eq('id', existingLicense.id);
        } else {
          // Insert new record
          return supabase
            .from('agent_state_licenses')
            .insert({
              agent_user_id: selectedAgentId,
              state_id: stateId,
              is_licensed: isLicensed
            });
        }
      });

      const results = await Promise.all(updates);
      const errors = results.filter(r => r.error);

      if (errors.length > 0) {
        throw new Error(`Failed to save ${errors.length} state license(s)`);
      }

      toast({
        title: "Success",
        description: `Updated ${stateChanges.size} state license(s)`,
      });

      // Refresh data
      await fetchAgentEligibility(selectedAgentId);
    } catch (error: any) {
      toast({
        title: "Error",
        description: `Failed to save state licenses: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const getCarrierStats = () => {
    const licensed = agentCarrierLicenses.filter(l => l.is_licensed).length;
    return { licensed, total: carriers.length };
  };

  const getStateStats = () => {
    const licensed = agentStateLicenses.filter(l => l.is_licensed).length;
    return { licensed, total: states.length };
  };

  const hasCarrierOverrideStates = (carrierId: string): boolean => {
    return overrideStates.some(os => os.carrier_id === carrierId);
  };

  const getCarrierOverrideStates = (carrierId: string): string[] => {
    return overrideStates
      .filter(os => os.carrier_id === carrierId)
      .map(os => os.state_name);
  };

  const isStateRequiredForCarrier = (stateId: string, carrierId: string): boolean => {
    return overrideStates.some(os => os.carrier_id === carrierId && os.state_id === stateId);
  };

  const getUplineStatusForCarrierState = (carrierId: string, stateId: string): {
    required: boolean;
    uplineLicensed: boolean;
  } => {
    const isRequired = isStateRequiredForCarrier(stateId, carrierId);
    
    if (!isRequired || !uplineInfo?.upline_user_id) {
      return { required: false, uplineLicensed: true };
    }

    // Check if upline has the necessary licenses
    const uplineCarrierLicense = agentCarrierLicenses.find(
      l => l.agent_user_id === uplineInfo.upline_user_id && l.carrier_id === carrierId
    );
    const uplineStateLicense = agentStateLicenses.find(
      l => l.agent_user_id === uplineInfo.upline_user_id && l.state_id === stateId
    );

    const uplineLicensed = 
      (uplineCarrierLicense?.is_licensed ?? false) && 
      (uplineStateLicense?.is_licensed ?? false);

    return { required: true, uplineLicensed };
  };

  const findEligibleAgents = async () => {
    if (!selectedCarrier || !selectedState) {
      toast({
        title: "Missing Selection",
        description: "Please select both a carrier and a state",
        variant: "destructive",
      });
      return;
    }

    setSearchingAgents(true);
    setEligibleAgents([]);

    try {
      const carrierObj = carriers.find(c => c.id === selectedCarrier);
      const stateObj = states.find(s => s.id === selectedState);

      if (!carrierObj || !stateObj) {
        throw new Error('Invalid carrier or state selection');
      }

      // Check if the carrier is Aetna - use special function for Aetna
      const isAetna = carrierObj.carrier_name.toLowerCase() === 'aetna';
      
      let data, error;
      
      if (isAetna) {
        // Use Aetna-specific function
        const result = await supabase.rpc('get_eligible_agents_for_aetna' as any, {
          p_state_name: stateObj.state_name
        });
        data = result.data;
        error = result.error;
      } else {
        // Call the regular function with upline checking
        const result = await supabase.rpc('get_eligible_agents_with_upline_check' as any, {
          p_carrier_name: carrierObj.carrier_name,
          p_state_name: stateObj.state_name
        });
        data = result.data;
        error = result.error;
      }

      if (error) throw error;

      console.log('Eligible agents found:', data);
      const agentsList = Array.isArray(data) ? data : [];
      setEligibleAgents(agentsList);

      if (agentsList.length === 0) {
        toast({
          title: "No Eligible Agents",
          description: isAetna 
            ? `No agents are available for Aetna in ${stateObj.state_name} (requires upline approval and custom state availability)`
            : `No agents found who are licensed for ${carrierObj.carrier_name} in ${stateObj.state_name}`,
        });
      } else {
        toast({
          title: "Search Complete",
          description: `Found ${agentsList.length} eligible agent(s)${isAetna ? ' (Aetna requires upline licensing)' : ''}`,
        });
      }
    } catch (error: any) {
      console.error('Error finding eligible agents:', error);
      toast({
        title: "Error",
        description: `Failed to find eligible agents: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setSearchingAgents(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Shield className="h-8 w-8 text-primary" />
              Agent Eligibility Management
            </h1>
            <p className="text-muted-foreground mt-2">
              Manage carrier and state licensing eligibility for licensed agents
            </p>
          </div>

          {/* Find Eligible Agents */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Find Eligible Agents
              </CardTitle>
              <CardDescription>
                Search for agents licensed to sell a specific carrier in a specific state
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Carrier Selection */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Carrier Name</label>
                    <Select
                      value={selectedCarrier}
                      onValueChange={setSelectedCarrier}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a carrier..." />
                      </SelectTrigger>
                      <SelectContent>
                        {carriers.map(carrier => (
                          <SelectItem key={carrier.id} value={carrier.id}>
                            {carrier.carrier_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* State Selection */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">State Name</label>
                    <Select
                      value={selectedState}
                      onValueChange={setSelectedState}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a state..." />
                      </SelectTrigger>
                      <SelectContent>
                        {states.map(state => (
                          <SelectItem key={state.id} value={state.id}>
                            {state.state_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Aetna Special Notice */}
                {selectedCarrier && carriers.find(c => c.id === selectedCarrier)?.carrier_name.toLowerCase() === 'aetna' && (
                  <Alert className="bg-blue-50 border-blue-200">
                    <Info className="h-4 w-4 text-blue-600" />
                    <AlertTitle className="text-blue-800">Aetna Special Requirements</AlertTitle>
                    <AlertDescription className="text-blue-700">
                      Aetna uses a separate state availability system with custom per-agent approvals. All 52 US states/territories require upline license verification. Results will show agents based on their individual Aetna state availability settings.
                    </AlertDescription>
                  </Alert>
                )}

                {/* Search Button */}
                <Button
                  onClick={findEligibleAgents}
                  disabled={!selectedCarrier || !selectedState || searchingAgents}
                  className="w-full md:w-auto"
                >
                  <Shield className="h-4 w-4 mr-2" />
                  {searchingAgents ? 'Searching...' : 'Search for Eligible Agents'}
                </Button>

                {/* Search Results */}
                {eligibleAgents.length > 0 && (
                  <div className="mt-6 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold">Search Results</h3>
                      <Badge variant="secondary">
                        {eligibleAgents.length} agent{eligibleAgents.length !== 1 ? 's' : ''} found
                      </Badge>
                    </div>
                    
                    <div className="space-y-2">
                      {eligibleAgents.map((agent: any, index: number) => (
                        <div
                          key={agent.user_id || index}
                          className="flex items-center justify-between p-4 border rounded-lg bg-background hover:bg-accent transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                              <Users className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <p className="font-semibold">{agent.agent_name || 'Unknown'}</p>
                              <p className="text-sm text-muted-foreground">
                                Code: {agent.agent_code || 'N/A'}
                                {agent.email && ` • ${agent.email}`}
                              </p>
                              {agent.upline_name && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Upline: <strong>{agent.upline_name}</strong>
                                </p>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            {agent.carrier_licensed && (
                              <Badge variant="default" className="bg-green-600">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Carrier
                              </Badge>
                            )}
                            {agent.state_licensed && (
                              <Badge variant="default" className="bg-green-600">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                State
                              </Badge>
                            )}
                            {agent.upline_required && agent.upline_licensed && (
                              <Badge variant="default" className="bg-blue-600">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Upline
                              </Badge>
                            )}
                            {agent.upline_required && !agent.upline_licensed && (
                              <Badge variant="destructive">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                Upline Missing
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* No Results Message */}
                {!searchingAgents && eligibleAgents.length === 0 && selectedCarrier && selectedState && (
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertTitle>No Results</AlertTitle>
                    <AlertDescription>
                      Click "Search for Eligible Agents" to find agents licensed for the selected carrier and state.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Agent Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Select Licensed Agent
              </CardTitle>
              <CardDescription>
                Choose an agent to manage their carrier and state eligibility
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Select
                  value={selectedAgentId}
                  onValueChange={setSelectedAgentId}
                  disabled={agentsLoading}
                >
                  <SelectTrigger className="w-full md:w-96">
                    <SelectValue placeholder={agentsLoading ? "Loading agents..." : "Select an agent..."} />
                  </SelectTrigger>
                  <SelectContent>
                    {agents.map(agent => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.display_name || 'Unknown'} {agent.agent_code ? `(${agent.agent_code})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {selectedAgent && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
                      <div className="flex-1">
                        <p className="font-semibold">{selectedAgent.display_name || 'Unknown Agent'}</p>
                        <p className="text-sm text-muted-foreground">Agent Code: {selectedAgent.agent_code || 'N/A'}</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fetchAgentEligibility(selectedAgentId)}
                        disabled={loading}
                      >
                        <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                      </Button>
                    </div>

                    {/* Upline Information Alert */}
                    {uplineInfo && uplineInfo.upline_user_id && (
                      <Alert>
                        <Users className="h-4 w-4" />
                        <AlertTitle>Upline Agent</AlertTitle>
                        <AlertDescription>
                          This agent reports to <strong>{uplineInfo.upline_name || 'Unknown'}</strong>
                          {uplineInfo.relationship_type && ` (${uplineInfo.relationship_type})`}.
                          Some carriers require the upline to be licensed in certain states.
                        </AlertDescription>
                      </Alert>
                    )}

                    {/* No Upline Warning */}
                    {(!uplineInfo || !uplineInfo.upline_user_id) && overrideStates.length > 0 && (
                      <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>No Upline Assigned</AlertTitle>
                        <AlertDescription>
                          This agent has no upline assigned. Some carrier/state combinations require an upline to be licensed.
                          The agent may be blocked from receiving leads for those combinations.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Eligibility Management */}
          {selectedAgentId && !loading && (
            <Tabs defaultValue="carriers" className="space-y-4">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="carriers" className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Carriers ({getCarrierStats().licensed}/{getCarrierStats().total})
                </TabsTrigger>
                <TabsTrigger value="states" className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  States ({getStateStats().licensed}/{getStateStats().total})
                </TabsTrigger>
                <TabsTrigger value="aetna" className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-blue-600" />
                  Aetna States
                </TabsTrigger>
                <TabsTrigger value="overrides" className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Upline Requirements ({overrideStates.length})
                </TabsTrigger>
              </TabsList>

              {/* Carriers Tab */}
              <TabsContent value="carriers" className="space-y-4">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Building2 className="h-5 w-5" />
                          Carrier Eligibility
                        </CardTitle>
                        <CardDescription>
                          Select which carriers this agent is licensed to sell
                        </CardDescription>
                      </div>
                      <Button
                        onClick={saveCarrierChanges}
                        disabled={carrierChanges.size === 0 || saving}
                      >
                        <Save className="h-4 w-4 mr-2" />
                        Save Changes {carrierChanges.size > 0 && `(${carrierChanges.size})`}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {carriers.map(carrier => {
                        const isLicensed = isCarrierLicensed(carrier.id);
                        const hasChange = carrierChanges.has(carrier.id);
                        const hasOverrides = hasCarrierOverrideStates(carrier.id);
                        const overrideStatesList = hasOverrides ? getCarrierOverrideStates(carrier.id) : [];
                        
                        return (
                          <div
                            key={carrier.id}
                            className={`flex flex-col space-y-2 p-3 rounded-lg border ${
                              hasChange ? 'bg-blue-50 border-blue-200' : 'bg-background'
                            } hover:bg-accent transition-colors`}
                          >
                            <div className="flex items-center space-x-3">
                              <Checkbox
                                id={`carrier-${carrier.id}`}
                                checked={isLicensed}
                                onCheckedChange={(checked) => 
                                  handleCarrierToggle(carrier.id, checked as boolean)
                                }
                              />
                              <label
                                htmlFor={`carrier-${carrier.id}`}
                                className="flex-1 text-sm font-medium leading-none cursor-pointer peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                              >
                                {carrier.carrier_name}
                                {hasChange && (
                                  <Badge variant="secondary" className="ml-2 text-xs">
                                    Modified
                                  </Badge>
                                )}
                              </label>
                              {isLicensed && !hasChange && (
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                              )}
                            </div>
                            {hasOverrides && (
                              <div className="ml-7 text-xs text-muted-foreground">
                                <div className="flex items-start gap-1">
                                  <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                                  <span>
                                    Requires upline license in: {overrideStatesList.slice(0, 3).join(', ')}
                                    {overrideStatesList.length > 3 && ` +${overrideStatesList.length - 3} more`}
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* States Tab */}
              <TabsContent value="states" className="space-y-4">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <MapPin className="h-5 w-5" />
                          State Eligibility
                        </CardTitle>
                        <CardDescription>
                          Select which states this agent is licensed to operate in
                        </CardDescription>
                      </div>
                      <Button
                        onClick={saveStateChanges}
                        disabled={stateChanges.size === 0 || saving}
                      >
                        <Save className="h-4 w-4 mr-2" />
                        Save Changes {stateChanges.size > 0 && `(${stateChanges.size})`}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {states.map(state => {
                        const isLicensed = isStateLicensed(state.id);
                        const hasChange = stateChanges.has(state.id);
                        const carrierOverrides = overrideStates.filter(os => os.state_id === state.id);
                        const hasOverrides = carrierOverrides.length > 0;
                        
                        return (
                          <div
                            key={state.id}
                            className={`flex flex-col space-y-2 p-3 rounded-lg border ${
                              hasChange ? 'bg-blue-50 border-blue-200' : 'bg-background'
                            } hover:bg-accent transition-colors`}
                          >
                            <div className="flex items-center space-x-3">
                              <Checkbox
                                id={`state-${state.id}`}
                                checked={isLicensed}
                                onCheckedChange={(checked) => 
                                  handleStateToggle(state.id, checked as boolean)
                                }
                              />
                              <label
                                htmlFor={`state-${state.id}`}
                                className="flex-1 text-sm font-medium leading-none cursor-pointer peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                              >
                                {state.state_name}
                                <span className="text-xs text-muted-foreground ml-1">
                                  ({state.state_code})
                                </span>
                                {hasChange && (
                                  <Badge variant="secondary" className="ml-2 text-xs">
                                    Modified
                                  </Badge>
                                )}
                              </label>
                              {isLicensed && !hasChange && (
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                              )}
                            </div>
                            {hasOverrides && (
                              <div className="ml-7 text-xs text-amber-600 dark:text-amber-400">
                                <div className="flex items-start gap-1">
                                  <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                                  <span>
                                    {carrierOverrides.length} carrier{carrierOverrides.length > 1 ? 's' : ''} require upline
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Override States Tab */}
              <TabsContent value="overrides" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5" />
                      Upline License Requirements
                    </CardTitle>
                    <CardDescription>
                      These carrier/state combinations require the upline agent to also be licensed
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {overrideStates.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Info className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p>No upline license requirements configured</p>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {/* Group by carrier */}
                        {Array.from(new Set(overrideStates.map(os => os.carrier_name))).map(carrierName => {
                          const carrierStates = overrideStates.filter(os => os.carrier_name === carrierName);
                          const carrier = carriers.find(c => c.carrier_name === carrierName);
                          const isAgentCarrierLicensed = carrier ? isCarrierLicensed(carrier.id) : false;

                          return (
                            <div key={carrierName} className="border rounded-lg p-4">
                              <div className="flex items-center justify-between mb-3">
                                <h3 className="font-semibold flex items-center gap-2">
                                  <Building2 className="h-4 w-4" />
                                  {carrierName}
                                  {isAgentCarrierLicensed ? (
                                    <Badge variant="default" className="bg-green-600">Licensed</Badge>
                                  ) : (
                                    <Badge variant="secondary">Not Licensed</Badge>
                                  )}
                                </h3>
                                <span className="text-sm text-muted-foreground">
                                  {carrierStates.length} state{carrierStates.length > 1 ? 's' : ''}
                                </span>
                              </div>
                              
                              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                                {carrierStates.map(os => {
                                  const isAgentStateLicensed = isStateLicensed(os.state_id);
                                  const uplineStatus = uplineInfo?.upline_user_id 
                                    ? getUplineStatusForCarrierState(os.carrier_id, os.state_id)
                                    : { required: true, uplineLicensed: false };

                                  let badgeVariant: "default" | "secondary" | "destructive" = "secondary";
                                  let badgeText = "Not Licensed";
                                  
                                  if (isAgentStateLicensed && uplineStatus.uplineLicensed) {
                                    badgeVariant = "default";
                                    badgeText = "✓ Ready";
                                  } else if (isAgentStateLicensed && !uplineStatus.uplineLicensed) {
                                    badgeVariant = "destructive";
                                    badgeText = "⚠ Upline Missing";
                                  }

                                  return (
                                    <div
                                      key={os.state_id}
                                      className={`text-sm p-2 rounded border ${
                                        isAgentStateLicensed && uplineStatus.uplineLicensed
                                          ? 'bg-green-50 border-green-200'
                                          : isAgentStateLicensed
                                          ? 'bg-amber-50 border-amber-200'
                                          : 'bg-gray-50 border-gray-200'
                                      }`}
                                    >
                                      <div className="font-medium">{os.state_name}</div>
                                      <Badge variant={badgeVariant} className="text-xs mt-1">
                                        {badgeText}
                                      </Badge>
                                    </div>
                                  );
                                })}
                              </div>

                              {!uplineInfo?.upline_user_id && (
                                <Alert variant="destructive" className="mt-3">
                                  <AlertTriangle className="h-4 w-4" />
                                  <AlertDescription className="text-xs">
                                    Agent has no upline assigned. They will be blocked from receiving leads for these states.
                                  </AlertDescription>
                                </Alert>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Aetna States Tab */}
              <TabsContent value="aetna" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MapPin className="h-5 w-5 text-blue-600" />
                      Aetna State Availability Management
                    </CardTitle>
                    <CardDescription>
                      Manage agent-specific Aetna state availability. This is separate from general state licensing.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <AetnaStateAvailabilityManager />
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}

          {/* Loading State */}
          {selectedAgentId && loading && (
            <Card>
              <CardContent className="p-12 text-center">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
                <p className="text-muted-foreground">Loading agent eligibility...</p>
              </CardContent>
            </Card>
          )}

          {/* Empty State */}
          {!selectedAgentId && !agentsLoading && (
            <Card>
              <CardContent className="p-12 text-center">
                <Shield className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No Agent Selected</h3>
                <p className="text-muted-foreground">
                  Select a licensed agent above to manage their carrier and state eligibility
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
