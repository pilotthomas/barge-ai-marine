import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, ChevronLeft, ChevronRight, MapPin, Ship } from "lucide-react";
import {
  startOfWeek,
  addDays,
  format,
  isSameDay
} from "date-fns";
import { crewAvailableForMarket } from "@/lib/regions";

// Helper function to capitalize names - handles periods, underscores, and spaces
const capitalizeName = (name) => {
  if (!name) return '';
  return name
    .replace(/[._]/g, ' ')
    .split(' ')
    .filter(word => word.length > 0)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

export default function Crewing() {
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date()));
  const [selectedMarket, setSelectedMarket] = useState('all');

  // Pull from CrewMember entity (managed in Crew Management page)
  const { data: crewMembers = [] } = useQuery({
    queryKey: ['crew-members'],
    queryFn: () => base44.entities.CrewMember.filter({ is_active: true }),
  });

  const { data: deliveries = [] } = useQuery({
    queryKey: ['dispatches'],
    queryFn: () => base44.entities.Dispatch.list('-start_date'),
  });

  // Filter crew members by selected market
  const crew = selectedMarket === 'all' 
    ? crewMembers 
    : crewMembers.filter(c => crewAvailableForMarket(c.market, selectedMarket));

  // Group crew by position
  const crewByPosition = {
    captain: crew.filter(c => c.position === 'captain'),
    deckhand: crew.filter(c => c.position === 'deckhand'),
    tankerman: crew.filter(c => c.position === 'tankerman')
  };

  // Get 7 days for week view
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));

  // Get deliveries for a crew member on a specific day
  const getCrewDeliveriesForDay = (crewMember, day) => {
    const dayStr = format(day, 'yyyy-MM-dd');
    const crewName = capitalizeName(crewMember.full_name);
    
    return deliveries.filter(d => {
      if (!d.start_date) return false;
      
      // Use string comparison to avoid date parsing issues
      const deliveryDateStr = d.start_date.substring(0, 10);
      if (deliveryDateStr !== dayStr) return false;
      
      if (d.status === 'cancelled') return false;
      
      // Check if crew member is assigned to this delivery (compare capitalized names)
      return d.captain === crewName ||
             d.deckhand === crewName ||
             d.tankerman === crewName ||
             d.crew_members?.includes(crewName);
    });
  };

  const handlePreviousWeek = () => {
    setCurrentWeekStart(addDays(currentWeekStart, -7));
  };

  const handleNextWeek = () => {
    setCurrentWeekStart(addDays(currentWeekStart, 7));
  };

  const handleToday = () => {
    setCurrentWeekStart(startOfWeek(new Date()));
  };

  return (
    <div className="p-4 md:p-8 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">
            Crew Management
          </h1>
          <p className="text-slate-600">Manage crew assignments and availability</p>
        </div>

        <Tabs defaultValue="roster" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="roster">Crew Roster</TabsTrigger>
            <TabsTrigger value="schedule">Weekly Schedule</TabsTrigger>
          </TabsList>

          <TabsContent value="roster" className="space-y-6">
            {Object.entries(crewByPosition).map(([position, members]) => (
              <Card key={position} className="shadow-md border-slate-200">
                <CardHeader className="border-b border-slate-100">
                  <CardTitle className="text-xl font-bold text-slate-900 capitalize flex items-center gap-2">
                    <Users className="w-5 h-5 text-blue-600" />
                    {position}s ({members.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {members.length === 0 ? (
                    <div className="p-8 text-center text-slate-500">
                      <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p>No {position}s registered</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {members.map(crewMember => {
                        const crewName = capitalizeName(crewMember.full_name);
                        const upcomingDeliveries = deliveries.filter(d => {
                          if (d.status === 'cancelled') return false;
                          if (!d.start_date) return false;

                          try {
                            const today = new Date().toISOString().substring(0, 10);
                            const deliveryDate = d.start_date.substring(0, 10);
                            if (deliveryDate < today) return false;
                          } catch (e) {
                            console.error('Error comparing delivery date:', d.start_date, e);
                            return false;
                          }

                          return d.captain === crewName ||
                                 d.deckhand === crewName ||
                                 d.tankerman === crewName ||
                                 d.crew_members?.includes(crewName);
                        }).length;

                        return (
                          <div key={crewMember.id} className="p-4 hover:bg-slate-50 transition-colors">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-gradient-to-br from-sky-500 to-blue-600 rounded-full flex items-center justify-center shadow-md">
                                  <span className="text-white font-semibold text-lg">
                                    {crewMember.full_name?.charAt(0)?.toUpperCase() || 'U'}
                                  </span>
                                </div>
                                <div>
                                  <h4 className="font-bold text-slate-900">{capitalizeName(crewMember.full_name)}</h4>
                                  <p className="text-sm text-slate-600">{crewMember.email}</p>
                                  {crewMember.phone && (
                                    <p className="text-sm text-slate-500">{crewMember.phone}</p>
                                  )}
                                </div>
                              </div>
                              <div className="text-right space-y-2">
                                {crewMember.market && (
                                  <div className="flex items-center justify-end gap-1 text-sm text-slate-600">
                                    <MapPin className="w-4 h-4" />
                                    <span>{crewMember.market}</span>
                                  </div>
                                )}
                                {upcomingDeliveries > 0 && (
                                  <Badge variant="outline" className="text-xs">
                                    {upcomingDeliveries} upcoming {upcomingDeliveries === 1 ? 'delivery' : 'deliveries'}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="schedule" className="space-y-6">
            <Card className="shadow-md border-slate-200">
              <CardHeader className="border-b border-slate-100">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <CardTitle className="text-2xl font-bold text-slate-900">
                    Week of {format(currentWeekStart, 'MMM d')} - {format(addDays(currentWeekStart, 6), 'MMM d, yyyy')}
                  </CardTitle>
                  <div className="flex gap-2 flex-wrap">
                    <Select value={selectedMarket} onValueChange={setSelectedMarket}>
                      <SelectTrigger className="w-48">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4" />
                          <SelectValue placeholder="All Markets" />
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Markets</SelectItem>
                        <SelectItem value="Long Beach">Long Beach</SelectItem>
                        <SelectItem value="Oakland">Oakland</SelectItem>
                        <SelectItem value="Portland">Portland</SelectItem>
                        <SelectItem value="Seattle">Seattle</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="outline" size="sm" onClick={handleToday}>
                      Today
                    </Button>
                    <Button variant="outline" size="icon" onClick={handlePreviousWeek}>
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={handleNextWeek}>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 overflow-x-auto">
                {crew.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    <Users className="w-16 h-16 mx-auto mb-4 opacity-30" />
                    <p className="text-lg font-medium">No crew members to display</p>
                  </div>
                ) : (
                  <div className="space-y-8">
                    {['captain', 'tankerman', 'deckhand'].map(position => {
                      const positionCrew = crewByPosition[position] || [];
                      if (positionCrew.length === 0) return null;

                      return (
                        <div key={position} className="border-2 border-slate-300 rounded-lg overflow-hidden">
                          <div className="bg-gradient-to-r from-slate-700 to-slate-800 text-white px-4 py-3">
                            <h3 className="text-lg font-bold flex items-center gap-2 capitalize">
                              <Users className="w-5 h-5" />
                              {position}s
                            </h3>
                          </div>

                          <div className="overflow-x-auto">
                            <table className="w-full border-collapse">
                              <thead>
                                <tr className="bg-slate-100">
                                  <th className="border border-slate-300 px-3 py-2 text-left text-sm font-bold text-slate-700 w-48 bg-slate-50">
                                    CREW MEMBER
                                  </th>
                                  {weekDays.map((day, dayIndex) => (
                                    <th
                                      key={format(day, 'yyyy-MM-dd')}
                                      className={`border border-slate-300 px-3 py-2 text-center text-sm font-bold ${
                                        isSameDay(day, new Date())
                                          ? 'bg-blue-100 text-blue-900'
                                          : dayIndex % 2 === 0
                                          ? 'bg-slate-100 text-slate-700'
                                          : 'bg-white text-slate-700'
                                      }`}
                                    >
                                      <div>{format(day, 'EEE')}</div>
                                      <div className="text-xs font-semibold">{format(day, 'M/d')}</div>
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {positionCrew.map(crewMember => (
                                  <tr key={crewMember.id}>
                                    <td className="border border-slate-300 px-3 py-2 bg-slate-50">
                                      <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 bg-gradient-to-br from-sky-500 to-blue-600 rounded-full flex items-center justify-center shadow-sm">
                                          <span className="text-white font-semibold text-xs">
                                            {crewMember.full_name?.charAt(0)?.toUpperCase() || 'U'}
                                          </span>
                                        </div>
                                        <div>
                                          <div className="font-bold text-sm text-slate-900">{capitalizeName(crewMember.full_name)}</div>
                                          {crewMember.market && (
                                            <div className="text-xs text-slate-500">{crewMember.market}</div>
                                          )}
                                        </div>
                                      </div>
                                    </td>
                                    {weekDays.map((day, dayIndex) => {
                                      const dayDeliveries = getCrewDeliveriesForDay(crewMember, day);
                                      const baseColor = isSameDay(day, new Date())
                                        ? 'bg-blue-50'
                                        : dayIndex % 2 === 0
                                        ? 'bg-slate-50'
                                        : 'bg-white';

                                      return (
                                        <td
                                          key={format(day, 'yyyy-MM-dd')}
                                          className={`border border-slate-300 px-2 py-2 text-xs ${
                                            dayDeliveries.length > 0 ? 'bg-emerald-50' : baseColor
                                          }`}
                                        >
                                          {dayDeliveries.length > 0 ? (
                                            <div className="space-y-1">
                                              {dayDeliveries.map(delivery => (
                                                <div key={delivery.id} className="p-1 bg-white rounded border border-emerald-200">
                                                  <div className="font-bold text-emerald-900 flex items-center gap-1">
                                                    <Ship className="w-3 h-3" />
                                                    {delivery.vessel_name}
                                                  </div>
                                                  {delivery.requested_delivery_time && (
                                                    <div className="text-emerald-700 font-semibold">{delivery.requested_delivery_time}</div>
                                                  )}
                                                  <div className="text-slate-600">{delivery.barge_name}</div>
                                                  <div className="text-slate-500">→ {delivery.destination}</div>
                                                </div>
                                              ))}
                                            </div>
                                          ) : (
                                            <div className="text-center text-slate-400">—</div>
                                          )}
                                        </td>
                                      );
                                    })}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Card className="shadow-md border-slate-200 bg-blue-50">
          <CardContent className="p-6">
            <h3 className="font-semibold text-slate-900 mb-3">Crew Management Tips:</h3>
            <ul className="text-sm text-slate-700 space-y-2">
              <li>• Add or sync crew members in <strong>Settings → Crew Management</strong></li>
              <li>• Crew members are assigned to deliveries through the Dispatch page</li>
              <li>• Green cells in the calendar indicate scheduled deliveries for that crew member</li>
              <li>• Crew names must match exactly between Crew Management and Dispatch assignments</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}