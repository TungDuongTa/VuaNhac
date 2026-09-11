type Props = {
  message: string | null;
  syncing: boolean;
  onSync: () => void;
};

export function SetupErrorPanel({ message, syncing, onSync }: Props) {
  return (
    <div className="w-full rounded-2xl border border-white/10 bg-black/30 p-5 text-center">
      <p className="text-sm text-zinc-300">{message}</p>
      <button
        type="button"
        onClick={onSync}
        disabled={syncing}
        className="mt-4 rounded-full bg-white px-5 py-2 text-sm font-semibold text-black disabled:opacity-50"
      >
        {syncing ? "Syncing..." : "Sync song library"}
      </button>
    </div>
  );
}
