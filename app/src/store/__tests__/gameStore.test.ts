import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '@/store/gameStore';

describe('lastReadLogId / markLogsRead', () => {
  beforeEach(() => {
    useGameStore.setState({ logs: [], lastReadLogId: null });
  });

  it('initial lastReadLogId is null', () => {
    expect(useGameStore.getState().lastReadLogId).toBeNull();
  });

  it('addLog does not touch lastReadLogId (new entries are implicitly unread)', () => {
    useGameStore.getState().addLog('hit', 'damage');
    useGameStore.getState().addLog('heal', 'heal');
    expect(useGameStore.getState().lastReadLogId).toBeNull();
  });

  it('markLogsRead sets lastReadLogId to current newest log id', () => {
    useGameStore.getState().addLog('old', 'damage');
    useGameStore.getState().addLog('new', 'heal');
    const newestId = useGameStore.getState().logs[0].id;
    useGameStore.getState().markLogsRead();
    expect(useGameStore.getState().lastReadLogId).toBe(newestId);
  });

  it('markLogsRead with empty logs sets null', () => {
    useGameStore.getState().markLogsRead();
    expect(useGameStore.getState().lastReadLogId).toBeNull();
  });

  it('clearLogs resets logs and lastReadLogId to null', () => {
    useGameStore.getState().addLog('x', 'damage');
    useGameStore.getState().markLogsRead();
    useGameStore.getState().clearLogs();
    expect(useGameStore.getState().logs).toEqual([]);
    expect(useGameStore.getState().lastReadLogId).toBeNull();
  });

  it('resetGame resets lastReadLogId to null', () => {
    useGameStore.getState().addLog('x', 'damage');
    useGameStore.getState().markLogsRead();
    useGameStore.getState().resetGame();
    expect(useGameStore.getState().lastReadLogId).toBeNull();
    expect(useGameStore.getState().logs).toEqual([]);
  });
});
