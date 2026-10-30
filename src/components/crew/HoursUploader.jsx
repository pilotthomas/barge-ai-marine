import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, Loader2, FileSpreadsheet } from "lucide-react";
import { format, subDays, addDays } from "date-fns";

// The Workday report columns run Wednesday → Tuesday (prior 7 days)
const DAY_ORDER = ["wednesday", "thursday", "friday", "saturday", "sunday", "monday", "tuesday"];

// Default: most recent Tuesday on or before yesterday
const defaultWeekEnd = () => {
  let d = subDays(new Date(), 1);
  while (d.getDay() !== 2) d = subDays(d, 1);
  return format(d, "yyyy-MM-dd");
};

export default function HoursUploader({ onUploaded }) {
  const [weekEndDate, setWeekEndDate] = useState(defaultWeekEnd());
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const fileRef = useRef(null);

  const handleFile = async (file) => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url,
        json_schema: {
          type: "object",
          properties: {
            employee_id: { type: "string", description: "Employee ID" },
            worker: { type: "string", description: "Worker" },
            job_code: { type: "string", description: "Job Code" },
            wednesday: { type: "number", description: "Wednesday" },
            thursday: { type: "number", description: "Thursday" },
            friday: { type: "number", description: "Friday" },
            saturday: { type: "number", description: "Saturday" },
            sunday: { type: "number", description: "Sunday" },
            monday: { type: "number", description: "Monday" },
            tuesday: { type: "number", description: "Tuesday" },
            total_hours: { type: "number", description: "Total Hours Worked for Prior 7 Days" },
            total_days: { type: "number", description: "Total Days Worked for Prior 7 Days" },
            overtime: { type: "number", description: "Pay Period Overtime" },
            location: { type: "string", description: "Location" },
            region: { type: "string", description: "Region" },
            manager: { type: "string", description: "Worker's Manager" },
          },
        },
      });

      if (result.status !== "success") throw new Error(result.details || "Could not read file");
      const rows = Array.isArray(result.output) ? result.output : [result.output];
      if (rows.length === 0) throw new Error("No worker rows found in the file");

      // Map day columns to real dates: week ends Tuesday = weekEndDate
      const weekEnd = new Date(weekEndDate + "T12:00:00");
      const weekStart = subDays(weekEnd, 6); // Wednesday

      const records = rows
        .filter((r) => r && r.worker)
        .map((r) => ({
          employee_id: String(r.employee_id || ""),
          worker_name: String(r.worker).replace(/\s*\(\d+\)\s*$/, "").trim(),
          job_code: r.job_code || "",
          location: r.location || "",
          region: r.region || "",
          manager: r.manager ? String(r.manager).replace(/\s*\(\d+\)\s*$/, "").trim() : "",
          week_end_date: weekEndDate,
          daily_hours: DAY_ORDER.map((dayKey, i) => ({
            date: format(addDays(weekStart, i), "yyyy-MM-dd"),
            day_name: dayKey.charAt(0).toUpperCase() + dayKey.slice(1),
            hours: Number(r[dayKey]) || 0,
          })),
          total_hours: Number(r.total_hours) || 0,
          total_days: Number(r.total_days) || 0,
          overtime: Number(r.overtime) || 0,
        }));

      // Latest upload replaces all previous data (daily snapshot)
      const existing = await base44.entities.CrewWeeklyHours.list();
      if (existing.length > 0) {
        await base44.entities.CrewWeeklyHours.deleteMany({});
      }
      await base44.entities.CrewWeeklyHours.bulkCreate(records);
      onUploaded?.();
    } catch (e) {
      setError(e.message || "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <Card className="shadow-md border-slate-200">
      <CardContent className="p-4">
        <div className="flex flex-col md:flex-row md:items-end gap-4">
          <div className="flex items-center gap-3 flex-1">
            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <div className="font-semibold text-slate-900 text-sm">Upload Workday Hours Report</div>
              <div className="text-xs text-slate-500">
                PTL Weekly Hours by Roster (.xlsx) — replaces the previous upload
              </div>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 items-end">
            <div>
              <Label htmlFor="week-end" className="text-xs text-slate-600">
                Report week ending (Tuesday)
              </Label>
              <Input
                id="week-end"
                type="date"
                value={weekEndDate}
                onChange={(e) => setWeekEndDate(e.target.value)}
                className="w-40"
              />
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
            <Button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" /> Upload Report
                </>
              )}
            </Button>
          </div>
        </div>
        {error && <div className="mt-3 text-sm text-red-600">{error}</div>}
      </CardContent>
    </Card>
  );
}