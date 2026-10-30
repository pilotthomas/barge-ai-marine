import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Ship, Anchor, Edit2, AlertTriangle, Calendar, Save } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { format, parseISO, differenceInDays } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const complianceFields = [
  { key: 'uscg_internal_exam', label: 'USCG Internal Exam' },
  { key: 'uscg_5_year_drydock', label: 'USCG 5 Year Dry Dock Exam' },
  { key: 'uscg_cargo_tank_exam', label: 'USCG Cargo Tank Exam' },
  { key: 'abs_2_5_year_drydock', label: 'ABS 2.5 Year Dry Dock Exam' },
  { key: 'sire_expiration', label: 'SIRE Expiration Date' },
  { key: 'abs_load_line', label: 'ABS Load Line' },
  { key: 'abs_class', label: 'ABS Class' },
  { key: 'uscg_coi_expiration', label: 'USCG COI Expiration' },
  { key: 'uscg_cod_expiration', label: 'USCG COD Expiration' },
];

const carbFields = [
  { key: 'carb_tier3_mandate', label: 'CARB Tier 3 Mandate Date' },
  { key: 'carb_tier4_mandate', label: 'CARB Tier 4 Mandate Date' },
];

const marketColors = {
  "Long Beach": "from-orange-500 to-orange-600",
  "Oakland": "from-emerald-500 to-emerald-600",
  "Portland": "from-purple-500 to-purple-600",
  "Seattle": "from-blue-500 to-blue-600"
};

export default function VesselComplianceDates() {
  const [editingVessel, setEditingVessel] = useState(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedMarket, setSelectedMarket] = useState('all');
  const [selectedVessel, setSelectedVessel] = useState('all');
  const [selectedVesselType, setSelectedVesselType] = useState('all');
  const [formData, setFormData] = useState({
    uscg_internal_exam: '',
    uscg_5_year_drydock: '',
    uscg_cargo_tank_exam: '',
    abs_2_5_year_drydock: '',
    sire_expiration: '',
    abs_load_line: '',
    abs_class: '',
    uscg_coi_expiration: '',
    uscg_cod_expiration: '',
    carb_tier3_mandate: '',
    carb_tier4_mandate: ''
  });

  const queryClient = useQueryClient();

  const { data: barges = [] } = useQuery({
    queryKey: ['barges'],
    queryFn: () => base44.entities.Barge.list(),
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const { data: tugs = [] } = useQuery({
    queryKey: ['tugs'],
    queryFn: () => base44.entities.Tug.list(),
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const updateTugMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Tug.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tugs'] });
      setShowEditDialog(false);
      setEditingVessel(null);
    },
  });

  const updateBargeMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Barge.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['barges'] });
      setShowEditDialog(false);
      setEditingVessel(null);
    },
  });

  const isValidDate = (dateString) => {
    if (!dateString) return false;
    try {
      const date = new Date(dateString + 'T00:00:00.000Z');
      return date instanceof Date && !isNaN(date.getTime());
    } catch {
      return false;
    }
  };

  const formatDate = (dateString) => {
    if (!isValidDate(dateString)) return '';
    return format(parseISO(dateString), 'MMM d, yyyy');
  };

  const getComplianceStatus = (date) => {
    if (!date) return null;
    try {
      const daysUntil = differenceInDays(new Date(date), new Date());
      if (daysUntil < 0) return 'overdue';
      if (daysUntil <= 60) return 'due_soon';
      return 'ok';
    } catch (error) {
      return null;
    }
  };

  const isCaliforniaMarket = (market) => {
    return market === 'Long Beach' || market === 'Oakland';
  };

  const handleEdit = (vessel, vesselType) => {
    setEditingVessel({ ...vessel, vessel_type: vesselType });
    setFormData({
      uscg_internal_exam: vessel.uscg_internal_exam || '',
      uscg_5_year_drydock: vessel.uscg_5_year_drydock || '',
      uscg_cargo_tank_exam: vessel.uscg_cargo_tank_exam || '',
      abs_2_5_year_drydock: vessel.abs_2_5_year_drydock || '',
      sire_expiration: vessel.sire_expiration || '',
      abs_load_line: vessel.abs_load_line || '',
      abs_class: vessel.abs_class || '',
      uscg_coi_expiration: vessel.uscg_coi_expiration || '',
      uscg_cod_expiration: vessel.uscg_cod_expiration || '',
      carb_tier3_mandate: vessel.carb_tier3_mandate || '',
      carb_tier4_mandate: vessel.carb_tier4_mandate || ''
    });
    setShowEditDialog(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingVessel) {
      const mutation = editingVessel.vessel_type === 'tug' ? updateTugMutation : updateBargeMutation;
      
      // Only send relevant fields based on vessel type
      let fieldsToUpdate = {};
      if (editingVessel.vessel_type === 'tug' && editingVessel.is_third_party) {
        // 3rd party tugs: only SIRE and dry dock
        fieldsToUpdate = {
          sire_expiration: formData.sire_expiration,
          uscg_5_year_drydock: formData.uscg_5_year_drydock
        };
      } else {
        // Send all formData for other vessels
        fieldsToUpdate = formData;
      }
      
      mutation.mutate({
        id: editingVessel.id,
        data: fieldsToUpdate
      });
    }
  };

  // Get all vessels with their compliance status
  const allVessels = [
    ...barges.map(b => ({ ...b, vessel_type: 'barge' })),
    ...tugs.map(t => ({ ...t, vessel_type: 'tug' }))
  ];

  const vesselsWithCompliance = allVessels
    .filter(vessel => {
      if (selectedMarket !== 'all' && vessel.market !== selectedMarket) return false;
      if (selectedVesselType !== 'all' && vessel.vessel_type !== selectedVesselType) return false;
      if (selectedVessel !== 'all' && vessel.id !== selectedVessel) return false;
      return true;
    })
    .map(vessel => {
      // For 3rd party tugs, only show SIRE and next dry dock
      const thirdPartyTugFields = [
        { key: 'sire_expiration', label: 'SIRE Expiration Date' },
        { key: 'uscg_5_year_drydock', label: 'Next Dry Dock' }
      ];

      // Tugs don't have SIRE, cargo tank exam, or ABS Class
      const tugFields = complianceFields.filter(f => 
        !f.key.includes('sire') && 
        !f.key.includes('cargo_tank') && 
        !f.key.includes('abs_class') &&
        !f.key.includes('abs_load_line')
      );
      
      const allFields = vessel.vessel_type === 'tug' && vessel.is_third_party
        ? thirdPartyTugFields
        : vessel.vessel_type === 'tug' 
        ? [...tugFields, ...(isCaliforniaMarket(vessel.market) ? carbFields : [])]
        : [...complianceFields, ...(isCaliforniaMarket(vessel.market) ? carbFields : [])];
      
      const issues = allFields
        .filter(field => {
          if (!isValidDate(vessel[field.key])) return false;
          const status = getComplianceStatus(vessel[field.key]);
          return status === 'overdue' || status === 'due_soon';
        })
        .map(field => ({
          ...field,
          date: vessel[field.key],
          status: getComplianceStatus(vessel[field.key]),
          daysUntil: differenceInDays(new Date(vessel[field.key]), new Date())
        }));

      const allDates = allFields
        .filter(field => isValidDate(vessel[field.key]))
        .map(field => ({
          ...field,
          date: vessel[field.key],
          status: getComplianceStatus(vessel[field.key]),
          daysUntil: isValidDate(vessel[field.key]) ? differenceInDays(new Date(vessel[field.key]), new Date()) : null
        }));

      return {
        vessel,
        issues,
        allDates,
        critical: issues.filter(i => i.status === 'overdue').length,
        warning: issues.filter(i => i.status === 'due_soon').length
      };
    })
    .sort((a, b) => b.critical - a.critical || b.warning - a.warning);

  const markets = ['all', ...new Set([...barges.map(b => b.market), ...tugs.map(t => t.market)].filter(Boolean))];

  return (
    <div className="p-4 md:p-8 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">
              Vessel Compliance Dates
            </h1>
            <p className="text-slate-600">Track vessel compliance expiration dates</p>
          </div>
        </div>

        {/* Filters */}
        <Card className="shadow-md border-slate-200">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 min-w-full md:min-w-[200px]">
                <Label htmlFor="market-filter" className="text-sm font-medium mb-2 block">Market</Label>
                <Select value={selectedMarket} onValueChange={setSelectedMarket}>
                  <SelectTrigger id="market-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Markets</SelectItem>
                    {markets.filter(m => m !== 'all').map(market => (
                      <SelectItem key={market} value={market}>{market}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex-1 min-w-full md:min-w-[200px]">
                <Label htmlFor="vessel-type-filter" className="text-sm font-medium mb-2 block">Vessel Type</Label>
                <Select value={selectedVesselType} onValueChange={(value) => {
                  setSelectedVesselType(value);
                  setSelectedVessel('all');
                }}>
                  <SelectTrigger id="vessel-type-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="barge">Barges</SelectItem>
                    <SelectItem value="tug">Tugs</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex-1 min-w-full md:min-w-[200px]">
                <Label htmlFor="vessel-filter" className="text-sm font-medium mb-2 block">Vessel</Label>
                <Select value={selectedVessel} onValueChange={setSelectedVessel}>
                  <SelectTrigger id="vessel-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Vessels</SelectItem>
                    {allVessels
                      .filter(v => {
                        if (selectedMarket !== 'all' && v.market !== selectedMarket) return false;
                        if (selectedVesselType !== 'all' && v.vessel_type !== selectedVesselType) return false;
                        return true;
                      })
                      .map(vessel => (
                        <SelectItem key={vessel.id} value={vessel.id}>
                          {vessel.name} ({vessel.vessel_type})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto mx-4">
            <DialogHeader>
              <DialogTitle className="text-2xl flex items-center gap-2">
                <Calendar className="w-6 h-6 text-blue-600" />
                Edit Compliance Dates - {editingVessel?.name} ({editingVessel?.vessel_type})
              </DialogTitle>
            </DialogHeader>
            {editingVessel && (
              <form onSubmit={handleSubmit} className="space-y-6 mt-4">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-slate-900">USCG & ABS Compliance</h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    {(editingVessel.vessel_type === 'tug' && editingVessel.is_third_party
                      ? [
                          { key: 'sire_expiration', label: 'SIRE Expiration Date' },
                          { key: 'uscg_5_year_drydock', label: 'Next Dry Dock' }
                        ]
                      : complianceFields.filter(field => {
                          // Filter out fields that don't apply to tugs
                          if (editingVessel.vessel_type === 'tug') {
                            return !field.key.includes('sire') && 
                                   !field.key.includes('cargo_tank') && 
                                   !field.key.includes('abs_class') &&
                                   !field.key.includes('abs_load_line');
                          }
                          return true;
                        })
                    ).map((field) => (
                      <div key={field.key} className="space-y-2">
                        <Label htmlFor={field.key}>{field.label}</Label>
                        <Input
                          id={field.key}
                          type="date"
                          value={formData[field.key]}
                          onChange={(e) => setFormData({...formData, [field.key]: e.target.value})}
                        />
                      </div>
                    ))}
                  </div>

                  {isCaliforniaMarket(editingVessel.market) && !(editingVessel.vessel_type === 'tug' && editingVessel.is_third_party) && (
                    <>
                      <h3 className="text-lg font-semibold text-slate-900 mt-6">CARB Compliance (California)</h3>
                      <div className="grid md:grid-cols-2 gap-4">
                        {carbFields.map((field) => (
                          <div key={field.key} className="space-y-2">
                            <Label htmlFor={field.key}>{field.label}</Label>
                            <Input
                              id={field.key}
                              type="date"
                              value={formData[field.key]}
                              onChange={(e) => setFormData({...formData, [field.key]: e.target.value})}
                            />
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button type="button" variant="outline" onClick={() => setShowEditDialog(false)}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={updateBargeMutation.isPending}
                    className="bg-gradient-to-r from-blue-600 to-blue-700"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {updateBargeMutation.isPending ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </form>
            )}
          </DialogContent>
        </Dialog>

        {/* Vessels with Compliance */}
        {vesselsWithCompliance.length === 0 ? (
          <Card className="shadow-md border-slate-200">
            <CardContent className="p-12 text-center">
              <Ship className="w-16 h-16 mx-auto mb-4 text-slate-300" />
              <p className="text-lg font-medium text-slate-600 mb-2">No vessels found</p>
              <p className="text-sm text-slate-500">Try adjusting your filters</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
            {vesselsWithCompliance.map(({ vessel, issues, allDates, critical, warning }) => (
              <Card
                key={vessel.id}
                className={`shadow-md transition-shadow duration-200 ${
                  critical > 0
                    ? 'border-red-300 bg-red-50'
                    : warning > 0
                    ? 'border-yellow-300 bg-yellow-50'
                    : 'border-slate-200'
                }`}
              >
                <CardHeader className="border-b border-slate-100 pb-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 bg-gradient-to-br ${
                        critical > 0 ? 'from-red-500 to-red-600' :
                        warning > 0 ? 'from-yellow-500 to-yellow-600' :
                        vessel.market ? marketColors[vessel.market] : 'from-slate-400 to-slate-500'
                      } rounded-xl flex items-center justify-center shadow-md`}>
                        <Ship className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-xl font-bold text-slate-900">
                          {vessel.name}
                        </CardTitle>
                        {vessel.vessel_type === 'tug' && vessel.company_name && (
                          <p className="text-sm text-slate-500 italic">{vessel.company_name}</p>
                        )}
                        <p className="text-sm text-slate-600 capitalize">{vessel.vessel_type} • {vessel.market || 'No Market'}</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(vessel, vessel.vessel_type)}
                      className="hover:bg-slate-100"
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  {issues.length > 0 && (
                    <div className="mb-4">
                      <div className="mb-2 flex items-center gap-2">
                        <AlertTriangle className={`w-5 h-5 ${critical > 0 ? 'text-red-600' : 'text-yellow-600'}`} />
                        <span className={`font-semibold text-sm ${critical > 0 ? 'text-red-800' : 'text-yellow-800'}`}>
                          {issues.length} Alert{issues.length > 1 ? 's' : ''} (Next 60 Days)
                        </span>
                      </div>

                      <div className="space-y-2 mb-4">
                        {issues.map((issue) => (
                          <div
                            key={issue.key}
                            className={`p-2 rounded-lg border ${
                              issue.status === 'overdue'
                                ? 'bg-red-100 border-red-300'
                                : 'bg-yellow-100 border-yellow-300'
                            }`}
                          >
                            <div className="flex items-start justify-between mb-1">
                              <h4 className="font-semibold text-xs text-slate-900">{issue.label}</h4>
                              <Badge className={`text-xs ${
                                issue.status === 'overdue'
                                  ? 'bg-red-200 text-red-900 border-red-300'
                                  : 'bg-yellow-200 text-yellow-900 border-yellow-300'
                              }`}>
                                {issue.status === 'overdue' ? 'OVERDUE' : 'DUE SOON'}
                              </Badge>
                            </div>
                            <div className="space-y-0.5">
                              <p className="text-xs text-slate-700">
                                {formatDate(issue.date)} • {issue.status === 'overdue'
                                  ? `${Math.abs(issue.daysUntil)} days overdue`
                                  : `${issue.daysUntil} days left`
                                }
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {allDates.length > 0 && (
                    <div className="mb-4">
                      <h4 className="font-semibold text-sm text-slate-700 mb-2">All Compliance Dates</h4>
                      <div className="space-y-1.5 max-h-64 overflow-y-auto">
                        {allDates.map((item) => (
                          <div key={item.key} className="flex justify-between items-start text-xs py-1.5 border-b border-slate-200 last:border-0">
                            <span className="text-slate-600 flex-1 pr-2">{item.label}</span>
                            <div className="text-right">
                              <span className="font-medium text-slate-900 block">{formatDate(item.date)}</span>
                              {item.daysUntil !== null && (
                                <span className={`text-xs ${
                                  item.status === 'overdue' ? 'text-red-600' :
                                  item.status === 'due_soon' ? 'text-yellow-600' :
                                  'text-slate-500'
                                }`}>
                                  {item.daysUntil < 0 ? `${Math.abs(item.daysUntil)}d ago` : `${item.daysUntil}d`}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {allDates.length === 0 && (
                    <div className="text-center py-4 text-slate-500 text-sm">
                      No compliance dates set
                    </div>
                  )}

                  <Button
                    onClick={() => handleEdit(vessel, vessel.vessel_type)}
                    className="w-full mt-2 bg-gradient-to-r from-blue-600 to-blue-700"
                  >
                    <Edit2 className="w-4 h-4 mr-2" />
                    Update Compliance Dates
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}