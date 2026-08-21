import { Settings } from 'lucide-react';

import { AppShell } from '@/components/layout/app-shell';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';

export default function SettingsPage() {
  return (
    <AppShell>
      <Card className="flex flex-col items-center gap-3 p-16 text-center">
        <Settings className="text-muted-foreground h-10 w-10" />
        <CardTitle>Configurações em construção.</CardTitle>
        <CardDescription>
          Preferências de perfil, moeda padrão e notificações estarão
          disponíveis aqui em breve.
        </CardDescription>
      </Card>
    </AppShell>
  );
}
