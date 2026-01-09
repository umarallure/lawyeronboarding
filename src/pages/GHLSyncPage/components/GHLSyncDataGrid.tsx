import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, ChevronLeft, ChevronRight, ExternalLink, RefreshCw, CheckSquare, Square, Play, X, Copy } from 'lucide-react';
import { GHLSyncRow } from '../GHLSyncPage';

interface GHLSyncDataGridProps {
  data: GHLSyncRow[];
  onDataUpdate: () => void;
  hasWritePermissions: boolean;
  currentPage: number;
  totalRecords: number;
  recordsPerPage: number;
  onPageChange: (page: number) => void;
}

export const GHLSyncDataGrid = ({
  data,
  onDataUpdate,
  hasWritePermissions,
  currentPage,
  totalRecords,
  recordsPerPage,
  onPageChange,
}: GHLSyncDataGridProps) => {
  const [syncingRows, setSyncingRows] = useState<Set<string>>(new Set());
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [bulkSyncing, setBulkSyncing] = useState(false);
  const [bulkSyncProgress, setBulkSyncProgress] = useState<{ current: number; total: number; currentRow?: GHLSyncRow }>({ current: 0, total: 0 });
  const { toast } = useToast();

  const totalPages = Math.ceil(totalRecords / recordsPerPage);

  const handleSyncToGHL = async (row: GHLSyncRow) => {
    if (!hasWritePermissions) {
      toast({
        title: 'Permission Denied',
        description: 'You do not have permission to sync data to GHL',
        variant: 'destructive',
      });
      return;
    }

    // Check if already synced
    if (row.sync_status?.toLowerCase() === 'synced') {
      toast({
        title: 'Already Synced',
        description: 'This record has already been synced to GHL',
        variant: 'default',
      });
      return;
    }

    console.log('🚀 Starting GHL sync for:', {
      submissionId: row.submission_id,
      insuredName: row.insured_name,
      leadVendor: row.lead_vendor,
      status: row.status
    });

    // Special debug for the specific failing case
    if (row.submission_id === '6383498429784501726') {
      console.log('🐛 DEBUG: Processing Annissa M Hughes case');
      console.log('🐛 DEBUG: Full row data:', JSON.stringify(row, null, 2));
    }

    setSyncingRows(prev => new Set(prev).add(row.id));

    try {
      // Check if we have the required data
      if (!row.lead_vendor || !row.insured_name) {
        const missingFields = [];
        if (!row.lead_vendor) missingFields.push('lead vendor');
        if (!row.insured_name) missingFields.push('insured name');

        console.error('❌ Missing required data for sync:', {
          submissionId: row.submission_id,
          insuredName: row.insured_name,
          leadVendor: row.lead_vendor,
          missingFields
        });

        toast({
          title: 'Missing Required Data',
          description: `Missing ${missingFields.join(' and ')} for ${row.insured_name || row.submission_id || 'Unknown'}`,
          variant: 'destructive',
        });
        return;
      }

      console.log('✅ Basic validation passed');

      // Step 1: Get location_id from ghl_location_secrets using lead_vendor
      console.log('🔍 Finding GHL location for lead vendor:', row.lead_vendor);
      const { data: locationSecret, error: secretError } = await (supabase as any)
        .from('ghl_location_secrets')
        .select('locationid, api_token')
        .eq('lead_vendor', row.lead_vendor)
        .single();

      console.log('🔍 Location secret query result:', {
        data: locationSecret,
        error: secretError,
        leadVendor: row.lead_vendor
      });

      if (secretError || !locationSecret?.locationid || !locationSecret?.api_token) {
        console.error('❌ No GHL location/token found:', {
          error: secretError,
          locationSecret,
          leadVendor: row.lead_vendor
        });

        // Show more specific error message
        let errorMessage = `No GHL location/token found for lead vendor: ${row.lead_vendor}`;
        if (secretError?.message) {
          errorMessage += ` (${secretError.message})`;
        }

        toast({
          title: 'Configuration Error',
          description: errorMessage,
          variant: 'destructive',
        });
        return;
      }

      const locationId = locationSecret.locationid;
      const apiToken = locationSecret.api_token;
      console.log('✅ Found GHL location:', { locationId, hasToken: !!apiToken });

      // Step 2: Search for opportunity using insured name
      console.log('🔍 Searching for opportunity with name:', row.insured_name);
      console.log('🔍 Search URL:', `https://services.leadconnectorhq.com/opportunities/search?q=${encodeURIComponent(row.insured_name)}&location_id=${locationId}`);

      const searchResponse = await fetch(`https://services.leadconnectorhq.com/opportunities/search?q=${encodeURIComponent(row.insured_name)}&location_id=${locationId}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Version': '2021-07-28',
          'Authorization': `Bearer ${apiToken}`,
        },
      });

      console.log('🔍 Search response status:', searchResponse.status, searchResponse.statusText);

      if (!searchResponse.ok) {
        const errorData = await searchResponse.json().catch(() => ({}));
        console.error('❌ Opportunity search failed:', {
          status: searchResponse.status,
          statusText: searchResponse.statusText,
          error: errorData,
          url: `https://services.leadconnectorhq.com/opportunities/search?q=${encodeURIComponent(row.insured_name)}&location_id=${locationId}`
        });
        throw new Error(`Opportunity search failed: ${searchResponse.status} - ${errorData.message || 'Unknown error'}`);
      }

      const searchResult = await searchResponse.json();
      console.log('✅ Opportunity search result:', {
        totalOpportunities: searchResult.opportunities?.length || 0,
        opportunities: searchResult.opportunities?.map((opp: any) => ({
          id: opp.id,
          name: opp.name,
          pipelineId: opp.pipelineId,
          contactId: opp.contact?.id
        })) || []
      });

      if (!searchResult.opportunities || searchResult.opportunities.length === 0) {
        console.error('❌ No opportunities found for:', {
          insuredName: row.insured_name,
          locationId,
          searchResult
        });
        throw new Error(`No opportunities found for insured name: ${row.insured_name}`);
      }

      // Use the first opportunity found
      const opportunity = searchResult.opportunities[0];
      const opportunityId = opportunity.id;
      const pipelineId = opportunity.pipelineId;
      const contactId = opportunity.contact?.id;

      console.log('📋 Found opportunity details:', {
        opportunityId,
        pipelineId,
        contactId,
        opportunityName: opportunity.name
      });

      if (!opportunityId || !contactId) {
        throw new Error('Opportunity found but missing required IDs');
      }

      // Step 3: Get stage mappings for this location
      const { data: stageMappings, error: mappingError } = await (supabase as any)
        .from('ghl_stage_mappings')
        .select('*')
        .eq('locationid', locationId)
        .single();

      if (mappingError || !stageMappings) {
        console.error('Error fetching stage mappings:', mappingError);
        toast({
          title: 'Configuration Error',
          description: `No stage mappings found for location ${locationId}`,
          variant: 'destructive',
        });
        return;
      }

      const mappings = stageMappings as any;

      // Map status to pipeline stage ID
      const statusToStageMap: Record<string, string> = {
        'Pending Approval': mappings.pending_approval,
        'Needs BPO Callback': mappings.needs_bpo_callback,
        'Previously Sold BPO': mappings.previously_sold_bpo,
        'Returned To Center - DQ': mappings.returned_to_center_dq,
        'Application Withdrawn': mappings.application_withdrawn,
        'Call Back Fix': mappings.chargeback_fix_api,
        'Incomplete Transfer': mappings.incomplete_transfer,
        "DQ'd Can't be sold": mappings.dqd_cant_be_sold
      };

      console.log('🔍 Status Mapping Resolution:');
      console.log('  Current Status:', row.status || 'NO STATUS');
      console.log('  Available Mappings:', statusToStageMap);

      const pipelineStageId = statusToStageMap[row.status || ''] || mappings.pending_approval;

      console.log('  Resolved Stage ID:', pipelineStageId);
      console.log('  Used Fallback:', !statusToStageMap[row.status || ''] ? 'YES (pending_approval)' : 'NO');

      if (!pipelineStageId) {
        console.error('❌ No pipeline stage ID found for status:', row.status);
        toast({
          title: 'Configuration Error',
          description: `No pipeline stage ID found for status: ${row.status || 'Unknown'}`,
          variant: 'destructive',
        });
        return;
      }

      // Prepare the update payload
      const updatePayload = {
        pipelineId: pipelineId, // Include pipeline ID from search result
        pipelineStageId: pipelineStageId,
        status: 'open', // Default to open, can be mapped based on status
        monetaryValue: 0,
        assignedTo: null, // Can be set if you have agent mapping
        customFields: [] as any[],
      };

      // Add custom fields based on available mappings and data
      if (mappings.customdraftdate && row.draft_date) {
        updatePayload.customFields.push({
          id: mappings.customdraftdate,
          field_value: row.draft_date
        });
        console.log('  ✅ Added custom field: Draft Date =', row.draft_date);
      }

      if (mappings.customcarrier && row.carrier) {
        updatePayload.customFields.push({
          id: mappings.customcarrier,
          field_value: row.carrier
        });
        console.log('  ✅ Added custom field: Carrier =', row.carrier);
      }

      if (mappings.custommp && row.monthly_premium) {
        updatePayload.customFields.push({
          id: mappings.custommp,
          field_value: row.monthly_premium.toString()
        });
        console.log('  ✅ Added custom field: Monthly Premium =', row.monthly_premium);
      }

      if (mappings.customfaceamount && row.face_amount) {
        updatePayload.customFields.push({
          id: mappings.customfaceamount,
          field_value: row.face_amount.toString()
        });
        console.log('  ✅ Added custom field: Face Amount =', row.face_amount);
      }

      console.log('📦 GHL Sync Payload:', {
        opportunityId,
        locationId,
        insuredName: row.insured_name,
        payload: updatePayload
      });

      // Make the API call to GHL
      console.log('🚀 Sending update to GHL API...');
      const response = await fetch(`https://services.leadconnectorhq.com/opportunities/${opportunityId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Version': '2021-07-28',
          'Authorization': `Bearer ${apiToken}`,
        },
        body: JSON.stringify(updatePayload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ GHL API Error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData
        });
        throw new Error(`GHL API Error: ${response.status} - ${errorData.message || 'Unknown error'}`);
      }

      const result = await response.json();
      console.log('✅ GHL API Response:', result);
      console.log('  Updated Stage ID:', result.pipelineStageId);
      console.log('  Updated Pipeline ID:', result.pipelineId);

      // Create notes if we have notes content
      if (row.notes && row.notes.trim()) {
        console.log('📝 Creating notes for contact:', contactId);
        console.log('  Notes content:', row.notes.substring(0, 100) + (row.notes.length > 100 ? '...' : ''));
        try {
          const notesResponse = await fetch(`https://services.leadconnectorhq.com/contacts/${contactId}/notes`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Version': '2021-07-28',
              'Authorization': `Bearer ${apiToken}`,
            },
            body: JSON.stringify({
              userId: 'uO52LEhmrtCqg9eYdiIZ',
              body: row.notes.trim()
            }),
          });

          if (!notesResponse.ok) {
            console.error('❌ Failed to create notes:', notesResponse.status, await notesResponse.text());
            // Don't fail the entire sync for notes failure
          } else {
            console.log('✅ Notes created successfully');
          }
        } catch (notesError) {
          console.error('❌ Error creating notes:', notesError);
          // Don't fail the entire sync for notes failure
        }
      } else {
        console.log('ℹ️  No notes to sync');
      }

      // Update the status to "synced" in the database
      console.log('💾 Updating sync_status to "synced" for row:', row.id);
      const { error: updateError } = await supabase
        .from('daily_deal_flow')
        .update({ sync_status: 'synced' })
        .eq('id', row.id);

      if (updateError) {
        console.error('❌ Failed to update status:', updateError);
        // Don't fail the entire sync for status update failure
      } else {
        console.log('✅ Status updated to synced successfully');
      }

      console.log('🎉 Sync completed successfully for:', row.insured_name);

      toast({
        title: 'Sync Successful',
        description: `Successfully synced ${row.insured_name || 'Unknown'} to GHL`,
      });

      onDataUpdate(); // Refresh the data

    } catch (error) {
      console.error('💥 Error syncing to GHL:', error);
      console.error('  Row ID:', row.id);
      console.error('  Insured Name:', row.insured_name);
      console.error('  Error Details:', error instanceof Error ? error.message : String(error));

      // Update the status to "sync failed" in the database when sync fails
      console.log('💾 Updating sync_status to "sync failed" for row:', row.id);
      try {
        const { error: updateError } = await supabase
          .from('daily_deal_flow')
          .update({ sync_status: 'sync failed' })
          .eq('id', row.id);

        if (updateError) {
          console.error('❌ Failed to update status to sync failed:', updateError);
        } else {
          console.log('✅ Status updated to sync failed successfully');
        }
      } catch (statusUpdateError) {
        console.error('❌ Error updating status to sync failed:', statusUpdateError);
      }

      toast({
        title: 'Sync Failed',
        description: error instanceof Error ? error.message : `Failed to sync ${row.insured_name || 'Unknown'} to GHL`,
        variant: 'destructive',
      });

      onDataUpdate(); // Refresh the data to show the updated status
    } finally {
      console.log('🏁 Sync process finished for:', row.insured_name);
      setSyncingRows(prev => {
        const newSet = new Set(prev);
        newSet.delete(row.id);
        return newSet;
      });
    }
  };

  const handleBulkSync = async () => {
    if (!hasWritePermissions) {
      toast({
        title: 'Permission Denied',
        description: 'You do not have permission to sync data to GHL',
        variant: 'destructive',
      });
      return;
    }

    const rowsToSync = data.filter(row =>
      selectedRows.has(row.id) &&
      row.sync_status?.toLowerCase() !== 'synced'
    );

    if (rowsToSync.length === 0) {
      toast({
        title: 'No Rows to Sync',
        description: 'Please select rows that are not already synced',
        variant: 'default',
      });
      return;
    }

    setBulkSyncing(true);
    setBulkSyncProgress({ current: 0, total: rowsToSync.length });

    let successCount = 0;
    let failureCount = 0;

    try {
      for (let i = 0; i < rowsToSync.length; i++) {
        const row = rowsToSync[i];
        setBulkSyncProgress({ current: i + 1, total: rowsToSync.length, currentRow: row });

        try {
          await handleSyncToGHL(row);
          successCount++;
        } catch (error) {
          failureCount++;
          console.error(`Failed to sync row ${row.id}:`, error);
        }

        // Small delay between requests to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      toast({
        title: 'Bulk Sync Complete',
        description: `Successfully synced ${successCount} rows${failureCount > 0 ? `, ${failureCount} failed` : ''}`,
        variant: failureCount > 0 ? 'destructive' : 'default',
      });

    } catch (error) {
      console.error('Bulk sync error:', error);
      toast({
        title: 'Bulk Sync Failed',
        description: 'An unexpected error occurred during bulk sync',
        variant: 'destructive',
      });
    } finally {
      setBulkSyncing(false);
      setBulkSyncProgress({ current: 0, total: 0 });
      setSelectedRows(new Set()); // Clear selection after bulk sync
      onDataUpdate(); // Refresh the data
    }
  };

  const handleRowSelect = (rowId: string, checked: boolean) => {
    setSelectedRows(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(rowId);
      } else {
        newSet.delete(rowId);
      }
      return newSet;
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const syncableRowIds = data
        .filter(row => row.sync_status?.toLowerCase() !== 'synced')
        .map(row => row.id);
      setSelectedRows(new Set(syncableRowIds));
    } else {
      setSelectedRows(new Set());
    }
  };

  const formatCurrency = (amount: number | null | undefined) => {
    if (!amount) return '';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  const getStatusBadgeVariant = (status: string | null | undefined, syncStatus: string | null | undefined) => {
    // First check sync_status for sync-related statuses
    if (syncStatus) {
      const syncStatusLower = syncStatus.toLowerCase();
      if (syncStatusLower === 'synced') return 'default'; // Green badge for synced
      if (syncStatusLower === 'sync failed') return 'destructive'; // Red badge for sync failed
    }

    // Fall back to regular status if no sync_status or not sync-related
    if (!status) return 'secondary';

    const statusLower = status.toLowerCase();
    if (statusLower.includes('pending') || statusLower.includes('incomplete')) return 'secondary';
    if (statusLower.includes('sold') || statusLower.includes('fulfilled')) return 'default';
    if (statusLower.includes('dq') || statusLower.includes('returned')) return 'destructive';
    if (statusLower.includes('callback') || statusLower.includes('future')) return 'outline';

    return 'secondary';
  };

  if (data.length === 0) {
    return (
      <Card>
        <CardContent className='flex items-center justify-center py-12'>
          <div className='text-center'>
            <p className='text-muted-foreground text-lg'>No data found</p>
            <p className='text-sm text-muted-foreground mt-1'>
              Try adjusting your filters or check back later
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className='space-y-4'>
      {/* Bulk Sync Progress Modal */}
      {bulkSyncing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-96 max-w-md mx-4">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Bulk Sync Progress</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setBulkSyncing(false);
                    setBulkSyncProgress({ current: 0, total: 0 });
                  }}
                  className="h-6 w-6 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Progress</span>
                  <span>{bulkSyncProgress.current} of {bulkSyncProgress.total}</span>
                </div>
                <Progress 
                  value={(bulkSyncProgress.current / bulkSyncProgress.total) * 100} 
                  className="w-full"
                />
              </div>
              
              {bulkSyncProgress.currentRow && (
                <div className="space-y-2">
                  <div className="text-sm font-medium">Currently Processing:</div>
                  <div className="bg-muted p-3 rounded-md space-y-1 text-sm">
                    <div><strong>Name:</strong> {bulkSyncProgress.currentRow.insured_name || 'Unknown'}</div>
                    <div><strong>Submission ID:</strong> {bulkSyncProgress.currentRow.submission_id}</div>
                    <div><strong>Lead Vendor:</strong> {bulkSyncProgress.currentRow.lead_vendor || 'Unknown'}</div>
                    <div><strong>Status:</strong> {bulkSyncProgress.currentRow.status || 'Unknown'}</div>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Syncing records to GoHighLevel...</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Bulk Actions */}
      {selectedRows.size > 0 && (
        <Card>
          <CardContent className='p-4'>
            <div className='flex items-center justify-between'>
              <div className='flex items-center gap-2'>
                <span className='text-sm font-medium'>
                  {selectedRows.size} row{selectedRows.size !== 1 ? 's' : ''} selected
                </span>
              </div>
              <div className='flex items-center gap-2'>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => setSelectedRows(new Set())}
                  disabled={bulkSyncing}
                >
                  Clear Selection
                </Button>
                <Button
                  variant='default'
                  size='sm'
                  onClick={handleBulkSync}
                  disabled={bulkSyncing || !hasWritePermissions}
                  className='flex items-center gap-2'
                >
                  {bulkSyncing ? (
                    <Loader2 className='h-4 w-4 animate-spin' />
                  ) : (
                    <Play className='h-4 w-4' />
                  )}
                  {bulkSyncing ? 'Syncing...' : 'Bulk Sync Selected'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Data Table */}
      <div className='border rounded-lg overflow-hidden'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className='w-[50px]'>
                <button
                  onClick={() => handleSelectAll(selectedRows.size === 0)}
                  className='flex items-center justify-center w-full h-full hover:bg-muted/50 rounded'
                  disabled={bulkSyncing}
                >
                  {(() => {
                    const syncableRows = data.filter(row => row.sync_status?.toLowerCase() !== 'synced');
                    const selectedSyncableRows = syncableRows.filter(row => selectedRows.has(row.id));
                    if (selectedSyncableRows.length === syncableRows.length && syncableRows.length > 0) {
                      return <CheckSquare className='h-4 w-4' />;
                    } else if (selectedSyncableRows.length > 0) {
                      return <div className='h-4 w-4 border-2 border-current bg-current' style={{clipPath: 'polygon(0 0, 100% 0, 100% 50%, 0 50%)'}} />;
                    } else {
                      return <Square className='h-4 w-4' />;
                    }
                  })()}
                </button>
              </TableHead>
              <TableHead className='w-[120px]'>Date</TableHead>
              <TableHead className='w-[160px]'>Insured Name</TableHead>
              <TableHead className='w-[140px]'>Phone</TableHead>
              <TableHead className='w-[120px]'>Lead Vendor</TableHead>
              <TableHead className='w-[100px]'>Agent</TableHead>
              <TableHead className='w-[120px]'>Status</TableHead>
              <TableHead className='w-[100px]'>Carrier</TableHead>
              <TableHead className='w-[100px]'>Face Amount</TableHead>
              <TableHead className='w-[200px]'>Notes</TableHead>
              <TableHead className='w-[120px]'>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  {row.sync_status?.toLowerCase() !== 'synced' && (
                    <button
                      onClick={() => handleRowSelect(row.id, !selectedRows.has(row.id))}
                      className='flex items-center justify-center w-full h-full hover:bg-muted/50 rounded'
                      disabled={bulkSyncing || syncingRows.has(row.id)}
                    >
                      {selectedRows.has(row.id) ? (
                        <CheckSquare className='h-4 w-4' />
                      ) : (
                        <Square className='h-4 w-4' />
                      )}
                    </button>
                  )}
                </TableCell>
                <TableCell className='font-medium'>
                  {formatDate(row.date)}
                </TableCell>
                <TableCell>{row.insured_name || 'N/A'}</TableCell>
                <TableCell className='text-sm'>
                  {row.client_phone_number || 'N/A'}
                </TableCell>
                <TableCell>{row.lead_vendor || 'N/A'}</TableCell>
                <TableCell>{row.agent || 'N/A'}</TableCell>
                <TableCell>
                  <Badge variant={getStatusBadgeVariant(row.status, row.sync_status)}>
                    {row.sync_status || row.status || 'N/A'}
                  </Badge>
                </TableCell>
                <TableCell>{row.carrier || 'N/A'}</TableCell>
                <TableCell className='text-right'>
                  {formatCurrency(row.face_amount)}
                </TableCell>
                <TableCell>
                  {row.notes ? (
                    <div className='flex items-center gap-1 max-w-[200px]'>
                      <span className='truncate text-sm'>{row.notes}</span>
                      <Button
                        variant='ghost'
                        size='sm'
                        onClick={() => {
                          navigator.clipboard.writeText(row.notes || '');
                          toast({
                            title: 'Copied!',
                            description: 'Notes copied to clipboard',
                          });
                        }}
                        className='h-6 w-6 p-0 flex-shrink-0'
                      >
                        <Copy className='h-3 w-3' />
                      </Button>
                    </div>
                  ) : (
                    <span className='text-muted-foreground text-sm'>No notes</span>
                  )}
                </TableCell>
                <TableCell>
                  {row.sync_status?.toLowerCase() === 'synced' ? (
                    <Badge variant="default" className="flex items-center gap-1">
                      <RefreshCw className="h-3 w-3" />
                      Synced
                    </Badge>
                  ) : (
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={() => handleSyncToGHL(row)}
                      disabled={!hasWritePermissions || syncingRows.has(row.id)}
                      className='flex items-center gap-1'
                    >
                      {syncingRows.has(row.id) ? (
                        <Loader2 className='h-3 w-3 animate-spin' />
                      ) : (
                        <RefreshCw className='h-3 w-3' />
                      )}
                      {row.sync_status?.toLowerCase() === 'sync failed' ? 'Retry Sync' : 'Sync'}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className='flex items-center justify-between'>
          <div className='text-sm text-muted-foreground'>
            Showing {((currentPage - 1) * recordsPerPage) + 1} to {Math.min(currentPage * recordsPerPage, totalRecords)} of {totalRecords} results
          </div>

          <div className='flex items-center gap-2'>
            <Button
              variant='outline'
              size='sm'
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              <ChevronLeft className='h-4 w-4' />
              Previous
            </Button>

            <div className='flex items-center gap-1'>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pageNum = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
                if (pageNum > totalPages) return null;

                return (
                  <Button
                    key={pageNum}
                    variant={pageNum === currentPage ? 'default' : 'outline'}
                    size='sm'
                    onClick={() => onPageChange(pageNum)}
                    className='w-8 h-8 p-0'
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>

            <Button
              variant='outline'
              size='sm'
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              Next
              <ChevronRight className='h-4 w-4' />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
