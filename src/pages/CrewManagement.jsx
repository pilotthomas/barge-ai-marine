import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Users, Shield, Mail, Phone, Save, AlertCircle, RefreshCw, Plus, Edit2, UserPlus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { crewPositions, hasPosition } from "@/lib/crewPositions";

const positionColors = {
  captain: "bg-blue-100 text-blue-800 border-blue-200",
  deckhand: "bg-teal-100 text-teal-800 border-teal-200",
  tankerman: "bg-indigo-100 text-indigo-800 border-indigo-200",
  driver: "bg-amber-100 text-amber-800 border-amber-200"
};

const marketColors = {
  "Long Beach": "bg-orange-100 text-orange-800 border-orange-200",
  "Oakland": "bg-emerald-100 text-emerald-800 border-emerald-200",
  "Portland": "bg-purple-100 text-purple-800 border-purple-200",
  "Seattle": "bg-blue-100 text-blue-800 border-blue-200",
  "Richmond CA": "bg-sky-100 text-sky-800 border-sky-200",
  "Rancho Dominguez": "bg-rose-100 text-rose-800 border-rose-200"
};

const capitalizeName = (name) => {
  if (!name) return '';
  return name
    .replace(/[._]/g, ' ')
    .split(' ')
    .filter(word => word.length > 0)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

const formatNameLastFirst = (name) => {
  if (!name) return '';
  const capitalizedName = capitalizeName(name);
  const parts = capitalizedName.split(' ');
  if (parts.length === 1) return parts[0];
  const lastName = parts.pop();
  const firstName = parts.join(' ');
  return `${lastName}, ${firstName}`;
};

export default function CrewManagement() {
  const [currentUser, setCurrentUser] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingCrew, setEditingCrew] = useState(null);
  const [selectedMarket, setSelectedMarket] = useState("all");
  const [selectedPosition, setSelectedPosition] = useState("all");
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    position: '',
    positions: [],
    market: '',
    phone: '',
    is_active: true,
    user_id: ''
  });

  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => {});
  }, []);

  const { data: crewMembers = [] } = useQuery({
    queryKey: ['crew-members'],
    queryFn: () => base44.entities.CrewMember.list(),
  });

  const { data: drivers = [] } = useQuery({
    queryKey: ['drivers'],
    queryFn: () => base44.entities.Driver.list(),
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
    enabled: currentUser?.role === 'admin',
    initialData: [],
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.CrewMember.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crew-members'] });
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.CrewMember.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crew-members'] });
      resetForm();
    },
  });

  const syncFromUsersMutation = useMutation({
    mutationFn: async () => {
      const crewUsers = users.filter(u => 
        u.position && ['captain', 'deckhand', 'tankerman', 'driver'].includes(u.position) && u.market
      );

      const syncPromises = crewUsers.map(async (user) => {
        const existing = crewMembers.find(c => c.user_id === user.id);
        
        const crewData = {
          full_name: user.full_name,
          email: user.email,
          position: user.position,
          market: user.market,
          phone: user.phone || '',
          is_active: true,
          user_id: user.id
        };

        if (existing) {
          return base44.entities.CrewMember.update(existing.id, crewData);
        } else {
          return base44.entities.CrewMember.create(crewData);
        }
      });

      return Promise.all(syncPromises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crew-members'] });
    },
  });

  const resetForm = () => {
    setFormData({
      full_name: '',
      email: '',
      position: '',
      positions: [],
      market: '',
      phone: '',
      is_active: true,
      user_id: ''
    });
    setShowForm(false);
    setEditingCrew(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (formData.positions.length === 0) { alert('Select at least one position.'); return; }
    if (editingCrew) {
      updateMutation.mutate({ id: editingCrew.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (crew) => {
    setEditingCrew(crew);
    setFormData({
      full_name: crew.full_name,
      email: crew.email || '',
      position: crew.position,
      positions: crewPositions(crew),
      market: crew.market,
      phone: crew.phone || '',
      is_active: crew.is_active !== false,
      user_id: crew.user_id || ''
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!currentUser) {
    return (
      <div className="p-4 md:p-8 min-h-screen flex items-center justify-center">
        <div className="text-center text-slate-500">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (currentUser.role !== 'admin') {
    return (
      <div className="p-4 md:p-8 min-h-screen flex items-center justify-center">
        <Card className="max-w-md shadow-lg border-slate-200">
          <CardContent className="p-12 text-center">
            <AlertCircle className="w-16 h-16 mx-auto mb-4 text-red-500" />
            <h3 className="text-xl font-semibold text-slate-900 mb-2">Access Denied</h3>
            <p className="text-slate-600">Only administrators can manage crew members.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Combine crew members and drivers for unified display
  const combinedCrew = [
    ...crewMembers.map(c => ({ ...c, source: 'crew' })),
    ...drivers.map(d => ({ 
      id: d.id,
      full_name: d.name, 
      email: d.email || '', 
      position: 'driver', 
      market: d.market,
      phone: d.phone || '',
      is_active: d.is_active,
      source: 'driver',
      license_number: d.license_number,
      cdl_expiration: d.cdl_expiration,
      hazmat_expiration: d.hazmat_expiration
    }))
  ];

  // Filter by market and position
  const filteredCrew = combinedCrew.filter(c => {
    const marketMatch = selectedMarket === "all" || c.market === selectedMarket;
    const positionMatch = selectedPosition === "all" || hasPosition(c, selectedPosition);
    return marketMatch && positionMatch;
  });

  // Sort by last name
  const sortByLastName = (a, b) => {
    const lastNameA = a.full_name.split(' ').pop().toLowerCase();
    const lastNameB = b.full_name.split(' ').pop().toLowerCase();
    return lastNameA.localeCompare(lastNameB);
  };

  const activeCrewMembers = filteredCrew.filter(c => c.is_active !== false).sort(sortByLastName);
  const inactiveCrewMembers = filteredCrew.filter(c => c.is_active === false).sort(sortByLastName);

  return (
    <div className="p-4 md:p-8 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">
              Crew Management
            </h1>
            <p className="text-slate-600">Manage crew members and drivers for dispatch assignments</p>
          </div>
          <div className="flex gap-3">
            <Button
              onClick={() => syncFromUsersMutation.mutate()}
              disabled={syncFromUsersMutation.isPending}
              variant="outline"
              className="border-blue-300"
            >
              <RefreshCw className={`w-5 h-5 mr-2 ${syncFromUsersMutation.isPending ? 'animate-spin' : ''}`} />
              Sync from Users
            </Button>
            <Button
              onClick={() => {
                resetForm();
                setShowForm(!showForm);
              }}
              className="bg-gradient-to-r from-blue-600 to-blue-700"
            >
              <Plus className="w-5 h-5 mr-2" />
              Add Crew Member
            </Button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <Select value={selectedMarket} onValueChange={setSelectedMarket}>
            <SelectTrigger className="w-full md:w-48">
              <SelectValue placeholder="Filter by Market" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Markets</SelectItem>
              <SelectItem value="Long Beach">Long Beach</SelectItem>
              <SelectItem value="Oakland">Oakland</SelectItem>
              <SelectItem value="Portland">Portland</SelectItem>
              <SelectItem value="Seattle">Seattle</SelectItem>
              <SelectItem value="Richmond CA">Richmond CA</SelectItem>
              <SelectItem value="Rancho Dominguez">Rancho Dominguez</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedPosition} onValueChange={setSelectedPosition}>
            <SelectTrigger className="w-full md:w-48">
              <SelectValue placeholder="Filter by Position" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Positions</SelectItem>
              <SelectItem value="captain">Captain</SelectItem>
              <SelectItem value="deckhand">Deckhand</SelectItem>
              <SelectItem value="tankerman">Tankerman</SelectItem>
              <SelectItem value="driver">Driver</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card className="shadow-md border-slate-200 bg-blue-50">
          <CardContent className="p-6">
            <div className="space-y-2 text-sm text-slate-700">
              <p><strong>Sync from Users:</strong> Click to automatically sync crew members from User Management. This will pull anyone with a position (captain/deckhand/tankerman/driver) and market set.</p>
              <p><strong>Manual Entry:</strong> You can also manually add crew members who don't have user accounts but need to appear in dispatch dropdowns.</p>
              <p><strong>Drivers:</strong> Driver information is also displayed here from the Drivers page for unified crew management.</p>
              <p><strong>Note:</strong> Crew members are visible to all users (including dispatchers) for assignment, while User Management is admin-only.</p>
            </div>
          </CardContent>
        </Card>

        {showForm && (
          <Card className="shadow-lg border-slate-200">
            <CardHeader className="border-b border-slate-100">
              <CardTitle className="text-2xl font-bold text-slate-900">
                {editingCrew ? 'Edit Crew Member' : 'Add Crew Member'}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="full_name">Full Name *</Label>
                    <Input
                      id="full_name"
                      value={formData.full_name}
                      onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Positions * (select all that apply)</Label>
                    <div className="flex flex-wrap gap-4 pt-2">
                      {['captain', 'deckhand', 'tankerman', 'driver'].map(p => (
                        <label key={p} className="flex items-center gap-2 capitalize cursor-pointer text-sm">
                          <Checkbox
                            checked={formData.positions.includes(p)}
                            onCheckedChange={(checked) => {
                              const positions = checked ? [...formData.positions, p] : formData.positions.filter(x => x !== p);
                              setFormData({ ...formData, positions, position: positions[0] || '' });
                            }}
                          />
                          {p}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="market">Market *</Label>
                    <Select
                      value={formData.market}
                      onValueChange={(value) => setFormData({...formData, market: value})}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select market" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Long Beach">Long Beach</SelectItem>
                        <SelectItem value="Oakland">Oakland</SelectItem>
                        <SelectItem value="Portland">Portland</SelectItem>
                        <SelectItem value="Seattle">Seattle</SelectItem>
                        <SelectItem value="Richmond CA">Richmond CA</SelectItem>
                        <SelectItem value="Rancho Dominguez">Rancho Dominguez</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    />
                  </div>

                  <div className="flex items-center space-x-2 pt-6">
                    <Checkbox
                      id="is_active"
                      checked={formData.is_active}
                      onCheckedChange={(checked) => setFormData({...formData, is_active: checked})}
                    />
                    <Label htmlFor="is_active" className="cursor-pointer">
                      Active (visible in dispatch dropdowns)
                    </Label>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancel
                  </Button>
                  <Button 
                    type="submit"
                    disabled={createMutation.isPending || updateMutation.isPending}
                    className="bg-gradient-to-r from-blue-600 to-blue-700"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {createMutation.isPending || updateMutation.isPending ? 'Saving...' : (editingCrew ? 'Update' : 'Add')} Crew Member
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <Card className="shadow-md border-slate-200">
          <CardHeader className="border-b border-slate-100">
            <CardTitle className="text-xl font-bold text-slate-900">
              Active Crew ({activeCrewMembers.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100">
              {activeCrewMembers.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No active crew members</p>
                  <p className="text-sm mt-2">Click "Sync from Users" or "Add Crew Member" to get started</p>
                </div>
              ) : (
                activeCrewMembers.map((crew) => (
                  <div
                    key={crew.id}
                    className="p-4 hover:bg-slate-50 transition-colors duration-200"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-bold text-xl text-slate-900">
                            {formatNameLastFirst(crew.full_name)}
                          </h3>
                          {crewPositions(crew).map(p => (
                            <Badge key={p} className={`${positionColors[p]} border capitalize`}>{p}</Badge>
                          ))}
                          <Badge className={`${marketColors[crew.market]} border`}>
                            {crew.market}
                          </Badge>
                        </div>
                        <div className="space-y-1 text-sm text-slate-600">
                          {crew.email && (
                            <div className="flex items-center gap-2">
                              <Mail className="w-4 h-4" />
                              <span>{crew.email}</span>
                            </div>
                          )}
                          {crew.phone && (
                            <div className="flex items-center gap-2">
                              <Phone className="w-4 h-4" />
                              <span>{crew.phone}</span>
                            </div>
                          )}
                          {crew.user_id && (
                            <div className="text-xs text-slate-500">
                              Linked to User Account
                            </div>
                          )}
                        </div>
                      </div>
                      {crew.source === 'crew' ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEdit(crew)}
                        >
                          <Edit2 className="w-4 h-4 mr-1" />
                          Edit
                        </Button>
                      ) : (
                        <Badge variant="outline" className="text-xs">
                          Manage in Drivers
                        </Badge>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {inactiveCrewMembers.length > 0 && (
          <Card className="shadow-md border-slate-200 bg-slate-50">
            <CardHeader className="border-b border-slate-100">
              <CardTitle className="text-xl font-bold text-slate-900">
                Inactive Crew ({inactiveCrewMembers.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-slate-100">
                {inactiveCrewMembers.map((crew) => (
                  <div
                    key={crew.id}
                    className="p-4 hover:bg-slate-100 transition-colors duration-200 opacity-60"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-bold text-lg text-slate-900">
                            {formatNameLastFirst(crew.full_name)}
                          </h3>
                          {crewPositions(crew).map(p => (
                            <Badge key={p} className={`${positionColors[p]} border capitalize`}>{p}</Badge>
                          ))}
                          <Badge className={`${marketColors[crew.market]} border`}>
                            {crew.market}
                          </Badge>
                          <Badge variant="outline" className="border-slate-400">
                            Inactive
                          </Badge>
                        </div>
                      </div>
                      {crew.source === 'crew' ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEdit(crew)}
                        >
                          <Edit2 className="w-4 h-4 mr-1" />
                          Edit
                        </Button>
                      ) : (
                        <Badge variant="outline" className="text-xs">
                          Manage in Drivers
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}