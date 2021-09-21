import React from 'react';
import { history } from '@edx/frontend-platform';
import { Route } from 'react-router';
import { initializeTestStore, render, screen } from '../setupTest';
import { TabContainer } from './index';

const mockDispatch = jest.fn();

jest.mock('react-redux', () => ({
  ...jest.requireActual('react-redux'),
  useDispatch: () => mockDispatch,
}));
jest.mock('./TabPage', () => () => <div data-testid="TabPage" />);

describe('Tab Container', () => {
  let courseId;
  let mockFetch;
  let mockData;

  beforeEach(async () => {
    mockFetch = jest.fn().mockImplementation((x) => x);
    mockData = {
      children: [],
      fetch: mockFetch,
      tab: 'dummy',
      slice: 'courseware',
    };
    const store = await initializeTestStore({ excludeFetchSequence: true });
    courseId = store.getState().courseware.courseId;
  });

  it('renders correctly', () => {
    history.push(`/c/${courseId}`);
    render(
      <Route path="/c/:courseId">
        <TabContainer {...mockData} />
      </Route>,
    );

    expect(mockFetch)
      .toHaveBeenCalledTimes(1)
      .toHaveBeenCalledWith(courseId);
    expect(mockDispatch)
      .toHaveBeenCalledTimes(1)
      .toHaveBeenCalledWith(courseId);
    expect(screen.getByTestId('TabPage')).toBeInTheDocument();
  });

  it('Should handle passing in a targetUserId', () => {
    const targetUserId = '1';
    history.push(`/c/${courseId}/progress/${targetUserId}/`);

    render(
      <Route
        path="/c/:courseId/progress/:targetUserId/"
        render={({ match }) => (
          <TabContainer
            fetch={() => mockFetch(match.params.courseId, match.params.targetUserId)}
            slice="courseHome"
          />
        )}
      />,
    );

    expect(mockFetch)
      .toHaveBeenCalledTimes(1)
      .toHaveBeenCalledWith(courseId, targetUserId);
    expect(screen.getByTestId('TabPage')).toBeInTheDocument();
  });
});
