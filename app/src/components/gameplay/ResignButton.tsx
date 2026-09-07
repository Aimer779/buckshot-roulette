import { Flag } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

export default function ResignButton({ disabled, resign }: { disabled: boolean; resign: () => void }) {
  return <AlertDialog>
    <AlertDialogTrigger asChild>
      <button disabled={disabled} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--text-dim)] px-4 text-sm text-[var(--text-secondary)] hover:border-[var(--accent-red)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)] disabled:opacity-40">
        <Flag className="h-4 w-4" aria-hidden="true" />认输
      </button>
    </AlertDialogTrigger>
    <AlertDialogContent className="border-[var(--bg-elevated)] bg-[var(--bg-dark)] font-chinese">
      <AlertDialogHeader>
        <AlertDialogTitle>确认认输？</AlertDialogTitle>
        <AlertDialogDescription>认输会结束整场比赛，对方获得胜利。双方可以查看结果后重新开房。</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>继续对战</AlertDialogCancel>
        <AlertDialogAction disabled={disabled} onClick={resign} className="bg-[var(--accent-red)] text-[var(--text-primary)] hover:bg-[var(--accent-crimson)]">确认认输</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
}
