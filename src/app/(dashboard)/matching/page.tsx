"use client";

import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Placeholder data: will eventually come from Supabase
const organisations: { id: string; name: string }[] = [];
const diagnosticSessions: { id: string; name: string }[] = [];
const recentRuns: {
  id: string;
  organisation: string;
  date: string;
  modelUsed: string;
  topCompetency: string;
  status: string;
}[] = [];

export default function MatchingPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          AI Matching Engine
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Use AI to match organisational diagnostic results with competency
          frameworks.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Run New Match</CardTitle>
          <CardDescription>
            Select an organisation and diagnostic session to generate
            competency-matched recommendations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="organisation">Organisation</Label>
              {organisations.length > 0 ? (
                <Select>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select organisation" />
                  </SelectTrigger>
                  <SelectContent>
                    {organisations.map((org) => (
                      <SelectItem key={org.id} value={org.id}>
                        {org.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm text-muted-foreground rounded-lg border border-dashed p-3">
                  No organisations available. Add an organisation first.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="session">Diagnostic Session</Label>
              {diagnosticSessions.length > 0 ? (
                <Select>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select session" />
                  </SelectTrigger>
                  <SelectContent>
                    {diagnosticSessions.map((session) => (
                      <SelectItem key={session.id} value={session.id}>
                        {session.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm text-muted-foreground rounded-lg border border-dashed p-3">
                  No diagnostic sessions available. Start a session first.
                </p>
              )}
            </div>
          </div>
          <div className="mt-6">
            <Button
              disabled={
                organisations.length === 0 || diagnosticSessions.length === 0
              }
            >
              <Sparkles className="size-4" />
              Run Matching
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">
          Recent Matching Runs
        </h2>
        {recentRuns.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted">
              <Sparkles className="size-6 text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-sm font-medium">No matching runs yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Run your first AI matching to see results here.
            </p>
          </div>
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organisation</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Model Used</TableHead>
                  <TableHead>Top Competency</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentRuns.map((run) => (
                  <TableRow key={run.id}>
                    <TableCell className="font-medium">
                      {run.organisation}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {run.date}
                    </TableCell>
                    <TableCell>{run.modelUsed}</TableCell>
                    <TableCell>{run.topCompetency}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground">
                        {run.status}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
