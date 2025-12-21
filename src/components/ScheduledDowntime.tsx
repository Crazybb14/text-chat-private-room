import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Clock, Power, Calendar, AlertTriangle, Repeat } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import db from "@/lib/shared/kliv-database.js";

interface DowntimeSchedule {
  _row_id?: number;
  is_active: boolean;
  start_time: number;
  end_time: number;
  reason: string;
  message: string;
  schedule_type?: string;
  recurrence_days?: string;
  recurrence_end?: number;
  custom_dates?: string;
}

const ScheduledDowntime = () => {
  const { toast } = useToast();
  const [isActive, setIsActive] = useState(false);
  const [startTime, setStartTime] = useState("");
  const [durationHours, setDurationHours] = useState("1");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("We're performing scheduled maintenance. We'll be back soon!");
  const [schedules, setSchedules] = useState<DowntimeSchedule[]>([]);
  const [recurrenceType, setRecurrenceType] = useState<"one-time" | "daily" | "weekly" | "custom">("one-time");
  const [customDates, setCustomDates] = useState<string[]>([]);
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [endDate, setEndDate] = useState<string>("");

  const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  
  useEffect(() => {
    loadSchedules();
  }, []);

  const loadSchedules = async () => {
    try {
      const data = await db.query("downtime_schedules", { order: "_created_at.desc" });
      setSchedules(data);
    } catch (error) {
      console.error("Error loading downtime schedules:", error);
    }
  };

  const handleScheduleDowntime = async () => {
    if (!startTime || !durationHours || !reason) {
      toast({
        title: "Missing Information",
        description: "Please fill in start time, duration, and reason",
        variant: "destructive",
      });
      return;
    }

    const hours = parseFloat(durationHours);
    if (isNaN(hours) || hours <= 0) {
      toast({
        title: "Invalid Duration",
        description: "Please enter a valid number of hours",
        variant: "destructive",
      });
      return;
    }

    // Validate recurrence settings
    if (recurrenceType === "weekly" && selectedDays.length === 0) {
      toast({
        title: "Missing Days",
        description: "Please select at least one day for weekly recurrence",
        variant: "destructive",
      });
      return;
    }

    if ((recurrenceType === "daily" || recurrenceType === "weekly") && !endDate) {
      toast({
        title: "Missing End Date",
        description: "Please specify when the recurrence should end",
        variant: "destructive",
      });
      return;
    }

    const start = new Date(startTime).getTime();
    const end = start + (hours * 3600 * 1000);

    try {
      const scheduleData = {
        is_active: true,
        start_time: start,
        end_time: end,
        reason,
        message,
        schedule_type: recurrenceType,
        recurrence_days: selectedDays.join(","),
        recurrence_end: endDate ? new Date(endDate).getTime() : null,
        custom_dates: customDates.join(",")
      };

      await db.insert("downtime_schedules", scheduleData);

      toast({
        title: "Downtime Scheduled",
        description: `Maintenance scheduled with ${recurrenceType} recurrence`,
      });
      
      // Reset form
      setStartTime("");
      setDurationHours("1");
      setReason("");
      setMessage("We're performing scheduled maintenance. We'll be back soon!");
      setRecurrenceType("one-time");
      setSelectedDays([]);
      setEndDate("");
      setCustomDates([]);
      loadSchedules();
    } catch (error) {
      console.error("Error scheduling downtime:", error);
      toast({
        title: "Error",
        description: "Failed to schedule downtime",
        variant: "destructive",
      });
    }
  };

  const handleActivateNow = async () => {
    const now = Date.now();
    const oneHour = now + (3600 * 1000);

    try {
      await db.insert("downtime_schedules", {
        is_active: true,
        start_time: now,
        end_time: oneHour,
        reason: "Immediate maintenance",
        message: "System is currently under maintenance. We'll be back soon!",
      });

      localStorage.setItem('scheduled_downtime', JSON.stringify({
        isActive: true,
        startTime: now,
        endTime: oneHour,
        reason: "Immediate maintenance",
        message: "System is currently under maintenance. We'll be back soon!",
      }));

      toast({
        title: "Downtime Activated",
        description: "System is now in maintenance mode for 1 hour",
      });

      loadSchedules();
    } catch (error) {
      console.error("Error activating downtime:", error);
    }
  };

  const handleDeactivate = async (id: number) => {
    try {
      await db.update("downtime_schedules", { _row_id: `eq.${id}` }, { is_active: false });
      localStorage.removeItem('scheduled_downtime');
      
      toast({
        title: "Downtime Cancelled",
        description: "System is now accessible to users",
      });

      loadSchedules();
    } catch (error) {
      console.error("Error deactivating downtime:", error);
    }
  };

  const isCurrentlyDown = () => {
    const now = Date.now();
    return schedules.some(s => s.is_active && s.start_time <= now && s.end_time > now);
  };

  return (
    <div className="space-y-6">
      <Card className="glass-morphism border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-orange-400" />
            Scheduled Downtime
          </CardTitle>
          <CardDescription>
            Schedule maintenance windows when users won't be able to access the system
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isCurrentlyDown() && (
            <Alert className="bg-red-500/10 border-red-500/30">
              <AlertTriangle className="h-4 w-4 text-red-400" />
              <AlertDescription className="text-red-300">
                System is currently in maintenance mode
              </AlertDescription>
            </Alert>
          )}

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="start">Start Time</Label>
              <Input
                id="start"
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="bg-secondary/50 border-white/10"
              />
            </div>
            <div>
              <Label htmlFor="duration">Duration (Hours)</Label>
              <Input
                id="duration"
                type="number"
                min="0.5"
                step="0.5"
                value={durationHours}
                onChange={(e) => setDurationHours(e.target.value)}
                placeholder="e.g., 5"
                className="bg-secondary/50 border-white/10"
              />
            </div>
          </div>

          {/* Recurrence Settings */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="recurrence">Recurrence Type</Label>
              <Select value={recurrenceType} onValueChange={(value: "one-time" | "daily" | "weekly" | "custom") => setRecurrenceType(value)}>
                <SelectTrigger className="bg-secondary/50 border-white/10">
                  <SelectValue placeholder="Select recurrence type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="one-time">One Time Only</SelectItem>
                  <SelectItem value="daily">Every Day</SelectItem>
                  <SelectItem value="weekly">On Specific Days</SelectItem>
                  <SelectItem value="custom">Custom Dates</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Daily Recurrence Settings */}
            {recurrenceType === "daily" && (
              <div className="space-y-2">
                <Label htmlFor="endDate">Repeat Until</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="bg-secondary/50 border-white/10"
                />
                <p className="text-sm text-gray-400">Maintenance will occur every day at the specified time until this date</p>
              </div>
            )}

            {/* Weekly Recurrence Settings */}
            {recurrenceType === "weekly" && (
              <div className="space-y-4">
                <div>
                  <Label>Repeat On These Days</Label>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, index) => (
                      <div key={day} className="flex items-center space-x-2">
                        <Checkbox
                          id={day}
                          checked={selectedDays.includes((index).toString())}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedDays([...selectedDays, index.toString()]);
                            } else {
                              setSelectedDays(selectedDays.filter(d => d !== index.toString()));
                            }
                          }}
                        />
                        <Label htmlFor={day} className="text-sm">{day}</Label>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <Label htmlFor="weeklyEndDate">Repeat Until</Label>
                  <Input
                    id="weeklyEndDate"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="bg-secondary/50 border-white/10"
                  />
                </div>
                <p className="text-sm text-gray-400">Maintenance will occur on selected days at the specified time</p>
              </div>
            )}

            {/* Custom Dates Settings */}
            {recurrenceType === "custom" && (
              <div className="space-y-2">
                <Label htmlFor="customDates">Select Specific Dates</Label>
                <Input
                  id="customDates"
                  type="date"
                  multiple
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    setCustomDates(files.map(f => f.name));
                  }}
                  className="bg-secondary/50 border-white/10"
                />
                <p className="text-sm text-gray-400">Hold Ctrl/Cmd to select multiple dates</p>
                {customDates.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {customDates.map((date, index) => (
                      <Badge key={index} variant="secondary">
                        {date}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="reason">Reason (Internal)</Label>
            <Input
              id="reason"
              placeholder="e.g., Database migration, server upgrade"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="bg-secondary/50 border-white/10"
            />
          </div>

          <div>
            <Label htmlFor="message">User Message</Label>
            <Textarea
              id="message"
              placeholder="Message shown to users during downtime"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="bg-secondary/50 border-white/10"
              rows={3}
            />
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleScheduleDowntime}
              className="flex-1 bg-orange-600 hover:bg-orange-700"
            >
              <Calendar className="w-4 h-4 mr-2" />
              Schedule Downtime
            </Button>
            <Button
              onClick={handleActivateNow}
              variant="destructive"
              className="flex-1"
            >
              <Power className="w-4 h-4 mr-2" />
              Activate Now (1hr)
            </Button>
          </div>

          {/* Recurrence Settings */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="recurrence">Recurrence Type</Label>
              <Select value={recurrenceType} onValueChange={(value: "one-time" | "daily" | "weekly" | "custom") => setRecurrenceType(value)}>
                <SelectTrigger className="bg-secondary/50 border-white/10">
                  <SelectValue placeholder="Select recurrence type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="one-time">One Time Only</SelectItem>
                  <SelectItem value="daily">Every Day</SelectItem>
                  <SelectItem value="weekly">On Specific Days</SelectItem>
                  <SelectItem value="custom">Custom Dates</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Daily Recurrence Settings */}
            {recurrenceType === "daily" && (
              <div className="space-y-2">
                <Label htmlFor="endDate">Repeat Until</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="bg-secondary/50 border-white/10"
                />
                <p className="text-sm text-gray-400">Maintenance will occur every day at the specified time until this date</p>
              </div>
            )}

            {/* Weekly Recurrence Settings */}
            {recurrenceType === "weekly" && (
              <div className="space-y-4">
                <div>
                  <Label>Repeat On These Days</Label>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, index) => (
                      <div key={day} className="flex items-center space-x-2">
                        <Checkbox
                          id={day}
                          checked={selectedDays.includes(index.toString())}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedDays([...selectedDays, index.toString()]);
                            } else {
                              setSelectedDays(selectedDays.filter(d => d !== index.toString()));
                            }
                          }}
                        />
                        <Label htmlFor={day} className="text-sm">{day}</Label>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <Label htmlFor="weeklyEndDate">Repeat Until</Label>
                  <Input
                    id="weeklyEndDate"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="bg-secondary/50 border-white/10"
                  />
                </div>
                <p className="text-sm text-gray-400">Maintenance will occur on selected days at the specified time</p>
              </div>
            )}

            {/* Custom Dates Settings */}
            {recurrenceType === "custom" && (
              <div className="space-y-2">
                <Label htmlFor="customDates">Select Specific Dates</Label>
                <Input
                  id="customDates"
                  type="date"
                  multiple
                  onChange={(e) => {
                    const input = e.target as HTMLInputElement;
                    if (input.files) {
                      const dates = Array.from(input.files).map(f => new Date(f.name || input.value).toLocaleDateString());
                      setCustomDates(dates);
                    }
                  }}
                  className="bg-secondary/50 border-white/10"
                />
                <p className="text-sm text-gray-400">Hold Ctrl/Cmd to select multiple dates</p>
                {customDates.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {customDates.map((date, index) => (
                      <Badge key={index} variant="secondary">
                        {date}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="glass-morphism border-white/10">
        <CardHeader>
          <CardTitle>Scheduled Downtimes</CardTitle>
        </CardHeader>
        <CardContent>
          {schedules.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No scheduled downtimes</p>
          ) : (
            <div className="space-y-3">
              {schedules.map((schedule) => {
                const now = Date.now();
                const isActive = schedule.is_active && schedule.start_time <= now && schedule.end_time > now;
                const isPast = schedule.end_time < now;
                const isFuture = schedule.start_time > now;

                return (
                  <div
                    key={schedule._row_id}
                    className="flex items-center justify-between p-4 rounded-lg bg-secondary/50 border border-white/10"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium">{schedule.reason}</p>
                        {isActive && (
                          <Badge variant="destructive" className="animate-pulse">
                            ACTIVE NOW
                          </Badge>
                        )}
                        {isFuture && <Badge variant="secondary">Scheduled</Badge>}
                        {isPast && <Badge variant="outline">Completed</Badge>}
                        {schedule.schedule_type && schedule.schedule_type !== "one-time" && (
                          <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30">
                            <Repeat className="w-3 h-3 mr-1" />
                            {(schedule as any).schedule_type}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {new Date(schedule.start_time).toLocaleString()} → {new Date(schedule.end_time).toLocaleString()}
                      </p>
                      
                      {/* Show recurrence details */}
                      {(schedule as any).schedule_type === "daily" && (
                        <div className="text-purple-400 text-sm">
                          <Repeat className="w-3 h-3 inline mr-1" />
                          Daily until {new Date((schedule as any).recurrence_end).toLocaleDateString()}
                        </div>
                      )}
                      
                      {(schedule as any).schedule_type === "weekly" && (schedule as any).recurrence_days && (
                        <div className="text-purple-400 text-sm">
                          <Repeat className="w-3 h-3 inline mr-1" />
                          Weekly on: {(schedule as any).recurrence_days.split(",").map((d: string) => daysOfWeek[parseInt(d)].slice(0, 3)).join(", ")}
                          <br />
                          Until: {new Date((schedule as any).recurrence_end).toLocaleDateString()}
                        </div>
                      )}
                      
                      {(schedule as any).schedule_type === "custom" && (schedule as any).custom_dates && (
                        <div className="text-purple-400 text-sm">
                          <Repeat className="w-3 h-3 inline mr-1" />
                          Custom dates: {(schedule as any).custom_dates.split(",").length} selected
                        </div>
                      )}
                      
                      <p className="text-xs text-muted-foreground mt-1">{schedule.message}</p>
                    </div>
                    {schedule.is_active && !isPast && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => schedule._row_id && handleDeactivate(schedule._row_id)}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ScheduledDowntime;
