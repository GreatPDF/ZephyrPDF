import { describe, it, expect } from 'vitest';
import { HistoryManager } from '../src/core/history';

describe('HistoryManager', () => {
  it('should execute commands and record them in the undo stack', async () => {
    const history = new HistoryManager();
    let state = 0;

    await history.execute({
      description: 'Add 1',
      execute: () => { state += 1; },
      undo: () => { state -= 1; }
    });

    expect(state).toBe(1);
    expect(history.canUndo()).toBe(true);
    expect(history.canRedo()).toBe(false);
  });

  it('should undo and redo commands correctly', async () => {
    const history = new HistoryManager();
    let value = 'initial';

    await history.execute({
      description: 'Change to updated',
      execute: () => { value = 'updated'; },
      undo: () => { value = 'initial'; }
    });

    expect(value).toBe('updated');

    const undone = await history.undo();
    expect(undone).toBe(true);
    expect(value).toBe('initial');
    expect(history.canUndo()).toBe(false);
    expect(history.canRedo()).toBe(true);

    const redone = await history.redo();
    expect(redone).toBe(true);
    expect(value).toBe('updated');
  });

  it('should clear redo stack when a new command is executed', async () => {
    const history = new HistoryManager();
    let counter = 0;

    await history.execute({
      description: 'first',
      execute: () => { counter = 1; },
      undo: () => { counter = 0; }
    });

    await history.undo();
    expect(history.canRedo()).toBe(true);

    await history.execute({
      description: 'second',
      execute: () => { counter = 2; },
      undo: () => { counter = 0; }
    });

    expect(counter).toBe(2);
    expect(history.canRedo()).toBe(false);
  });
});
