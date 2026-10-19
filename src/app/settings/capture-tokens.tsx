'use client';

import { useState, useTransition } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { toast } from '@/shared/hooks/use-toast';

import { createCaptureTokenAction, revokeCaptureTokenAction } from './actions';
import { CopyField } from './copy-field';

export interface TokenView {
  id: string;
  name: string;
  prefix: string;
  /** "criado em 19 de out. de 2026" */
  created: string;
  /** "usado há 2 minutos", or "ainda não usado". */
  used: string;
}

/**
 * The shortcut's tokens: each can be revoked, and a new one is shown once,
 * right after it's made, with the header to paste into the shortcut.
 */
export function CaptureTokens({ tokens }: { tokens: TokenView[] }) {
  const [creating, setCreating] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium">Tokens</h3>
        <Button
          type="button"
          size="sm"
          variant={tokens.length ? 'outline' : 'default'}
          onClick={() => setCreating(true)}
        >
          Gerar token
        </Button>
      </div>
      {tokens.length === 0 ? (
        <p className="text-muted-foreground mt-2 text-sm">
          Nenhum token ainda. O atalho precisa de um para registrar as compras
          na sua conta.
        </p>
      ) : (
        <ul className="mt-1">
          {tokens.map((token) => (
            <TokenRow key={token.id} token={token} />
          ))}
        </ul>
      )}
      <Dialog open={creating} onOpenChange={setCreating}>
        {creating && <NewToken onClose={() => setCreating(false)} />}
      </Dialog>
    </div>
  );
}

function TokenRow({ token }: { token: TokenView }) {
  const [confirming, setConfirming] = useState(false);

  async function revoke() {
    const result = await revokeCaptureTokenAction(token.id);
    toast(
      result.success
        ? { title: `Token "${token.name}" revogado.`, variant: 'success' }
        : { title: result.error, variant: 'error' },
    );
  }

  return (
    <li className="dimension-row gap-3 py-2.5">
      <div className="min-w-0">
        <p className="flex items-baseline gap-2">
          <span className="truncate font-medium">{token.name}</span>
          <span className="dimension-figure text-muted-foreground text-xs">
            {token.prefix}…
          </span>
        </p>
        <p className="text-muted-foreground text-xs">
          {token.created}, {token.used}
        </p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setConfirming(true)}
      >
        Revogar
      </Button>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Revogar token"
        description={`O atalho que usa "${token.name}" para de registrar compras na hora. Para voltar, gere outro token e cole no atalho.`}
        confirmLabel="Revogar"
        onConfirm={revoke}
      />
    </li>
  );
}

function NewToken({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('iPhone');
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function create(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await createCaptureTokenAction(name);
      if (result.success) setToken(result.token);
      else setError(result.error);
    });
  }

  if (token) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>Token gerado</DialogTitle>
          <DialogDescription>
            Copie agora: ele não aparece de novo. No atalho, ele vai no
            cabeçalho Authorization, exatamente assim:
          </DialogDescription>
        </DialogHeader>
        <CopyField
          label="Valor do cabeçalho Authorization"
          value={`Bearer ${token}`}
        />
        <DialogFooter>
          <Button type="button" onClick={onClose}>
            Pronto
          </Button>
        </DialogFooter>
      </>
    );
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Gerar token</DialogTitle>
        <DialogDescription>
          Um nome para reconhecer onde ele está, como o aparelho.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={create} className="space-y-4">
        {error && (
          <Alert variant="error">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="token-name">
            Nome
          </label>
          <Input
            id="token-name"
            value={name}
            maxLength={80}
            onChange={(event) => setName(event.target.value)}
            required
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Gerando…' : 'Gerar token'}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
