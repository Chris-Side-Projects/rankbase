import { describe, expect, test, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReportButton } from './ReportButton';
import * as clientModule from '../api/client';

describe('ReportButton', () => {
  test('submits a report with selected reason and notes', async () => {
    const spy = vi.spyOn(clientModule.api, 'reportImage').mockResolvedValue({
      report: {
        id: '10000000-0000-4000-8000-000000000001',
        imageId: '00000000-0000-0000-0000-000000000001',
        reason: 'copyright',
        status: 'open',
        created_at: new Date().toISOString(),
      },
      autoHidden: false,
      distinctReporters: 1,
    });

    render(
      <ReportButton imageId="00000000-0000-0000-0000-000000000001" imagePrompt="reported prompt" />
    );

    await userEvent.click(screen.getByRole('button', { name: 'Report' }));
    await userEvent.selectOptions(screen.getByLabelText('Reason'), 'copyright');
    await userEvent.type(screen.getByLabelText('Notes'), 'looks copied');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Submit report' })).not.toBeDisabled()
    );
    await userEvent.click(screen.getByRole('button', { name: 'Submit report' }));

    await waitFor(() => expect(spy).toHaveBeenCalledOnce());
    expect(spy.mock.calls[0][0]).toMatchObject({
      imageId: '00000000-0000-0000-0000-000000000001',
      reason: 'copyright',
      notes: 'looks copied',
    });
    expect(screen.getByText('Report submitted.')).toBeInTheDocument();
  });
});
