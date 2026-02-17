import EligibleAgentFinder from '@/components/EligibleAgentFinder';
import { Search } from 'lucide-react';

export default function AgentLicensing() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Search className="h-8 w-8" />
            Find Eligible Onboarding Agents
          </h1>
          <p className="text-muted-foreground mt-2">
            Search for agents eligible to receive leads by carrier and state with upline verification
          </p>
        </div>

        <EligibleAgentFinder />
      </div>
    </div>
  );
}
