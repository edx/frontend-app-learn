import React from 'react';
import { history } from '@edx/frontend-platform';
import {
  render, screen, fireEvent, initializeMockApp,
} from '../../../../setupTest';
import ContentLock from './ContentLock';

describe('Content Lock', () => {
  const mockData = {
    courseId: 'test-course-id',
    prereqSectionName: 'test-prerequisite-section-name',
    prereqId: 'test-prerequisite-id',
    sequenceTitle: 'test-sequence-title',
  };

  beforeAll(async () => {
    // We need to mock AuthService to implicitly use `getAuthenticatedUser` within `AppContext.Provider`.
    await initializeMockApp();
  });

  it('displays sequence title along with lock icon', () => {
    const { container } = render(<ContentLock {...mockData} />);

    const lockIcon = container.querySelector('svg');
    expect(lockIcon).toHaveClass('fa-lock');
    expect(lockIcon.parentElement).toHaveTextContent(mockData.sequenceTitle);
  });

  it('displays prerequisite name', () => {
    const prereqText = `You must complete the prerequisite: '${mockData.prereqSectionName}' to access this content.`;
    render(<ContentLock {...mockData} />);

    expect(screen.getByText(prereqText)).toBeInTheDocument();
  });

  it('handles click', () => {
    history.push = jest.fn();
    render(<ContentLock {...mockData} />);
    fireEvent.click(screen.getByRole('button'));

    expect(history.push).toHaveBeenCalledWith(`/c/${mockData.courseId}/${mockData.prereqId}`);
  });
});
