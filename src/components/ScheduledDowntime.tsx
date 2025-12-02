import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Clock, Power, Calendar, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import db from "@/lib/shared/kliv-database.js";

interface DowntimeSchedule {
  _row_id?: number;
  is_active: boolean;
  start_time: number;
  end_time: number;
  reason: string;
  message: string;
}

const ScheduledDowntime = () => {
  const { toast } = useToast();
  const [isActive, setIsActive] = useState(false);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("We're performing scheduled maintenance. We'll be back soon!");
  const [schedules, setSchedules] = useState<DowntimeSchedule[]>([]);
  
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
    if (!startTime || !endTime || !reason) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    const start = new Date(startTime).getTime();
    const end = new Date(endTime).getTime();

    if (end <= start) {
      toast({
        title: "Invalid Times",
        description: "End time must be after start time",
        variant: "destructive",
      });
      return;
    }

    try {
      await db.insert("downtime_schedules", {
        is_active: true,
        start_time: start,
        end_time: end,
        reason,
        message,
      });

      // Store in localStorage for immediate access
      localStorage.setItem('scheduled_downtime', JSON.stringify({
        isActive: true,
        startTime: start,
        endTime: end,
        reason,
        message,
      }));

      toast({
        title: "Downtime Scheduled",
        description: `Downtime from ${new Date(start).toLocaleString()} to ${new Date(end).toLocaleString()}`,
      });

      setStartTime("");
      setEndTime("");
      setReason("");
      setMessage("We're performing scheduled maintenance. We'll be back soon!");
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
              <Label htmlFor="end">End Time</Label>
              <Input
                id="end"
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="bg-secondary/50 border-white/10"
              />
            </div>
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
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {new Date(schedule.start_time).toLocaleString()} → {new Date(schedule.end_time).toLocaleString()}
                      </p>
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
