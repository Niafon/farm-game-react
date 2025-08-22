import React from 'react';
import { render, act } from '@testing-library/react';
import BedTimer from '../../components/BedTimer';

describe('BedTimer component', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  test.each([
    ['future end time displays countdown', Date.now() + 3000, false],
    ['past end time dispatches event', Date.now() - 1000, true],
  ])('%s', (_name, timerEnd, shouldEnd) => {
    const handler = jest.fn();
    window.addEventListener('timer:end', handler as any);
    render(<BedTimer index={0} />);
    act(() => {
      window.dispatchEvent(
        new CustomEvent('bed:update', {
          detail: { index: 0, bed: { timerActive: true, timerEnd } },
        }) as any
      );
    });
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    if (shouldEnd) {
      expect(handler).toHaveBeenCalled();
    } else {
      expect(handler).not.toHaveBeenCalled();
    }
    window.removeEventListener('timer:end', handler as any);
  });
});
