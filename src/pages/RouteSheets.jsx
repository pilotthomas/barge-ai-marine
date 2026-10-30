import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Printer } from "lucide-react";
import { format } from "date-fns";

export default function RouteSheets() {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedMarket, setSelectedMarket] = useState("Richmond CA");
  const [selectedDriver, setSelectedDriver] = useState("all");

  const { data: dispatches = [] } = useQuery({
    queryKey: ['truckDispatches'],
    queryFn: () => base44.entities.TruckDispatch.list(),
  });

  const filteredDispatches = dispatches.filter(d => 
    d.dispatch_date === selectedDate && 
    d.market === selectedMarket &&
    d.status !== 'cancelled'
  );

  // Get unique drivers from filtered dispatches
  const uniqueDrivers = [...new Set(filteredDispatches.map(d => d.driver_name || 'Unassigned'))].sort();

  const groupedByDriver = filteredDispatches.reduce((acc, dispatch) => {
    const driver = dispatch.driver_name || 'Unassigned';
    if (!acc[driver]) acc[driver] = [];
    acc[driver].push(dispatch);
    return acc;
  }, {});

  const handlePrint = () => {
    window.print();
  };

  const RouteSheetCard = ({ title, dispatches }) => {
    const totalGallons = dispatches.reduce((sum, d) => sum + (parseFloat(d.gallons) || 0), 0);

    return (
      <div className="mb-6">
        {/* Driver Header */}
        <div className="bg-gray-100 print:bg-white border-2 border-black p-4 mb-4">
          <div className="flex justify-between items-center">
            <div className="font-bold text-xl">{title}</div>
            <div className="text-base">
              {dispatches.length} deliveries | {totalGallons.toLocaleString()} gal total
            </div>
          </div>
        </div>

        {/* Stops */}
        <div className="space-y-4">
          {dispatches.map((dispatch, index) => (
            <div 
              key={dispatch.id} 
              className="border-2 border-gray-300 print:border-black p-4 bg-white page-break-inside-avoid"
            >
              <div className="flex justify-between items-center mb-3 pb-2 border-b-2 border-gray-300 print:border-black">
                <div className="font-bold text-lg">
                  Stop #{index + 1}: {dispatch.customer_name}
                </div>
                <div className="font-bold text-lg">
                  {dispatch.gallons?.toLocaleString() || 0} gal
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm mb-3">
                <div>
                  <span className="font-semibold">Product:</span> {dispatch.product}
                </div>
                <div>
                  <span className="font-semibold">Truck Type:</span> {dispatch.truck_type}
                </div>
                <div>
                  <span className="font-semibold">Delivery Type:</span> {dispatch.delivery_type}
                </div>
                <div>
                  <span className="font-semibold">SO#:</span> {dispatch.so_number || 'N/A'}
                </div>
                <div>
                  <span className="font-semibold">BOL#:</span> {dispatch.bol_number || 'N/A'}
                </div>
                <div>
                  <span className="font-semibold">Status:</span> <span className="capitalize">{dispatch.status}</span>
                </div>
                {dispatch.notes && (
                  <div className="col-span-2 mt-1">
                    <span className="font-semibold">Notes:</span> {dispatch.notes}
                  </div>
                )}
              </div>
              
              <div className="mt-3 pt-2 border-t border-gray-300 print:border-black">
                <div className="text-sm">
                  DRIVER SIGNATURE: _________________________________
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen p-6 print:bg-white">
      <div className="max-w-7xl mx-auto print:max-w-full">
        <div className="flex items-center justify-between mb-6 print:hidden">
          <h1 className="text-3xl font-bold text-gray-900">Route Sheets</h1>
          <Button onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-2" />
            Print Route Sheets
          </Button>
        </div>

        <Card className="mb-6 print:hidden">
          <CardContent className="p-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Date</Label>
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                />
              </div>
              <div>
                <Label>Market</Label>
                <Select value={selectedMarket} onValueChange={setSelectedMarket}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Richmond CA">Richmond CA</SelectItem>
                    <SelectItem value="Rancho Dominguez">Rancho Dominguez</SelectItem>
                    <SelectItem value="Seattle">Seattle</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Driver</Label>
                <Select value={selectedDriver} onValueChange={setSelectedDriver}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Drivers</SelectItem>
                    {uniqueDrivers.map(driver => (
                      <SelectItem key={driver} value={driver}>{driver}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Print Page Header - appears once at top */}
        <div className="hidden print:block text-center mb-4 pb-3 border-b-2 border-black">
          <h1 className="text-2xl font-bold">Daily Route Sheet</h1>
          <p className="text-lg mt-1">{selectedMarket} - {format(new Date(selectedDate), 'EEEE, MMMM d, yyyy')}</p>
        </div>

        {filteredDispatches.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No dispatches scheduled for the selected date and market.</p>
            </CardContent>
          </Card>
        ) : (
          <div>
            {selectedDriver === 'all' ? (
              Object.entries(groupedByDriver).map(([driver, driverDispatches], index) => (
                <div key={driver} className={index > 0 ? "page-break-before" : ""}>
                  <RouteSheetCard
                    title={`Driver: ${driver}`}
                    dispatches={driverDispatches}
                  />
                </div>
              ))
            ) : (
              <RouteSheetCard
                title={`Driver: ${selectedDriver}`}
                dispatches={groupedByDriver[selectedDriver] || []}
              />
            )}
          </div>
        )}
      </div>

      <style>{`
        @media print {
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          @page {
            margin: 0.5in;
            size: letter;
          }
          .page-break-before {
            page-break-before: always;
            break-before: page;
          }
          
          /* Ensure each stop block stays together */
          .page-break-inside-avoid {
            page-break-inside: avoid;
            break-inside: avoid;
          }
        }
      `}</style>
    </div>
  );
}