import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Database, Info } from 'lucide-react';

export const ApiSetup = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Database className="h-5 w-5" />
          <span>Data Source</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Touchline reads app data from Supabase through the backend. External API keys are managed only by backend sync jobs, not inside the browser.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
};
