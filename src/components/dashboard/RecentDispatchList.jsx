
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Ship, MapPin, Calendar, Anchor, Users, Waves } from "lucide-react";
import { format, parseISO } from "date-fns";

const statusColors = {
  scheduled: "bg-blue-100 text-blue-800 border-blue-200",
  in_transit: "bg-orange-100 text-orange-800 border-orange-200",
  delivered: "bg-emerald-100 text-emerald-800 border-emerald-200",
  cancelled: "bg-slate-100 text-slate-800 border-slate-200"
};

export default function RecentDispatchList({ dispatches, onDispatchClick }) {
  const getCrewList = (dispatch) => {
    const crew = [];
    if (dispatch.captain) crew.push(dispatch.captain);
    if (dispatch.deckhand) crew.push(dispatch.deckhand);
    if (dispatch.tankerman) crew.push(dispatch.tankerman);
    if (dispatch.crew_members?.length) crew.push(...dispatch.crew_members);
    return crew;
  };

  const formatStatus = (status) => {
    return status
      .replace(/_/g, ' ') // Use regex with global flag to replace all underscores
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    try {
      return format(parseISO(dateString), 'MMM d, yyyy');
    } catch (e) {
      console.error('Error formatting date:', dateString, e);
      return dateString;
    }
  };

  return (
    <Card className="shadow-md border-slate-200">
      <CardHeader className="border-b border-slate-100 pb-4">
        <CardTitle className="text-xl font-bold text-slate-900">Recent Deliveries</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-slate-100">
          {dispatches.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              <Ship className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No deliveries yet</p>
            </div>
          ) : (
            dispatches.map((dispatch) => {
              const crewList = getCrewList(dispatch);
              const isDelivered = dispatch.status === 'delivered';
              const missingPaperwork = isDelivered && !dispatch.paperwork_sent_to_billing;
              const missingSage = isDelivered && !dispatch.entered_in_sage;
              
              return (
                <div
                  key={dispatch.id}
                  onClick={() => onDispatchClick?.(dispatch)}
                  className="p-4 hover:bg-slate-50 cursor-pointer transition-colors duration-200"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Anchor className="w-5 h-5 text-blue-600" />
                        <h4 className="font-bold text-lg text-slate-900">{dispatch.vessel_name}</h4>
                        <Badge className={`${statusColors[dispatch.status]} border text-xs`}>
                          {formatStatus(dispatch.status)}
                        </Badge>
                        {dispatch.is_outside_tow && (
                          <Badge className="bg-cyan-100 text-cyan-800 border-cyan-200 text-xs flex items-center gap-1">
                            <Waves className="w-3 h-3" />
                            Outside Tow
                          </Badge>
                        )}
                      </div>
                      <div className="space-y-1 ml-8 text-sm text-slate-600">
                        <div className="text-slate-500 uppercase">{dispatch.barge_name}</div>
                        {dispatch.tug_name && (
                          <div className="flex items-center gap-2">
                            <Ship className="w-4 h-4" />
                            <span>
                              Tug: {dispatch.tug_name}
                              {dispatch.is_third_party_towing && (
                                <span className="ml-1 text-purple-600 font-medium">(3rd Party)</span>
                              )}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4" />
                          <span>→ {dispatch.destination}</span>
                        </div>
                        {dispatch.start_date && (
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            <span className="font-bold">
                              {formatDate(dispatch.start_date)}
                            </span>
                          </div>
                        )}
                        {dispatch.sage_order_number && (
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-purple-700">Sage Order #:</span>
                            <span className="font-mono text-purple-900">{dispatch.sage_order_number}</span>
                          </div>
                        )}
                        {crewList.length > 0 && (
                          <div className="flex items-start gap-2 pt-1">
                            <Users className="w-4 h-4 mt-0.5" />
                            <div>
                              <span className="font-medium text-slate-700">Crew: </span>
                              <span className="text-slate-600">{crewList.join(', ')}</span>
                            </div>
                          </div>
                        )}
                        {(missingSage || missingPaperwork) && (
                          <div className="flex flex-wrap gap-2 pt-2">
                            {missingPaperwork && (
                              <Badge className="bg-red-100 text-red-800 border-red-200 text-xs">
                                Missing: Paperwork to Billing
                              </Badge>
                            )}
                            {missingSage && (
                              <Badge className="bg-purple-100 text-purple-800 border-purple-200 text-xs">
                                Missing: Sage Entry
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    {dispatch.gallons_delivered && (
                      <div className="text-right">
                        <p className="text-2xl font-bold text-slate-900">
                          {dispatch.gallons_delivered.toLocaleString()}
                        </p>
                        <p className="text-xs text-slate-500 uppercase">Gallons</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
