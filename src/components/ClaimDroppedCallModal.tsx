import React from "react";
import { Button } from "@/components/ui/button";

interface Agent {
  user_id: string;
  display_name: string;
}

interface ClaimDroppedCallModalProps {
  open: boolean;
  loading: boolean;
  licensedAgents: Agent[];
  fetchingAgents: boolean;
  claimLicensedAgent: string;
  onLicensedAgentChange: (id: string) => void;
  onCancel: () => void;
  onClaim: () => void;
}

export const ClaimDroppedCallModal: React.FC<ClaimDroppedCallModalProps> = ({
  open,
  loading,
  licensedAgents,
  fetchingAgents,
  claimLicensedAgent,
  onLicensedAgentChange,
  onCancel,
  onClaim,
}) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">Claim Call</h2>
        <div className="mb-4">
          <label className="block font-medium mb-2">Select Workflow Type</label>
          <select
            value="licensed"
            disabled
            className="border rounded px-2 py-1 w-full bg-muted text-muted-foreground"
          >
            <option value="licensed">Closer</option>
          </select>
        </div>
        <div className="mb-4">
          <label className="block font-medium mb-2">Select Closer</label>
          {fetchingAgents ? (
            <div className="flex items-center gap-2 py-2">
              <span className="text-sm text-muted-foreground">Loading closers...</span>
            </div>
          ) : (
            <select
              value={claimLicensedAgent}
              onChange={e => onLicensedAgentChange(e.target.value)}
              className="border rounded px-2 py-1 w-full"
            >
              <option value="">Select Closer</option>
              {licensedAgents.map(agent => (
                <option key={agent.user_id} value={agent.user_id}>{agent.display_name}</option>
              ))}
            </select>
          )}
          {licensedAgents.length === 0 && !fetchingAgents && (
            <p className="text-sm text-muted-foreground">No licensed agents available. Please ensure licensed agents are registered in the system.</p>
          )}
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onCancel} disabled={loading}>Cancel</Button>
          <Button onClick={onClaim} disabled={loading || !claimLicensedAgent}>
            {loading ? 'Claiming...' : 'Claim & Reconnect'}
          </Button>
        </div>
      </div>
    </div>
  );
};
